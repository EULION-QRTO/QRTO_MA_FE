/**
 * 인증. 백엔드 로그인 API 로 JWT 를 발급받아 세션에 저장한다.
 *
 * 이전(목업 accounts 클라이언트 검증)을 대체한다:
 * - login(): POST /api/auth/login → 토큰/매장정보 저장
 * - me():    GET  /api/auth/me   → 토큰 유효성 확인 + 매장정보 갱신
 * - logout(): 서버 로그아웃은 없음(JWT stateless). 클라이언트 토큰만 제거한다.
 */
import { authApi } from "@/lib/endpoints";
import { ApiError } from "@/lib/api";
import type { LoginResponse } from "@/lib/dto";
import { saveSession, clearSession, getSession, type Session } from "@/lib/session";

export type { Session } from "@/lib/session";
export { getSession } from "@/lib/session";

/**
 * LoginResponse → Session. 역할(ADMIN/STORE) 공통.
 * STORE 인데 storeId 가 없으면(서버 이상) null.
 */
function toSession(res: LoginResponse): Session | null {
  if (res.role === "STORE" && res.storeId == null) return null;
  return {
    storeId: res.storeId != null ? String(res.storeId) : "",
    storeName: res.storeName ?? "",
    role: res.role,
    accessToken: res.accessToken,
    expiresAt: Date.now() + res.expiresIn * 1000,
  };
}

/**
 * 로그인 시도 (관리자·포스 공통 — POST /api/auth/login).
 * - 성공: 세션 저장 후 반환. 호출부가 session.role 로 화면을 분기한다.
 * - 자격증명 오류(400/401): null 반환 (로그인 화면이 "아이디/비밀번호 오류" 표시)
 * - 그 외(네트워크/타임아웃/5xx): ApiError 를 그대로 throw (로그인 화면이 연결 오류 표시)
 */
export async function login(username: string, password: string): Promise<Session | null> {
  try {
    const res = await authApi.login(username.trim(), password);
    const session = toSession(res);
    if (!session) return null;
    saveSession(session);
    return session;
  } catch (e) {
    // 실제 자격증명 실패만 null. 네트워크/타임아웃/서버오류는 상위에서 구분해 안내한다.
    if (e instanceof ApiError && (e.status === 400 || e.status === 401)) return null;
    throw e;
  }
}

/** 현재 토큰 유효성 확인 + 세션 갱신. 실패 시 세션 제거 후 null */
export async function refreshMe(): Promise<Session | null> {
  try {
    const res = await authApi.me();
    const session = toSession(res);
    if (!session) {
      clearSession();
      return null;
    }
    saveSession(session);
    return session;
  } catch {
    clearSession();
    return null;
  }
}

export function logout(): void {
  clearSession();
}

export { getSession as currentSession };
