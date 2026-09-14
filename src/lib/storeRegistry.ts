/**
 * 매장 생성 — POST /api/admin/stores (관리자).
 * 운영자가 주점 로그인 자격증명을 함께 넘기면 서버가 계정을 생성·해시한다.
 * 조회는 pages/operator/stores.tsx(useStores) 가 담당한다.
 */
import { adminApi } from "./endpoints";
import { ApiError } from "./api";

/** 신규 매장 기본 테이블 개수 */
export const DEFAULT_TABLE_COUNT = 32;

export interface CreateStoreInput {
  name: string;
  /** 운영단체. v2 명세서 미포함 필드 — 백엔드가 organization 을 받으면 저장됨 */
  org?: string;
  takeoutEnabled?: boolean;
  /** 생략 시 DEFAULT_TABLE_COUNT(32) */
  tableCount?: number;
  /** 운영자가 사전 설정하는 주점 로그인 자격증명 */
  username: string;
  password: string;
}

export interface CreateStoreResult {
  store: { id: string; name: string } | null;
  syncedToServer: boolean;
  error?: string;
}

export async function createStore(input: CreateStoreInput): Promise<CreateStoreResult> {
  try {
    const created = await adminApi.stores.create({
      name: input.name,
      organization: input.org,
      takeoutEnabled: input.takeoutEnabled,
      tableCount: input.tableCount ?? DEFAULT_TABLE_COUNT,
      username: input.username,
      password: input.password,
    });
    return {
      store: { id: String(created.id), name: created.name ?? input.name },
      syncedToServer: true,
    };
  } catch (e) {
    return {
      store: null,
      syncedToServer: false,
      error: e instanceof ApiError ? `${e.code} · ${e.message}` : "서버 저장 실패",
    };
  }
}
