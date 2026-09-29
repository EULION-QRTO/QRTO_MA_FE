import { setWaitingWorker } from "./swUpdate";

/**
 * 서비스워커를 등록하고, 새 버전이 설치돼 대기(waiting) 중이면 swUpdate pub-sub 으로
 * 알린다. 실제 새로고침은 여기서 하지 않는다 — UpdateBanner 에서 사용자가 "새로고침"을
 * 직접 눌러야 적용된다(결제·주문 접수 도중 강제 새로고침 방지).
 */
export function registerServiceWorker(): void {
  if (!("serviceWorker" in navigator)) return;

  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/service-worker.js")
      .then((registration) => {
        // 방문 시점에 이미 새 버전이 설치돼 대기 중이었던 경우
        if (registration.waiting && registration.active) {
          setWaitingWorker(registration.waiting);
        }

        registration.addEventListener("updatefound", () => {
          const installing = registration.installing;
          if (!installing) return;
          installing.addEventListener("statechange", () => {
            // "installed" 인데 이미 활성화된 SW 가 있었다면 = 첫 설치가 아니라 업데이트
            if (installing.state === "installed" && navigator.serviceWorker.controller) {
              setWaitingWorker(installing);
            }
          });
        });
      })
      .catch((e) => {
        console.error("[sw] 등록 실패", e);
      });
  });

  // 대기 중이던 워커가 활성화되면(사용자가 배너의 "새로고침"을 눌러 SKIP_WAITING 을
  // 보낸 뒤) 페이지를 새로고침해 새 셸을 반영한다.
  let reloaded = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (reloaded) return; // 중복 새로고침 방지
    reloaded = true;
    window.location.reload();
  });
}
