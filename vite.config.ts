import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

// 순수 React SPA (Vite). "@/*" 별칭은 src 를 가리킨다.
//
// 로컬 개발용 프록시:
//   백엔드(https://api.lapy.shop)의 CORS 허용 출처가 https://lapy.shop 뿐이라
//   브라우저에서 localhost → api.lapy.shop 직접 호출은 차단된다.
//   dev 서버가 /api·/ws 요청을 api.lapy.shop 로 대신 중계하고,
//   백엔드가 통과시키도록 Origin 을 https://lapy.shop 으로 바꿔 보낸다.
const API_TARGET = "https://api.lapy.shop";
const ALLOWED_ORIGIN = "https://lapy.shop";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    strictPort: false,
    proxy: {
      "/api": {
        target: API_TARGET,
        changeOrigin: true,
        secure: true,
        configure: (proxy) => {
          proxy.on("proxyReq", (proxyReq) => {
            proxyReq.setHeader("origin", ALLOWED_ORIGIN);
          });
        },
      },
      "/ws": {
        target: API_TARGET,
        changeOrigin: true,
        secure: true,
        ws: true,
        configure: (proxy) => {
          proxy.on("proxyReq", (proxyReq) => {
            proxyReq.setHeader("origin", ALLOWED_ORIGIN);
          });
          proxy.on("proxyReqWs", (proxyReq) => {
            proxyReq.setHeader("origin", ALLOWED_ORIGIN);
          });
        },
      },
    },
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
