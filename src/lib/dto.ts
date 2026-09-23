/**
 * 백엔드(QRTO-API) 응답/요청 DTO.
 *
 * 모든 REST 응답은 공통 envelope 로 감싸진다:
 *   { "success": true,  "data": <T> }
 *   { "success": false, "error": { "code": "A002", "message": "..." } }
 * (단, 이미지 바이트/일부 배열 응답 예외는 endpoints 계층에서 처리한다.)
 */

/** 공통 응답 envelope */
export interface ApiEnvelope<T> {
  success: boolean;
  data?: T;
  error?: { code: string; message: string };
}

/* ── 인증 ── */
export type UserRole = "ADMIN" | "STORE";

export interface LoginResponse {
  accessToken: string;
  /** 만료까지 남은 초 (기본 12h = 43200). /me 는 남은 초. */
  expiresIn: number;
  /** 프론트 화면 분기 기준 */
  role: UserRole;
  /** STORE 만. ADMIN 은 null */
  storeId: number | null;
  /** STORE 만. ADMIN 은 null */
  storeName: string | null;
}

/* ── 매장 ── */
/** 매장 개설 요청 (관리자) — POST /api/admin/stores */
export interface StoreCreateRequest {
  /** ≤100 */
  name: string;
  /**
   * 운영단체(주점을 운영하는 단체/학과 등).
   * ⚠️ v2 명세서에 아직 없는 필드 — 백엔드가 store 스키마·응답에 `organization` 을 추가해야 실제로 저장/조회됨.
   */
  organization?: string;
  /** ≤50, 전체 유일 — 포스 로그인 아이디 */
  username: string;
  /** ≥8 */
  password: string;
  /** ≤500 */
  logoUrl?: string;
  /** 기본 false */
  takeoutEnabled?: boolean;
  /** 0~100, 기본 0 */
  tableCount?: number;
  bankName?: string;
  accountNumber?: string;
  accountHolder?: string;
}
export interface StoreResponse {
  id: number;
  name: string;
  /**
   * 운영단체. ⚠️ v2 명세서 미포함 — 백엔드가 응답에 `organization` 을 추가하기 전까지 undefined.
   * (프론트는 없으면 표시를 생략한다)
   */
  organization?: string | null;
  logoUrl: string | null;
  takeoutEnabled: boolean;
  /** 영업중 여부 */
  open: boolean;
  tableCount: number;
  bankName: string | null;
  accountNumber: string | null;
  accountHolder: string | null;
  pickupToken: string | null;
  createdAt: string;
  updatedAt: string;
}

/** GET /api/admin/stores 항목 — StoreResponse + 관리자 집계 */
export interface AdminStoreResponse {
  id: number;
  name: string;
  /** 운영단체. ⚠️ v2 명세서 미포함 (백엔드 추가 대기) */
  organization?: string | null;
  logoUrl: string | null;
  takeoutEnabled: boolean;
  open: boolean;
  tableCount: number;
  /** 정산 계좌 (StoreResponse 와 동일 — 백엔드 목록 응답에 포함 시 사용) */
  bankName?: string | null;
  accountNumber?: string | null;
  accountHolder?: string | null;
  /** 포스 로그인 아이디 */
  username: string;
  /** 오늘 매출(취소 제외) */
  todaySales: number;
  /** 진행중 주문 수(RECEIVED·PREPARING·COOKED) */
  activeOrderCount: number;
  createdAt: string;
}

/** GET /api/admin/sales/summary — 전 매장 매출 합산 */
export interface AdminSalesSummaryResponse {
  date: string;
  totalSales: number;
  orderCount: number;
  stores: {
    storeId: number;
    storeName: string;
    open: boolean;
    totalSales: number;
    orderCount: number;
  }[];
}

/** PATCH /api/pos/store · PATCH /api/admin/stores/{storeId} — 전 필드 선택 */
export interface UpdateStoreRequest {
  name?: string;
  /** 운영단체. ⚠️ v2 명세서 미포함 (백엔드 추가 대기) */
  organization?: string;
  logoUrl?: string | null;
  takeoutEnabled?: boolean;
  tableCount?: number;
  bankName?: string;
  accountNumber?: string;
  accountHolder?: string;
}

