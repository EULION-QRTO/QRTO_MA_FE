import { BrowserRouter, Routes, Route, Navigate, useParams } from "react-router-dom";
import PosApp from "@/components/PosApp";
import LoginPage from "@/pages/LoginPage";
import OperatorLoginPage from "@/pages/OperatorLoginPage";
import OperatorDashboard from "@/pages/OperatorDashboard";
import { getSession } from "@/lib/auth";

/** 진입점: 세션 역할에 따라 POS / 운영자 대시보드로, 없으면 로그인으로. */
function Home() {
  const session = getSession();
  if (!session) return <Navigate to="/login" replace />;
  return (
    <Navigate to={session.role === "ADMIN" ? "/operator" : `/store/${session.storeId}`} replace />
  );
}

/**
 * 주점 POS 라우트 가드.
 * - 세션이 없으면 → /login?reason=auth
 * - 세션의 storeId 와 URL 의 storeId 가 다르면(=URL 조작) → /login?reason=forbidden
 * 매장명은 로그인 시 백엔드가 내려준 세션 값(storeName)을 사용한다.
 */
function StoreRoute() {
  const { storeId } = useParams<{ storeId: string }>();
  const session = getSession();

  if (!session) return <Navigate to="/login?reason=auth" replace />;
  if (session.role !== "STORE") return <Navigate to="/operator" replace />;
  if (session.storeId !== storeId) return <Navigate to="/login?reason=forbidden" replace />;

  return <PosApp storeId={session.storeId} storeName={session.storeName} />;
}

/** 운영자 라우트 가드. ADMIN 세션이 아니면 → /operator/login */
function OperatorRoute() {
  const session = getSession();
  if (!session || session.role !== "ADMIN")
    return <Navigate to="/operator/login?reason=auth" replace />;
  return <OperatorDashboard />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/store/:storeId" element={<StoreRoute />} />
        <Route path="/operator/login" element={<OperatorLoginPage />} />
        <Route path="/operator" element={<OperatorRoute />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
