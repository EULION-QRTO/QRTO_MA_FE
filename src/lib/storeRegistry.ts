/**
 * 매장 레지스트리 — 로컬 우선 + 서버 동기화.
 *
 * 백엔드 매장 생성/목록 API(POST/GET /api/stores)가 아직 없어도 로컬(localStorage)에
 * 저장돼 즉시 동작하고, 서버 API 가 배포되면 자동으로 서버에 저장/로드된다.
 * (try 서버 → 실패 시 로컬 폴백)
 */
import { adminApi } from "./endpoints";
import { ApiError } from "./api";
import {
  getManagedStores,
  setManagedStores,
  type ManagedStore,
} from "./operator";

export interface CreateStoreInput {
  name: string;
  org?: string;
  takeoutEnabled?: boolean;
  /** 운영자가 사전 설정하는 주점 로그인 자격증명 */
  username: string;
  password: string;
}

export interface CreateStoreResult {
  store: ManagedStore;
  syncedToServer: boolean;
  error?: string;
}

/**
 * 매장 생성. 로컬에 먼저 저장하고, 서버 저장을 시도한다.
 * 서버 성공 시 로컬 임시 id 를 서버 id 로 교체하고 synced=true 로 표시.
 */
export async function createStore(input: CreateStoreInput): Promise<CreateStoreResult> {
  const tempId = `local-${Date.now()}`;
  // 비밀번호는 로컬에 저장하지 않는다(서버 전송용으로만 사용).
  const draft: ManagedStore = {
    id: tempId,
    name: input.name,
    org: input.org,
    takeoutEnabled: input.takeoutEnabled,
    username: input.username,
    synced: false,
  };
  // 1) 로컬 우선 저장
  setManagedStores([...getManagedStores(), draft]);

  // 2) 서버 저장 시도 (자격증명 포함 → 서버가 계정 생성/해시)
  //    org(운영단체)는 v2 API 에 필드가 없어 로컬 메타로만 보관한다.
  try {
    const created = await adminApi.stores.create({
      name: input.name,
      takeoutEnabled: input.takeoutEnabled,
      username: input.username,
      password: input.password,
    });
    const synced: ManagedStore = {
      id: String(created.id),
      name: created.name ?? input.name,
      org: input.org, // 서버 미지원 필드는 로컬 메타 유지
      takeoutEnabled: created.takeoutEnabled ?? input.takeoutEnabled,
      username: input.username,
      synced: true,
    };
    setManagedStores(getManagedStores().map((s) => (s.id === tempId ? synced : s)));
    return { store: synced, syncedToServer: true };
  } catch (e) {
    return {
      store: draft,
      syncedToServer: false,
      error: e instanceof ApiError ? `${e.code} · ${e.message}` : "서버 저장 실패",
    };
  }
}

/**
 * 서버에서 전체 매장 목록을 불러와 로컬 레지스트리와 병합한다.
 * 서버 API 부재/오류면 null 반환(호출측은 로컬 목록 그대로 사용).
 * - 서버 매장: 정본. 로컬 메타(org, name 라벨)는 보존.
 * - 서버에 없는 로컬 전용(local-*) 매장: 유지.
 */
export async function syncStoresFromServer(): Promise<ManagedStore[] | null> {
  let server: ManagedStore[];
  try {
    const list = await adminApi.stores.list();
    server = list.map((s) => ({
      id: String(s.id),
      name: s.name,
      takeoutEnabled: s.takeoutEnabled,
      synced: true,
    }));
  } catch {
    return null;
  }
  const local = getManagedStores();
  const localById = new Map(local.map((s) => [s.id, s]));
  const merged: ManagedStore[] = server.map((s) => ({
    ...s,
    org: localById.get(s.id)?.org,
    name: localById.get(s.id)?.name ?? s.name,
  }));
  const localOnly = local.filter((s) => !server.some((sv) => sv.id === s.id));
  const next = [...merged, ...localOnly];
  setManagedStores(next);
  return next;
}