/* ── 카테고리 ── */
export interface CategoryResponse {
  id: number;
  storeId: number;
  name: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

/* ── 메뉴 ── */
export interface MenuResponse {
  id: number;
  storeId: number;
  categoryId: number;
  name: string;
  price: number;
  description: string | null;
  imageUrl: string | null;
  soldOut: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateMenuRequest {
  categoryId: number;
  name: string;
  price: number;
  description?: string | null;
  imageUrl?: string | null;
}

export interface UpdateMenuRequest {
  categoryId?: number;
  name?: string;
  price?: number;
  description?: string | null;
  imageUrl?: string | null;
}

/* ── 테이블 ── */
export interface TableResponse {
  id: number;
  storeId: number;
  name: string;
  qrToken: string;
  qrUrl: string;
  qrImageUrl: string;
  createdAt: string;
  updatedAt: string;
}

/* ── 포스 메인: 테이블 현황 ── */
export interface TableStatusItemSummary {
  menuName: string;
  quantity: number;
  unitPrice: number;
}

export interface TableStatusResponse {
  tableId: number;
  name: string;
  occupied: boolean;
  /** ISO 문자열, 빈 테이블이면 null */
  startedAt: string | null;
  elapsedMinutes: number | null;
  totalPrice: number;
  orderCount: number;
  itemSummary: TableStatusItemSummary[];
  orderIds: number[];
  staffCallActive: boolean;
  /** 그 테이블 진행중 주문 중 미결제 금액(카운터에서 받을 금액) — 2026-09-24 추가 */
  unpaidTotal: number;
}

/** POST /api/pos/tables/{tableId}/clear */
export interface ClearTableResponse {
  tableId: number;
  clearedOrderIds: number[];
  clearedCount: number;
  resolvedStaffCalls: number;
}
/** 명세서 표기 별칭 */
export type TableClearResponse = ClearTableResponse;

/* ── 주문 ── */
export type OrderType = "DINE_IN" | "TAKEOUT";
export type OrderStatus =
  | "PENDING_PAYMENT"
  | "RECEIVED"
  | "PREPARING"
  | "COOKED"
  | "SERVED"
  | "PICKED_UP"
  | "CANCELED";

export interface OrderItemResponse {
  menuId: number;
  menuName: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
}

/** 주문 경로 — 손님 QR 주문 / 포스 직접 주문(카운터) */
export type OrderSource = "CUSTOMER" | "POS";
/** 결제 수단. 미결제 주문은 null */
export type PaymentMethod = "PAYAPP" | "CASH" | "TRANSFER" | "FREE";

export interface OrderResponse {
  id: number;
  storeId: number;
  orderType: OrderType;
  orderTypeLabel: string;
  tableId: number | null;
  /** DINE_IN. 스냅샷 */
  tableName: string | null;
  phoneNumber: string | null;
  pickupNo: string | number | null;
  status: OrderStatus;
  statusLabel: string;
  totalPrice: number;
  items: OrderItemResponse[];
  createdAt: string;
  /** 손님 QR 주문 / 포스 직접 주문(카운터) — 2026-09-24 추가 */
  source: OrderSource;
  /** 결제 완료 여부. 포스 주문은 접수돼도 결제 전엔 false — 2026-09-24 추가 */
  paid: boolean;
  /** 미결제면 null — 2026-09-24 추가 */
  paymentMethod: PaymentMethod | null;
  /** 결제 확정 시각, 미결제면 null — 2026-09-24 추가 */
  paidAt: string | null;
}

/* ── 카운터 결제(현금·계좌이체) — 2026-09-24 추가 ── */

/** POST /api/pos/tables/{tableId}/orders — 포스 직접 주문 */
export interface PosOrderCreateRequest {
  /** 1~50, menuId 중복 불가 */
  items: { menuId: number; quantity: number }[];
}

/** POST /api/pos/orders/{orderId}/payment · POST /api/pos/tables/{tableId}/payment 요청 */
export interface CounterPaymentRequest {
  method: "CASH" | "TRANSFER";
}

/** 카운터 결제 확인 응답 */
export interface PaymentResponse {
  paymentId: number;
  orderId: number;
  amount: number;
  /** 명세서 확인된 값은 "PAID" 뿐 — 그 외는 원문 그대로 통과 */
  status: "PAID" | string;
  method: PaymentMethod;
  payType: string | null;
  payUrl: string | null;
  approvedAt: string;
  order: OrderResponse;
}

/** GET /api/pos/tables/{tableId}/orders · GET /api/admin/stores/{storeId}/tables/{tableId}/orders */
export interface TableOrdersResponse {
  tableId: number;
  name: string;
  /** 진행중 + 결제대기 + 미결제 종료(후불 서빙완료) — 취소 제외, 오래된 순 */
  orders: OrderResponse[];
  /** 카운터에서 받을 금액 */
  unpaidTotal: number;
  paidTotal: number;
  unpaidOrderIds: number[];
}

/* ── 직원 호출 ── */
export type StaffCallStatus = "CALLED" | "RESOLVED";
export interface StaffCallResponse {
  id: number;
  storeId: number;
  tableId: number;
  status: StaffCallStatus;
  createdAt: string;
  resolvedAt?: string | null;
}

/* ── 매출 ── */
/** 결제수단별 매출 합산. UNPAID 는 아직 못 받은 후불(카운터 미결제) 금액 — 마감 때 0이어야 함 */
export interface SalesByMethod {
  PAYAPP: number;
  CASH: number;
  TRANSFER: number;
  FREE: number;
  UNPAID: number;
}

export interface SalesSummaryResponse {
  date: string;
  dineInSales: number;
  takeoutSales: number;
  totalSales: number;
  orderCount: number;
  dineInOrderCount: number;
  takeoutOrderCount: number;
  avgOrderPrice: number;
  canceledCount: number;
  /** 축제 누적 매출 */
  cumulativeSales: number;
  /** 결제수단별 합산 — 2026-09-24 추가 */
  salesByMethod: SalesByMethod;
}

/* ── 실시간(STOMP) 이벤트 ── */
export interface OrderEvent {
  storeId: number;
  type: "NEW_ORDER" | "STATUS_CHANGED";
  order: OrderResponse;
}

export interface StaffCallEvent {
  storeId: number;
  type: "CALLED" | "RESOLVED";
  call: StaffCallResponse;
}
