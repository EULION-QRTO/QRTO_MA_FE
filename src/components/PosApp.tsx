import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { logout as clearSession } from "@/lib/auth";
import { ApiError } from "@/lib/api";
import {
  storeApi,
  categoryApi,
  menuApi,
  tableStatusApi,
  orderApi,
  tableApi,
  salesApi,
  staffCallApi,
} from "@/lib/endpoints";
import { connectRealtime } from "@/lib/realtime";
import {
  toTable,
  toWaitingOrder,
  toMenuItem,
  toSettlementAccount,
  categoryNameMap,
  categoryIdByName,
  isActiveWaiting,
  stageToStatus,
} from "@/lib/mappers";
import type { CategoryResponse, SalesSummaryResponse } from "@/lib/dto";
import Header, { MainTab } from "@/components/Header";
import TableCard from "@/components/TableCard";
import Sidebar from "@/components/Sidebar";
import OrderDetailModal from "@/components/OrderDetailModal";
import AdminPanel from "@/components/AdminPanel";
import {
  Table,
  WaitingOrder,
  WaitStage,
  MenuItem,
  MenuCategory,
  SettlementAccount,
} from "@/lib/types";

interface Props {
  storeId: string;
  /** 로그인 응답의 매장명 — GET /api/pos/store 로 최신값을 받기 전까지의 초기값 */
  storeName: string;
}

