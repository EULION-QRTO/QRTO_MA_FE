import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { logout as authLogout } from "@/lib/auth";
import OverviewTab from "@/pages/operator/OverviewTab";
import StoreListTab from "@/pages/operator/StoreListTab";
import StoreRegisterTab from "@/pages/operator/StoreRegisterTab";
import QrPrintTab from "@/pages/operator/QrPrintTab";
import PaymentsTab from "@/pages/operator/PaymentsTab";
import { StoresProvider } from "@/pages/operator/stores";

type OperatorTab = "overview" | "stores" | "register" | "qr" | "payments";

const TABS: { key: OperatorTab; label: string }[] = [
  { key: "overview", label: "개요" },
  { key: "stores", label: "매장 리스트" },
  { key: "register", label: "매장 등록" },
  { key: "qr", label: "QR 인쇄" },
  { key: "payments", label: "결제·취소 내역" },
];

export default function OperatorDashboard() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<OperatorTab>("overview");
  const [qrStoreId, setQrStoreId] = useState<string | undefined>(undefined);

  const logout = () => {
    authLogout();
    navigate("/operator/login", { replace: true });
  };

  // 매장 리스트 → QR 인쇄 탭 이동 (매장 prefill)
  const openQrFor = (id: string) => {
    setQrStoreId(id);
    setTab("qr");
  };

  return (
    <StoresProvider>
    <div className="op">
      <header className="op__header op__no-print">
        <div className="op__brand">
          <span className="op__brand-title">서비스 모니터링</span>
          <span className="op__brand-sub">운영자 대시보드</span>
        </div>
        <nav className="op__tabs">
          {TABS.map((t) => (
            <button
              key={t.key}
              className={`op__tab${tab === t.key ? " op__tab--active" : ""}`}
              onClick={() => setTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </nav>
        <div className="op__header-right">
          <button className="btn btn--sm btn--secondary" onClick={logout}>
            로그아웃
          </button>
        </div>
      </header>

      <main className="op__main">
        {tab === "overview" && <OverviewTab />}
        {tab === "stores" && <StoreListTab onPrintQr={openQrFor} />}
        {tab === "register" && <StoreRegisterTab />}
        {tab === "qr" && <QrPrintTab initialStoreId={qrStoreId} />}
        {tab === "payments" && <PaymentsTab />}
      </main>
    </div>
    </StoresProvider>
  );
}
