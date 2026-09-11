/**
 * 운영자 대시보드의 매장 목록 — 단일 소스.
 *
 * 이전에는 각 탭이 제각기 localStorage(watchlist)를 읽어, 서버에 등록된 매장이
 * 있어도 "테스트 주점"(기본값 id=1)만 보이는 문제가 있었다.
 * 이제 GET /api/admin/stores 를 정본으로 쓰고, 운영단체(organization)만 로컬 메타로 보강한다.
 * localStorage 는 조회 실패 시 폴백 캐시로만 사용한다.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { adminApi } from "@/lib/endpoints";
import { ApiError } from "@/lib/api";
import { getManagedStores, setManagedStores } from "@/lib/operator";

export interface OpStore {
  id: string;
  name: string;
  /** 운영단체. 서버 값 우선, 없으면 로컬 메타 */
  organization?: string;
  takeoutEnabled: boolean;
  open: boolean;
  tableCount: number;
  /** 포스 로그인 아이디 */
  username?: string;
  /** GET /api/admin/stores 가 함께 주는 집계 */
  todaySales?: number;
  activeOrderCount?: number;
  /** 정산 계좌 (목록 응답에 있으면) */
  bankName?: string | null;
  accountNumber?: string | null;
  accountHolder?: string | null;
}

interface StoresValue {
  stores: OpStore[];
  loading: boolean;
  /** 서버 조회 실패 메시지 (이때 stores 는 로컬 캐시 폴백) */
  error: string | null;
  refresh: () => Promise<void>;
}

const StoresCtx = createContext<StoresValue | null>(null);

/** 서버 조회 실패 시 폴백: 숫자 id(=서버에 실제 존재) 로컬 캐시만 */
function fromLocalCache(): OpStore[] {
  return getManagedStores()
    .filter((s) => /^\d+$/.test(s.id))
    .map((s) => ({
      id: s.id,
      name: s.name ?? `매장 #${s.id}`,
      organization: s.org,
      takeoutEnabled: s.takeoutEnabled ?? false,
      open: false,
      tableCount: 0,
      username: s.username,
    }))
    .sort((a, b) => Number(a.id) - Number(b.id));
}

export function StoresProvider({ children }: { children: ReactNode }) {
  const [stores, setStores] = useState<OpStore[]>(() => fromLocalCache());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await adminApi.stores.list();
      const localOrg = new Map(getManagedStores().map((s) => [s.id, s.org]));
      const mapped: OpStore[] = list
        .map((s) => ({
          id: String(s.id),
          name: s.name,
          organization: s.organization ?? localOrg.get(String(s.id)) ?? undefined,
          takeoutEnabled: s.takeoutEnabled,
          open: s.open,
          tableCount: s.tableCount,
          username: s.username,
          todaySales: s.todaySales,
          activeOrderCount: s.activeOrderCount,
          bankName: s.bankName,
          accountNumber: s.accountNumber,
          accountHolder: s.accountHolder,
        }))
        .sort((a, b) => Number(a.id) - Number(b.id));
      setStores(mapped);
      // 로컬 캐시 갱신 (다음 세션/오프라인 대비)
      setManagedStores(
        mapped.map((s) => ({
          id: s.id,
          name: s.name,
          org: s.organization,
          takeoutEnabled: s.takeoutEnabled,
          username: s.username,
          synced: true,
        })),
      );
    } catch (e) {
      setError(
        e instanceof ApiError
          ? `매장 목록을 불러오지 못했습니다 (${e.code}). 로컬 캐시를 표시합니다.`
          : "매장 목록을 불러오지 못했습니다. 로컬 캐시를 표시합니다.",
      );
      setStores(fromLocalCache());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <StoresCtx.Provider value={{ stores, loading, error, refresh }}>
      {children}
    </StoresCtx.Provider>
  );
}

export function useStores(): StoresValue {
  const v = useContext(StoresCtx);
  if (!v) throw new Error("useStores must be used within <StoresProvider>");
  return v;
}

/** 운영단체(로컬 메타) 수정 — 서버에 organization 필드가 없을 때의 임시 저장소 */
export function setStoreOrgMeta(id: string, org: string): void {
  const list = getManagedStores();
  const idx = list.findIndex((s) => s.id === id);
  const next = org.trim() || undefined;
  if (idx >= 0) list[idx] = { ...list[idx], org: next };
  else list.push({ id, org: next });
  setManagedStores(list);
}
