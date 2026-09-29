import { useEffect, useState } from "react";
import { isApiHealthy, subscribeApiHealth } from "@/lib/networkStatus";

/**
 * 실제로 쓸만한 연결 상태 — 브라우저 online/offline 이벤트와 최근 API 요청 결과를 같이 본다.
 * navigator.onLine 하나만 보면 "와이파이엔 붙어있지만 인터넷은 안 되는" 축제 현장 상황을
 * 놓친다 — 그래서 실제 API 요청이 네트워크 계열로 실패하면(api.ts 가 보고) 같이 꺼진다.
 */
export function useNetworkStatus(): { online: boolean } {
  const [browserOnline, setBrowserOnline] = useState<boolean>(() =>
    typeof navigator === "undefined" ? true : navigator.onLine,
  );
  const [apiOk, setApiOk] = useState<boolean>(() => isApiHealthy());

  useEffect(() => {
    const onOnline = () => setBrowserOnline(true);
    const onOffline = () => setBrowserOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    const unsubscribe = subscribeApiHealth(setApiOk);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      unsubscribe();
    };
  }, []);

  return { online: browserOnline && apiOk };
}
