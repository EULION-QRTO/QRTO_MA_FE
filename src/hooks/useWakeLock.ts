import { useEffect, useRef } from "react";

/**
 * 화면이 꺼지지 않게 Screen Wake Lock 을 걸어둔다.
 * 축제 현장에서 iPad를 Guided Access(안내된 접근)로 잠가두고 장시간 POS 로 쓰는
 * 상황을 위한 것 — 화면이 자동으로 꺼지면 Guided Access 안에서도 다시 켤 방법이
 * 마땅치 않다.
 *
 * - 미지원 브라우저(iOS 는 Safari 16.4+/iPadOS 16.4+ 필요)는 `"wakeLock" in navigator`
 *   가 false 라 조용히 아무 것도 안 한다 — 에러를 던지지 않는다.
 * - 브라우저는 탭이 백그라운드로 가거나(visibilitychange) 화면이 잠기면 wake lock 을
 *   자동으로 풀어버리므로, 다시 보이는 시점에 재요청한다.
 * - `enabled=false` 로 주면 잠금을 걸지 않고, 이미 걸려 있던 잠금은 해제한다.
 */
export function useWakeLock(enabled = true): void {
  const sentinelRef = useRef<WakeLockSentinel | null>(null);

  useEffect(() => {
    if (!enabled) return;
    if (typeof navigator === "undefined" || !("wakeLock" in navigator)) return;

    let cancelled = false;

    const requestLock = async () => {
      try {
        const sentinel = await navigator.wakeLock.request("screen");
        if (cancelled) {
          // 요청이 끝나기 전에 already unmount/disabled 됐으면 즉시 반납
          void sentinel.release();
          return;
        }
        sentinelRef.current = sentinel;
        // 시스템이 임의로(배터리 세이버 등) 풀어버린 경우도 감지해서 다음 visible 때 재요청되게
        sentinel.addEventListener("release", () => {
          if (sentinelRef.current === sentinel) sentinelRef.current = null;
        });
      } catch {
        // 권한 거부·탭이 안 보이는 상태에서의 요청 실패 등 — 조용히 무시.
        // 다음 visibilitychange(visible) 시점에 다시 시도된다.
      }
    };

    void requestLock();

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible" && sentinelRef.current === null) {
        void requestLock();
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibilityChange);
      const sentinel = sentinelRef.current;
      sentinelRef.current = null;
      if (sentinel) void sentinel.release();
    };
  }, [enabled]);
}
