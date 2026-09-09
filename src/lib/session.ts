/**
 * 클라이언트 세션 저장소.
 *
 * 백엔드 로그인(POST /api/auth/login)이 돌려준 JWT(accessToken)와 매장 정보를
 * localStorage 에 보관한다. 이후 포스 요청은 Authorization: Bearer 로 토큰을 싣는다.
 * (별도 모듈로 분리해 api ↔ auth 순환 참조를 피한다.)
 */
const SESSION_KEY = "pos_session";

export interface Session {
  /** 라우팅/식별용 문자열 storeId (백엔드 숫자 id 를 문자열로 보관) */
  storeId: string;
  storeName: string;
  /** 로그인 역할. 포스 세션은 항상 "STORE" */
  role: "STORE" | "ADMIN";
  accessToken: string;
  /** 만료 시각 (epoch ms) */
  expiresAt: number;
}

export function saveSession(session: Session): void {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function getSession(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as Session;
    if (!s || typeof s.storeId !== "string" || typeof s.accessToken !== "string") return null;
    if (s.expiresAt && Date.now() >= s.expiresAt) {
      // 만료된 토큰은 세션으로 취급하지 않는다.
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
    return s;
  } catch {
    return null;
  }
}

export function clearSession(): void {
  localStorage.removeItem(SESSION_KEY);
}

/** 현재 액세스 토큰 (없으면 null) */
export function getToken(): string | null {
  return getSession()?.accessToken ?? null;
}
