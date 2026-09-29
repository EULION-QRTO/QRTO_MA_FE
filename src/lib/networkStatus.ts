/**
 * "실제로 서버와 통신이 되는지"를 추적하는 가벼운 pub-sub.
 *
 * navigator.onLine 만으로는 부족하다 — 와이파이에 붙어있지만 인터넷이 안 되는
 * 상태(축제 현장에서 흔함)에서도 true 를 준다. 그래서 브라우저 online/offline
 * 이벤트(useNetworkStatus 훅에서 결합)와, 실제 API 요청의 성공/실패 신호를
 * 같이 본다 — 이 모듈은 그중 "API 요청 결과" 쪽을 담당한다. api.ts 가 매 요청마다
 * reportApiSuccess/reportApiFailure 를 호출해 갱신한다.
 */
type Listener = (healthy: boolean) => void;

let apiHealthy = true;
const listeners = new Set<Listener>();

function setHealthy(next: boolean): void {
  if (apiHealthy === next) return;
  apiHealthy = next;
  listeners.forEach((l) => l(next));
}

/** 네트워크 계열 실패(fetch 자체 실패·타임아웃)에서만 호출 — 서버가 준 4xx/5xx 앱 에러는 해당 없음 */
export function reportApiFailure(): void {
  setHealthy(false);
}

/** 어떤 응답이든 서버로부터 받았으면(상태코드 무관) 통신 경로는 살아있는 것 */
export function reportApiSuccess(): void {
  setHealthy(true);
}

export function isApiHealthy(): boolean {
  return apiHealthy;
}

/** 구독. 반환값을 호출하면 해제. */
export function subscribeApiHealth(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
