import { formatKRW } from "@/lib/types";

export type MainTab = "tables" | "admin";

interface Props {
  /** 주점 이름 (헤더에 크게 표시) */
  storeName: string;
  /** 운영단체 (주점 이름 옆 보조 표기) */
  organization: string;
  todaySales: number;
  /** 영업중 여부 */
  storeOpen: boolean;
  /** 영업 개폐 토글 */
  onToggleOpen: () => void;
  activeTab: MainTab;
  onTabChange: (tab: MainTab) => void;
  onRefresh: () => void;
  onLogout: () => void;
}

export default function Header({
  storeName,
  organization,
  todaySales,
  storeOpen,
  onToggleOpen,
  activeTab,
  onTabChange,
  onRefresh,
  onLogout,
}: Props) {
  return (
    <header className="header">
      <div className="header__brand">
        <span className="header__logo">{storeName}</span>
        {organization && <span className="header__store">{organization}</span>}
      </div>

      <div className="header__summary">
        <span className="header__summary-label">오늘 매출</span>
        <span className="header__summary-value">{formatKRW(todaySales)}</span>
      </div>

      <button
        className={`btn btn--sm header__open-toggle${storeOpen ? " btn--primary" : " btn--secondary"}`}
        onClick={onToggleOpen}
        aria-pressed={storeOpen}
        title="영업 상태 전환"
      >
        {storeOpen ? "🟢 영업중" : "⛔ 영업종료"}
      </button>

      <button className="header__refresh" onClick={onRefresh} aria-label="새로고침">
        ↻
      </button>

      <nav className="segmented" role="tablist">
        <button
          role="tab"
          aria-selected={activeTab === "tables"}
          className={`segmented__tab${activeTab === "tables" ? " segmented__tab--active" : ""}`}
          onClick={() => onTabChange("tables")}
        >
          테이블 현황
        </button>
        <button
          role="tab"
          aria-selected={activeTab === "admin"}
          className={`segmented__tab${activeTab === "admin" ? " segmented__tab--active" : ""}`}
          onClick={() => onTabChange("admin")}
        >
          관리자
        </button>
      </nav>

      <button className="btn btn--secondary btn--sm header__logout" onClick={onLogout}>
        로그아웃
      </button>
    </header>
  );
}