export default function PosApp({ storeId, storeName: initialStoreName }: Props) {
  const navigate = useNavigate();
  const [tab, setTab] = useState<MainTab>("tables");

  // 헤더 표시용: 주점 이름 + 운영단체 (GET /api/pos/store 에서 채움)
  const [storeName, setStoreName] = useState<string>(initialStoreName);
  const [organization, setOrganization] = useState<string>("");

  const [tables, setTables] = useState<Table[]>([]);
  const [waiting, setWaiting] = useState<WaitingOrder[]>([]);
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<CategoryResponse[]>([]);
  const [account, setAccount] = useState<SettlementAccount>({ bank: "", number: "", holder: "" });
  const [tableCount, setTableCountState] = useState<number>(0);
  const [sales, setSales] = useState<SalesSummaryResponse | null>(null);
  const [storeOpen, setStoreOpen] = useState<boolean>(true);

  const [selected, setSelected] = useState<Table | null>(null);
  const [now, setNow] = useState<number>(() => Date.now());
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [online, setOnline] = useState(false);

  // 최신 tableId→번호 매핑 (실시간 이벤트 매핑용)
  const numMapRef = useRef<Map<number, number>>(new Map());

  /** ApiError 처리: 401 이면 로그인으로, 그 외엔 배너 표시 */
  const handleError = useCallback(
    (e: unknown, fallback: string) => {
      if (e instanceof ApiError && e.status === 401) {
        clearSession();
        navigate("/login?reason=auth", { replace: true });
        return;
      }
      const msg = e instanceof ApiError ? e.message : fallback;
      setNotice(msg);
      setTimeout(() => setNotice(null), 4000);
    },
    [navigate],
  );

  const applyTableStatus = useCallback(
    (list: Awaited<ReturnType<typeof tableStatusApi.list>>) => {
      const tbls = list.map(toTable);
      numMapRef.current = new Map(tbls.map((t) => [t.id, t.number]));
      setTables(tbls);
      return numMapRef.current;
    },
    [],
  );

  /** 테이블 현황 + 대기 주문 동시 갱신 */
  const reloadTablesAndOrders = useCallback(async () => {
    try {
      const [tsList, orders] = await Promise.all([
        tableStatusApi.list(),
        orderApi.list(),
      ]);
      const numMap = applyTableStatus(tsList);
      setWaiting(orders.filter(isActiveWaiting).map((o) => toWaitingOrder(o, numMap)));
    } catch (e) {
      handleError(e, "주문 현황을 불러오지 못했습니다.");
    }
  }, [applyTableStatus, handleError]);

  const reloadTables = useCallback(async () => {
    try {
      applyTableStatus(await tableStatusApi.list());
    } catch (e) {
      handleError(e, "테이블 현황을 불러오지 못했습니다.");
    }
  }, [applyTableStatus, handleError]);

  const reloadSales = useCallback(async () => {
    try {
      setSales(await salesApi.summary());
    } catch (e) {
      handleError(e, "매출 요약을 불러오지 못했습니다.");
    }
  }, [handleError]);

  /** 최초 전체 로드 */
  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const [store, cats, menus, tsList, orders, summary] = await Promise.all([
          storeApi.get(),
          categoryApi.list(),
          menuApi.list(),
          tableStatusApi.list(),
          orderApi.list(),
          salesApi.summary(),
        ]);
        if (!alive) return;
        setCategories(cats);
        const names = categoryNameMap(cats);
        setMenu(menus.map((m) => toMenuItem(m, names)));
        const numMap = applyTableStatus(tsList);
        setWaiting(orders.filter(isActiveWaiting).map((o) => toWaitingOrder(o, numMap)));
        setAccount(toSettlementAccount(store));
        setTableCountState(store.tableCount);
        setStoreOpen(store.open);
        if (store.name) setStoreName(store.name);
        setOrganization(store.organization ?? "");
        setSales(summary);
      } catch (e) {
        if (alive) handleError(e, "데이터를 불러오지 못했습니다. 서버 연결을 확인해 주세요.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [applyTableStatus, handleError]);

  // 시계 갱신 (경과시간 라이브 반영)
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(t);
  }, []);

  // 실시간(STOMP) 구독 — 주문/직원호출 이벤트 시 해당 데이터 재로드
  useEffect(() => {
    const disconnect = connectRealtime(storeId, {
      onOrder: () => {
        void reloadTablesAndOrders();
        void reloadSales();
      },
      onStaffCall: () => {
        void reloadTables();
      },
      onConnect: () => setOnline(true),
      onDisconnect: () => setOnline(false),
    });
    return disconnect;
  }, [storeId, reloadTablesAndOrders, reloadTables, reloadSales]);

  /**
   * 주문 상태 변경 (PATCH .../orders/{id}/status)
   * 드롭다운에서 고른 단계를 그대로(최종 값) 서버에 전달한다.
   * 앞으로 건너뛰기도, 실수 정정을 위한 되돌리기(예: 조리완료 → 조리중)도 모두 가능.
   */
  const setStage = async (id: string, stage: WaitStage) => {
    try {
      await orderApi.setStatus(Number(id), stageToStatus(stage));
      await reloadTablesAndOrders();
    } catch (e) {
      handleError(e, "주문 상태를 변경하지 못했습니다.");
    }
  };

  /** 주문 취소 (PATCH /api/pos/orders/{id}/status → CANCELED). 매출 요약에도 반영. */
  const cancelOrder = async (id: string) => {
    try {
      await orderApi.setStatus(Number(id), "CANCELED");
      await Promise.all([reloadTablesAndOrders(), reloadSales()]);
    } catch (e) {
      handleError(e, "주문을 취소하지 못했습니다.");
    }
  };

  /** 테이블 정리 (POST /api/pos/tables/{id}/clear) */
  const clearTable = async (tableId: number) => {
    try {
      await tableApi.clear(tableId);
      await Promise.all([reloadTablesAndOrders(), reloadSales()]);
    } catch (e) {
      handleError(e, "테이블을 정리하지 못했습니다.");
    }
  };

  /** 직원 호출 해제 — 테이블의 진행중(CALLED) 호출을 모두 RESOLVED 처리 */
  const resolveStaffCall = async (tableId: number) => {
    try {
      const calls = await staffCallApi.list();
      const targets = calls.filter((c) => c.tableId === tableId && c.status === "CALLED");
      if (targets.length === 0) {
        await reloadTables();
        return;
      }
      await Promise.all(targets.map((c) => staffCallApi.resolve(c.id)));
      await reloadTables();
    } catch (e) {
      handleError(e, "직원 호출을 해제하지 못했습니다.");
    }
  };

  /** 영업 개폐 (PATCH /api/pos/store/open) */
  const toggleStoreOpen = async () => {
    const next = !storeOpen;
    try {
      const store = await storeApi.setOpen(next);
      setStoreOpen(store.open);
    } catch (e) {
      handleError(e, "영업 상태를 변경하지 못했습니다.");
    }
  };

  /**
   * 테이블 개수 변경 (PUT /stores/{id}/tables/bulk)
   * 실제 테이블 행을 생성/삭제해 개수를 맞춘 뒤, 테이블 현황을 다시 불러와
   * POS 그리드에 즉시 반영한다. (store.tableCount 만 바꾸면 그리드는 갱신되지 않음)
   */
  const setTableCount = async (count: number) => {
    try {
      // 응답은 전체 테이블 목록(TableResponse[]).
      const tables = await tableApi.bulk(count);
      setTableCountState(Array.isArray(tables) ? tables.length : count);
      await reloadTablesAndOrders();
    } catch (e) {
      handleError(e, "테이블 개수를 변경하지 못했습니다.");
    }
  };

  const addMenuItem = async (name: string, price: number, category: MenuCategory) => {
    try {
      const idByName = categoryIdByName(categories);
      const categoryId = idByName.get(category) ?? categories[0]?.id;
      if (categoryId == null) {
        setNotice("카테고리가 없어 메뉴를 추가할 수 없습니다.");
        return;
      }
      const created = await menuApi.create({ categoryId, name, price });
      setMenu((prev) => [...prev, toMenuItem(created, categoryNameMap(categories))]);
    } catch (e) {
      handleError(e, "메뉴를 추가하지 못했습니다.");
    }
  };

  const updateMenuItem = async (
    id: string,
    patch: Partial<Omit<MenuItem, "id" | "image" | "soldOut">>,
  ) => {
    const apiPatch: { name?: string; price?: number; categoryId?: number } = {};
    if (patch.name !== undefined) apiPatch.name = patch.name;
    if (patch.price !== undefined) apiPatch.price = patch.price;
    if (patch.category !== undefined) {
      const cid = categoryIdByName(categories).get(patch.category);
      if (cid != null) apiPatch.categoryId = cid;
    }
    if (Object.keys(apiPatch).length === 0) return;
    try {
      const updated = await menuApi.update(Number(id), apiPatch);
      setMenu((prev) =>
        prev.map((m) => (m.id === id ? toMenuItem(updated, categoryNameMap(categories)) : m)),
      );
    } catch (e) {
      handleError(e, "메뉴를 수정하지 못했습니다.");
    }
  };

  /** 품절 토글 (PATCH /api/pos/menus/{id}/sold-out) */
  const toggleSoldOut = async (id: string, soldOut: boolean) => {
    try {
      const updated = await menuApi.setSoldOut(Number(id), soldOut);
      setMenu((prev) =>
        prev.map((m) => (m.id === id ? toMenuItem(updated, categoryNameMap(categories)) : m)),
      );
    } catch (e) {
      handleError(e, "품절 상태를 변경하지 못했습니다.");
    }
  };

  const deleteMenuItem = async (id: string) => {
    try {
      await menuApi.remove(Number(id));
      setMenu((prev) => prev.filter((m) => m.id !== id));
    } catch (e) {
      handleError(e, "메뉴를 삭제하지 못했습니다.");
    }
  };

  const saveAccount = async (acc: SettlementAccount) => {
    try {
      const store = await storeApi.update({
        bankName: acc.bank,
        accountNumber: acc.number,
        accountHolder: acc.holder,
      });
      setAccount(toSettlementAccount(store));
    } catch (e) {
      handleError(e, "정산 계좌를 저장하지 못했습니다.");
    }
  };

  const refresh = () => {
    setNow(Date.now());
    void reloadTablesAndOrders();
    void reloadSales();
  };

  const logout = () => {
    clearSession();
    navigate("/login", { replace: true });
  };

  const occupiedCount = tables.filter((t) => t.order).length;

  const todaySales = sales?.totalSales ?? 0;

  return (
    <div className="app">
      <Header
        storeName={storeName}
        organization={organization}
        todaySales={todaySales}
        storeOpen={storeOpen}
        onToggleOpen={toggleStoreOpen}
        activeTab={tab}
        onTabChange={setTab}
        onRefresh={refresh}
        onLogout={logout}
      />

      {notice && <div className="app__notice">{notice}</div>}

      {tab === "tables" ? (
        <div className="app__body">
          <main className="main">
            <div className="main__head">
              <h1 className="main__title">테이블 현황</h1>
              <span className="main__meta">
                {online ? "🟢 실시간" : "⚪ 오프라인"} · 사용중 {occupiedCount} / 전체 {tables.length}
              </span>
            </div>
            {loading ? (
              <p className="main__loading">불러오는 중…</p>
            ) : (
              <div className="table-grid">
                {tables.map((t) => (
                  <TableCard
                    key={t.id}
                    table={t}
                    now={now}
                    onOpen={setSelected}
                    onResolveStaffCall={resolveStaffCall}
                  />
                ))}
              </div>
            )}
          </main>

          <Sidebar orders={waiting} now={now} onSetStage={setStage} onCancel={cancelOrder} />
        </div>
      ) : (
        <div className="app__body">
          <AdminPanel
            tableCount={tableCount}
            onTableCountChange={setTableCount}
            menu={menu}
            onAddMenu={addMenuItem}
            onUpdateMenu={updateMenuItem}
            onToggleSoldOut={toggleSoldOut}
            onDeleteMenu={deleteMenuItem}
            account={account}
            onSaveAccount={saveAccount}
          />
        </div>
      )}

      {selected && (
        <OrderDetailModal
          table={selected}
          onClose={() => setSelected(null)}
          onClear={clearTable}
        />
      )}
    </div>
  );
}
