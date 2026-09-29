import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { registerServiceWorker } from "./lib/registerServiceWorker";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);

// 프로덕션 빌드에서만 등록 — vite dev 서버에서는 서비스워커 캐시가 HMR/최신 소스와
// 어긋나 디버깅이 꼬이므로 등록하지 않는다.
if (import.meta.env.PROD) {
  registerServiceWorker();
}
