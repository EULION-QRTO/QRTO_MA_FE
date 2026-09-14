/**
 * 운영자 대시보드 로컬 캐시.
 *
 * 매장 목록의 정본은 GET /api/admin/stores (pages/operator/stores.tsx).
 * 여기 localStorage 는 (1) 서버 조회 실패 시 폴백, (2) 서버에 아직 없는 운영단체(org) 메타
 * 보관 용도로만 쓴다.
 *
 * 운영자 인증은 주점 POS 와 동일한 백엔드 JWT(POST /api/auth/login, role=ADMIN).
 */
const CACHE_KEY = "operator_watch_stores";

export interface ManagedStore {
  id: string;
  name?: string;
  /** 운영단체 (로컬 메타) */
  org?: string;
  takeoutEnabled?: boolean;
  /** 주점 로그인 아이디 (참조용). 비밀번호는 저장하지 않는다. */
  username?: string;
  /** 서버 목록에서 온 항목인지 */
  synced?: boolean;
}

/** 캐시된 매장 목록. 없으면 빈 배열. 구버전(string[])도 흡수. */
export function getManagedStores(): ManagedStore[] {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return [];
    return arr
      .map((item): ManagedStore =>
        typeof item === "string" ? { id: item } : (item as ManagedStore),
      )
      .filter((s) => s && String(s.id).trim() !== "");
  } catch {
    return [];
  }
}

export function setManagedStores(list: ManagedStore[]): void {
  const seen = new Set<string>();
  const uniq = list.filter((s) => {
    const id = String(s.id).trim();
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(uniq));
  } catch {
    /* 저장 실패는 무시 (프라이빗 모드 등) */
  }
}
