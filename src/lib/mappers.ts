/**
 * 백엔드 DTO ↔ 화면(view) 타입 변환.
 * 기존 UI 컴포넌트가 쓰던 타입(Table/WaitingOrder/MenuItem/SettlementAccount)을 그대로 유지하고,
 * 여기서 매핑만 담당한다.
 */
import type {
  TableStatusResponse,
  OrderResponse,
  OrderStatus,
  MenuResponse,
  CategoryResponse,
  StoreResponse,
} from "./dto";
import {
  Table,
  WaitingOrder,
  WaitStage,
  WaitType,
  MenuItem,
  MenuCategory,
  MENU_CATEGORIES,
  DEFAULT_MENU_CATEGORY,
  SettlementAccount,
} from "./types";
import { resolveAssetUrl } from "./config";

/** 서버 시각("2026-07-15T18:32:11.123456", TZ 없음 = KST)을 epoch ms 로. 소수점 이하는 ms 로 절삭. */
export function parseServerTime(iso: string | null | undefined): number {
  if (!iso) return Date.now();
  const trimmed = iso.replace(/(\.\d{3})\d+$/, "$1"); // 마이크로초 → 밀리초
  const ms = Date.parse(trimmed);
  return Number.isNaN(ms) ? Date.now() : ms;
}

/** 테이블 이름("1번", "홀 2번")에서 번호 추출. 실패 시 fallback. */
function tableNumberFromName(name: string, fallback: number): number {
  const m = name.match(/\d+/);
  return m ? parseInt(m[0], 10) : fallback;
}

/** GET /table-status 항목 → Table */
export function toTable(ts: TableStatusResponse): Table {
  return {
    id: ts.tableId,
    number: tableNumberFromName(ts.name, ts.tableId),
    staffCallActive: ts.staffCallActive,
    order: ts.occupied
      ? {
          items: ts.itemSummary.map((s) => ({
            name: s.menuName,
            qty: s.quantity,
            price: s.unitPrice,
          })),
          startedAt: parseServerTime(ts.startedAt),
          orderIds: ts.orderIds,
        }
      : null,
  };
}

const STATUS_TO_STAGE: Partial<Record<OrderStatus, WaitStage>> = {
  RECEIVED: "received",
  PREPARING: "preparing",
  COOKED: "cooked",
  PICKED_UP: "picked-up",
};

const STAGE_TO_STATUS: Record<WaitStage, OrderStatus> = {
  received: "RECEIVED",
  preparing: "PREPARING",
  cooked: "COOKED",
  "picked-up": "PICKED_UP",
};

export function stageToStatus(stage: WaitStage): OrderStatus {
  return STAGE_TO_STATUS[stage];
}

/** 포스 대기 목록에 표시할 주문인지. (결제대기/종료 상태 제외, 유형별 종료단계 이전만) */
export function isActiveWaiting(o: OrderResponse): boolean {
  if (o.orderType === "DINE_IN") return o.status === "RECEIVED" || o.status === "PREPARING";
  // TAKEOUT: 픽업완료 전까지 노출
  return o.status === "RECEIVED" || o.status === "PREPARING" || o.status === "COOKED";
}

/** OrderResponse → WaitingOrder. tableId→번호 매핑은 table-status 에서 구성해 전달. */
export function toWaitingOrder(
  o: OrderResponse,
  tableNumberByTableId: Map<number, number>,
): WaitingOrder {
  const type: WaitType = o.orderType === "DINE_IN" ? "dine-in" : "takeout";
  return {
    id: String(o.id),
    type,
    tableNumber:
      o.tableId != null ? (tableNumberByTableId.get(o.tableId) ?? o.tableId) : undefined,
    orderNo: o.pickupNo != null ? String(o.pickupNo) : `#${o.id}`,
    items: o.items.map((i) => ({ name: i.menuName, qty: i.quantity, price: i.unitPrice })),
    createdAt: parseServerTime(o.createdAt),
    stage: STATUS_TO_STAGE[o.status] ?? "received",
  };
}

/** 카테고리명이 화면 분류(메뉴/기타)에 속하면 그대로, 아니면 기본값. */
function toMenuCategory(name: string | undefined): MenuCategory {
  return name && (MENU_CATEGORIES as string[]).includes(name)
    ? (name as MenuCategory)
    : DEFAULT_MENU_CATEGORY;
}

/** MenuResponse → MenuItem (categoryId → 카테고리명 매핑 전달) */
export function toMenuItem(m: MenuResponse, categoryNameById: Map<number, string>): MenuItem {
  return {
    id: String(m.id),
    name: m.name,
    price: m.price,
    category: toMenuCategory(categoryNameById.get(m.categoryId)),
    soldOut: m.soldOut,
    image: resolveAssetUrl(m.imageUrl),
  };
}

/** StoreResponse → 정산 계좌 뷰 */
export function toSettlementAccount(s: StoreResponse): SettlementAccount {
  return {
    bank: s.bankName ?? "",
    number: s.accountNumber ?? "",
    holder: s.accountHolder ?? "",
  };
}

/** 카테고리 목록 → id별 이름 맵 */
export function categoryNameMap(cats: CategoryResponse[]): Map<number, string> {
  return new Map(cats.map((c) => [c.id, c.name]));
}

/** 카테고리 목록 → 이름별 id 맵 */
export function categoryIdByName(cats: CategoryResponse[]): Map<string, number> {
  return new Map(cats.map((c) => [c.name, c.id]));
}
