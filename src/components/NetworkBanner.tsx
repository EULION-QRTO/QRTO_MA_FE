interface Props {
  online: boolean;
}

/**
 * 연결 끊김 배너 — 기존 UI를 덮지 않고 위에서 밀어내도록, 화면 최상단(.app 의 첫 자식)에
 * 넣어서 쓴다. useNetworkStatus() 의 online 이 false 일 때만 보인다.
 */
export default function NetworkBanner({ online }: Props) {
  if (online) return null;
  return (
    <div className="network-banner" role="status" aria-live="polite">
      ⚠️ 인터넷 연결이 끊겼습니다 — 재연결을 시도하는 중입니다.
    </div>
  );
}
