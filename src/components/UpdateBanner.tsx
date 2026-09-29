import { useSwUpdate } from "@/hooks/useSwUpdate";

/**
 * 새 버전이 배포돼 서비스워커가 대기 중일 때만 보이는 배너.
 * 자동 새로고침은 하지 않는다 — 결제·주문 접수 중에 화면이 갑자기 바뀌면 안 되므로,
 * "새로고침"을 직접 눌렀을 때만 적용한다.
 */
export default function UpdateBanner() {
  const { updateAvailable, applyUpdate } = useSwUpdate();
  if (!updateAvailable) return null;

  return (
    <div className="update-banner" role="status">
      <span>새 버전이 있습니다.</span>
      <button type="button" className="update-banner__btn" onClick={applyUpdate}>
        새로고침
      </button>
    </div>
  );
}
