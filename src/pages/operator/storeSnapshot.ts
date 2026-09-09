import { adminApi } from "@/lib/endpoints";
import { ApiError } from "@/lib/api";

/** 진행 중으로 볼 주문 상태 */
export const ACTIVE_STATUSES = ["RECEIVED", "PREPARING", "COOKED"];

export interface StoreSnapshot {
  id: string;
  online: boolean;
  error?: string;
  name?: string;
  tableCount?: number;
  occupied?: number;
  staffCalls?: number;
  activeOrders?: number;
  totalSales?: number;
  orderCount?: number;
  canceledCount?: number;
}

/** 매장 하나의 현황을 여러 API 로 모아 스냅샷 생성. 실패 시 online:false. */
export async function fetchSnapshot(id: string): Promise<StoreSnapshot> {
  try {
    const [store, summary, tables, orders] = await Promise.all([
      adminApi.stores.get(id),
      adminApi.sales.summary(id),
      adminApi.tableStatus(id),
      adminApi.orders(id),
    ]);
    return {
      id,
      online: true,
      name: store.name,
      tableCount: store.tableCount,
      occupied: tables.filter((t) => t.occupied).length,
      staffCalls: tables.filter((t) => t.staffCallActive).length,
      activeOrders: orders.filter((o) => ACTIVE_STATUSES.includes(o.status)).length,
      totalSales: summary.totalSales,
      orderCount: summary.orderCount,
      canceledCount: summary.canceledCount,
    };
  } catch (e) {
    return {
      id,
      online: false,
      error: e instanceof ApiError ? `${e.code} · ${e.message}` : "불러오기 실패",
    };
  }
}
