/**
 * 운영자(서비스 모니터링 관리자) 로컬 상태 — 관리 매장 목록.
 *
 * 운영자 인증은 주점 POS 와 동일하게 백엔드 JWT(POST /api/auth/login, role=ADMIN)를 쓴다.
 * (세션은 lib/session.ts, 로그인은 lib/auth.ts 참조)
 */
const WATCH_KEY = "operator_watch_stores";

/* ── 관리 매장 목록 (localStorage 영속) ── */

/**
 * 운영자가 관리하는 매장. 백엔드에 '전체 매장 목록/운영단체' API 가 없어
 * id 외 name·org(운영단체)는 로컬 메타데이터로 보관한다. (name 은 백엔드 조회로 보강됨)
 */
export interface ManagedStore {
  id: string;
  name?: string;
  org?: string;
  takeoutEnabled?: boolean;
  /** 주점 로그인 아이디 (참조용). 비밀번호는 로컬에 저장하지 않는다. */
  username?: string;
  /** 서버에 저장(동기화)됐는지. false 면 로컬 전용(서버 API 부재/오류). */
  synced?: boolean;
}

/** 관리 매장 목록. 기본값 [{ id: "1" }]. 구버전(string[]) 자동 마이그레이션. */
export function getManagedStores(): ManagedStore[] {
  try {
    const raw = localStorage.getItem(WATCH_KEY);
    if (!raw) return [{ id: "1" }];
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return [{ id: "1" }];
    return arr
      .map((item): ManagedStore => (typeof item === "string" ? { id: item } : (item as ManagedStore)))
      .filter((s) => s && String(s.id).trim() !== "");
  } catch {
    return [{ id: "1" }];
  }
}

export function setManagedStores(list: ManagedStore[]): void {
  // id 기준 중복 제거 + 순서 유지
  const seen = new Set<string>();
  const uniq = list.filter((s) => {
    const id = String(s.id).trim();
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
  localStorage.setItem(WATCH_KEY, JSON.stringify(uniq));
}

/** 관리 매장 ID 목록만 (KPI 집계 등에서 사용) */
export function getManagedStoreIds(): string[] {
  return getManagedStores().map((s) => s.id);
}

/** 관리 매장 추가/갱신 (id 기준 upsert) */
export function upsertManagedStore(store: ManagedStore): void {
  const list = getManagedStores();
  const idx = list.findIndex((s) => s.id === store.id);
  if (idx >= 0) list[idx] = { ...list[idx], ...store };
  else list.push(store);
  setManagedStores(list);
}

/** 관리 매장 제거 */
export function removeManagedStore(id: string): void {
  setManagedStores(getManagedStores().filter((s) => s.id !== id));
}
