/**
 * Lpay POS 서비스워커 — 앱 "껍데기"(빌드된 정적 자산)만 캐시한다.
 *
 * - API(/api/**)·WebSocket(/ws) 요청은 절대 캐시하지 않고 그대로 네트워크로 통과시킨다.
 *   POS 데이터(테이블·주문·결제 등)가 캐시된 낡은 값으로 응답되면 절대 안 되기 때문.
 * - 캐시 이름에 버전을 둔다. 배포 때마다 이 값을 바꾸면(빌드 스크립트가 바꿔도 되고,
 *   수동으로 올려도 된다) 새 셸이 새 캐시에 받아지고, activate 시 이전 버전 캐시는 지운다.
 * - GET 만 다룬다. POST/PATCH/PUT/DELETE 는 손대지 않고 그냥 네트워크로 흘려보낸다
 *   (캐시 대상이 아니고, respondWith 하지 않으면 브라우저 기본 동작 그대로 나간다).
 * - 새 버전은 자동으로 활성화하지 않는다 — install 은 하되 skipWaiting 은 클라이언트가
 *   "새로고침"을 눌러 SKIP_WAITING 메시지를 보낼 때만 부른다(main.tsx/swUpdate.ts 참고).
 *   결제·주문 접수 도중 서비스워커가 바뀌어 화면이 갑자기 새로고침되는 걸 막기 위함.
 */

const CACHE_VERSION = "v1";
const CACHE_NAME = `lpay-pos-shell-${CACHE_VERSION}`;

// 설치 시 미리 캐싱할 핵심 셸. 해시가 붙는 빌드 산출물(JS/CSS)은 파일명을 미리 알 수 없어
// 여기 안 넣고, 첫 요청 때 fetch 핸들러가 캐시에 채워 넣는다(아래 stale-while-revalidate).
const PRECACHE_URLS = [
  "/",
  "/manifest.webmanifest",
  "/icon-192.png",
  "/icon-512.png",
  "/icon-512-maskable.png",
  "/apple-touch-icon.png",
  "/favicon.png",
  "/favicon-64.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .catch((e) => {
        // 프리캐시 실패해도(예: 오프라인 상태에서 첫 설치) 설치 자체는 막지 않는다 —
        // 나머지 자산은 첫 요청 때 캐시에 채워진다.
        console.warn("[sw] precache 실패", e);
      }),
  );
  // skipWaiting 은 여기서 자동 호출하지 않는다(위 주석 참고).
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("lpay-pos-shell-") && key !== CACHE_NAME)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

function isApiOrWs(url) {
  return url.pathname.startsWith("/api") || url.pathname.startsWith("/ws");
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return; // 변경 요청은 절대 손대지 않는다(캐시도, 가로채기도 안 함)

  const url = new URL(req.url);

  // 같은 출처가 아니면(폰트 CDN 등 외부 자산) 관여하지 않는다 — 우리 앱 셸만 다룬다
  if (url.origin !== self.location.origin) return;

  // 내부 API·WS 는 절대 캐시하지 않고 네트워크로 직접 통과
  if (isApiOrWs(url)) return;

  // 네비게이션(주소창 진입 · 새로고침 · 홈 화면 아이콘 실행) — network-first,
  // 오프라인이면 캐시해둔 index.html 로 폴백해서 최소한 앱 셸은 뜨게 한다.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put("/", copy));
          return res;
        })
        .catch(() => caches.match("/").then((cached) => cached || caches.match(req))),
    );
    return;
  }

  // 정적 자산(해시 붙은 JS/CSS, 이미지 등) — 캐시부터 즉시 응답하고, 백그라운드로
  // 최신본을 받아 캐시를 갱신한다(다음 방문부터 반영). 캐시에 없으면 네트워크로.
  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    }),
  );
});
