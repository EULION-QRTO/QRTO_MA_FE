/**
 * 새 버전의 서비스워커가 설치돼 대기(waiting) 중임을 화면에 알리기 위한 pub-sub.
 * main.tsx 의 등록 로직이 publish 하고, useSwUpdate 훅이 구독한다.
 *
 * 여기서 자동으로 새로고침하지 않는다 — 결제·주문 접수 중에 화면이 갑자기 새로고침되면
 * 안 되므로, 사용자가 배너의 "새로고침"을 직접 눌렀을 때만 적용한다(applyUpdate).
 */
type Listener = (waiting: boolean) => void;

let waitingWorker: ServiceWorker | null = null;
const listeners = new Set<Listener>();

export function setWaitingWorker(worker: ServiceWorker | null): void {
  waitingWorker = worker;
  listeners.forEach((l) => l(waitingWorker !== null));
}

export function hasWaitingWorker(): boolean {
  return waitingWorker !== null;
}

export function subscribeSwUpdate(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** 대기 중인 새 버전을 활성화시킨다. 실제 새로고침은 controllerchange 이벤트에서 일어난다(main.tsx). */
export function applyUpdate(): void {
  waitingWorker?.postMessage("SKIP_WAITING");
}
