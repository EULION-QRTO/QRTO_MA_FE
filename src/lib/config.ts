/**
 * 런타임 설정.
 *
 * QRTO API 명세서(v2) 기준. 백엔드는 항상 운영 서버(https://api.lapy.shop).
 *
 * - 배포(build): REST = https://api.lapy.shop, STOMP = wss://api.lapy.shop/ws 로 직접 호출
 * - 로컬 개발(vite dev): 백엔드 CORS 가 https://lapy.shop 만 허용하므로 브라우저에서
 *   api.lapy.shop 로 직접 못 붙는다. → 같은 출처("")로 요청하고 vite dev 서버가
 *   /api·/ws 를 api.lapy.shop 로 프록시한다. (vite.config.ts 참고)
 */
const DEV = import.meta.env.DEV;

/** REST 베이스 URL. dev 는 same-origin(프록시), prod 는 운영 서버. */
export const API_BASE_URL: string = DEV ? window.location.origin : "https://api.lapy.shop";

/** STOMP(WebSocket) 브로커 URL. dev 는 same-origin(프록시), prod 는 운영 서버. */
export const WS_BASE_URL: string = DEV
  ? `${window.location.origin.replace(/^http/, "ws")}/ws`
  : "wss://api.lapy.shop/ws";

/**
 * 서버가 내려준 자산(이미지) URL 을 브라우저가 로드할 수 있는 절대 URL 로 만든다.
 * - 이미 절대 URL(http/https)·data·blob 이면 그대로 사용
 * - 상대 경로("/uploads/x.png")면 API_BASE_URL 기준으로 절대화
 */
export function resolveAssetUrl(url?: string | null): string | undefined {
  if (!url) return undefined;
  if (/^(https?:|data:|blob:)/i.test(url)) return url;
  return new URL(url, API_BASE_URL).toString();
}
