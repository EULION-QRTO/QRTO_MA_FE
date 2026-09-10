/**
 * QRTO API 명세서(v2) 엔드포인트 래퍼.
 * base URL 은 config.API_BASE_URL(= https://api.lapy.shop) 로 고정.
 *
 * - authApi   : /api/auth        (로그인 · 세션 확인)
 * - posApi 계열 : /api/pos/**     🔐 STORE — 매장은 JWT 토큰에서 식별(경로에 storeId 없음)
 * - adminApi  : /api/admin/**    🛡 ADMIN — 운영자 대시보드용(매장별 조회는 storeId 경로)
 */
import { http, fetchImageObjectUrl, fetchFile } from "./api";
import type {
  LoginResponse,
  StoreResponse,
  StoreCreateRequest,
  AdminStoreResponse,
  AdminSalesSummaryResponse,
  UpdateStoreRequest,
  CategoryResponse,
  MenuResponse,
  CreateMenuRequest,
  UpdateMenuRequest,
  TableResponse,
  TableStatusResponse,
  ClearTableResponse,
  OrderResponse,
  OrderStatus,
  OrderType,
  StaffCallResponse,
  SalesSummaryResponse,
} from "./dto";

type OrderFilter = { status?: OrderStatus; type?: OrderType };

/** QR 이미지 옵션 (4개 qr-image 엔드포인트 공통) */
export interface QrImageOpts {
  /** true → 배경 투명 + 모듈 흰색 (어두운 배경에 얹을 때) */
  transparent?: boolean;
  /** 한 변 픽셀 (64~2000). 기본 512 */
  size?: number;
}
const qrImageQuery = (o?: QrImageOpts) =>
  o ? { transparent: o.transparent || undefined, size: o.size } : undefined;

/* ══════════ 인증 /api/auth ══════════ */
export const authApi = {
  /** POST /api/auth/login — 관리자·포스 공통 🌐 */
  login: (username: string, password: string) =>
    http.post<LoginResponse>("/api/auth/login", { body: { username, password }, auth: false }),
  /** GET /api/auth/me — 현재 토큰의 세션 확인(+매장 정보) 🔐🛡 */
  me: () => http.get<LoginResponse>("/api/auth/me"),
};

/* ══════════ 포스 /api/pos 🔐 (매장 = 토큰) ══════════ */

/* ── 매장 ── */
export const storeApi = {
  /** GET /api/pos/store */
  get: () => http.get<StoreResponse>("/api/pos/store"),
  /** PATCH /api/pos/store — 보낸 필드만 변경 */
  update: (patch: UpdateStoreRequest) => http.patch<StoreResponse>("/api/pos/store", { body: patch }),
  /** PATCH /api/pos/store/open — 영업 개폐 */
  setOpen: (open: boolean) => http.patch<StoreResponse>("/api/pos/store/open", { body: { open } }),
};

/* ── 카테고리 ── */
export const categoryApi = {
  /** GET /api/pos/categories (sortOrder 순) */
  list: () => http.get<CategoryResponse[]>("/api/pos/categories"),
  /** POST /api/pos/categories */
  create: (name: string, sortOrder: number) =>
    http.post<CategoryResponse>("/api/pos/categories", { body: { name, sortOrder } }),
  /** PATCH /api/pos/categories/{categoryId} */
  update: (categoryId: number, patch: { name?: string; sortOrder?: number }) =>
    http.patch<CategoryResponse>(`/api/pos/categories/${categoryId}`, { body: patch }),
  /** DELETE /api/pos/categories/{categoryId} */
  remove: (categoryId: number) => http.delete<null>(`/api/pos/categories/${categoryId}`),
};

/* ── 메뉴 ── */
export const menuApi = {
  /** GET /api/pos/menus */
  list: (categoryId?: number) => http.get<MenuResponse[]>("/api/pos/menus", { query: { categoryId } }),
  /** GET /api/pos/menus/{menuId} */
  get: (menuId: number) => http.get<MenuResponse>(`/api/pos/menus/${menuId}`),
  /** POST /api/pos/menus */
  create: (req: CreateMenuRequest) => http.post<MenuResponse>("/api/pos/menus", { body: req }),
  /** PATCH /api/pos/menus/{menuId} — 보낸 필드만 변경 */
  update: (menuId: number, patch: UpdateMenuRequest) =>
    http.patch<MenuResponse>(`/api/pos/menus/${menuId}`, { body: patch }),
  /** PATCH /api/pos/menus/{menuId}/sold-out */
  setSoldOut: (menuId: number, soldOut: boolean) =>
    http.patch<MenuResponse>(`/api/pos/menus/${menuId}/sold-out`, { body: { soldOut } }),
  /** DELETE /api/pos/menus/{menuId} */
  remove: (menuId: number) => http.delete<null>(`/api/pos/menus/${menuId}`),
};

/* ── 테이블 · QR ── */
export const tableApi = {
  /** GET /api/pos/tables */
  list: () => http.get<TableResponse[]>("/api/pos/tables"),
  /** GET /api/pos/tables/{tableId} */
  get: (tableId: number) => http.get<TableResponse>(`/api/pos/tables/${tableId}`),
  /** POST /api/pos/tables */
  create: (name: string) => http.post<TableResponse>("/api/pos/tables", { body: { name } }),
  /** PATCH /api/pos/tables/{tableId} */
  rename: (tableId: number, name: string) =>
    http.patch<TableResponse>(`/api/pos/tables/${tableId}`, { body: { name } }),
  /** DELETE /api/pos/tables/{tableId} */
  remove: (tableId: number) => http.delete<null>(`/api/pos/tables/${tableId}`),
  /** PUT /api/pos/tables/bulk — 개수 일괄 설정(0~100). 응답은 전체 테이블 목록 */
  bulk: (count: number) => http.put<TableResponse[]>("/api/pos/tables/bulk", { body: { count } }),
  /** POST /api/pos/tables/{tableId}/clear — 테이블 정리(청산) */
  clear: (tableId: number) => http.post<ClearTableResponse>(`/api/pos/tables/${tableId}/clear`),
  /** 테이블 QR PNG object URL. transparent=true → 흰 모듈/투명 배경, size(64~2000) */
  qrImageUrl: (tableId: number, opts?: QrImageOpts) =>
    fetchImageObjectUrl(`/api/pos/tables/${tableId}/qr-image`, qrImageQuery(opts)),
  /** 매장 픽업 QR PNG object URL */
  pickupQrImageUrl: (opts?: QrImageOpts) =>
    fetchImageObjectUrl("/api/pos/pickup-qr-image", qrImageQuery(opts)),
};

/* ── 포스 메인: 테이블 현황 ── */
export const tableStatusApi = {
  /** GET /api/pos/table-status */
  list: () => http.get<TableStatusResponse[]>("/api/pos/table-status"),
};

/* ── 주문 ── */
export const orderApi = {
  /** GET /api/pos/orders?status=&type= (전화번호 원본) */
  list: (filter?: OrderFilter) => http.get<OrderResponse[]>("/api/pos/orders", { query: { ...filter } }),
  /** PATCH /api/pos/orders/{orderId}/status */
  setStatus: (orderId: number, status: OrderStatus) =>
    http.patch<OrderResponse>(`/api/pos/orders/${orderId}/status`, { body: { status } }),
};

/* ── 직원 호출 ── */
export const staffCallApi = {
  /** GET /api/pos/staff-calls */
  list: () => http.get<StaffCallResponse[]>("/api/pos/staff-calls"),
  /** PATCH /api/pos/staff-calls/{callId}/resolve */
  resolve: (callId: number) =>
    http.patch<StaffCallResponse>(`/api/pos/staff-calls/${callId}/resolve`),
};

/* ── 매출 ── */
export const salesApi = {
  /** GET /api/pos/sales/summary?date= — date 생략 시 오늘(Asia/Seoul) */
  summary: (date?: string) =>
    http.get<SalesSummaryResponse>("/api/pos/sales/summary", { query: { date } }),
  /** GET /api/pos/sales/orders?type= — 누적 주문(시간순) */
  orders: (type?: OrderType) =>
    http.get<OrderResponse[]>("/api/pos/sales/orders", { query: { type } }),
  /** GET /api/pos/sales/export?type= — CSV(BOM) 다운로드 */
  exportCsv: (type?: OrderType) =>
    fetchFile("/api/pos/sales/export", { query: type ? { type } : undefined }),
};

/* ══════════ 관리자 /api/admin 🛡 (운영자 대시보드) ══════════ */
export const adminApi = {
  stores: {
    /** GET /api/admin/stores — 전 매장 목록 */
    list: () => http.get<AdminStoreResponse[]>("/api/admin/stores"),
    /** POST /api/admin/stores — 매장 개설 */
    create: (req: StoreCreateRequest) => http.post<StoreResponse>("/api/admin/stores", { body: req }),
    /** GET /api/admin/stores/{storeId} */
    get: (storeId: string | number) => http.get<StoreResponse>(`/api/admin/stores/${storeId}`),
    /** PATCH /api/admin/stores/{storeId} */
    update: (storeId: string | number, patch: UpdateStoreRequest) =>
      http.patch<StoreResponse>(`/api/admin/stores/${storeId}`, { body: patch }),
    /** PATCH /api/admin/stores/{storeId}/open */
    setOpen: (storeId: string | number, open: boolean) =>
      http.patch<StoreResponse>(`/api/admin/stores/${storeId}/open`, { body: { open } }),
    /** PATCH /api/admin/stores/open — 전 매장 일괄 개폐 */
    setOpenAll: (open: boolean) =>
      http.patch<{ open: boolean; updatedCount: number }>("/api/admin/stores/open", { body: { open } }),
    /** PATCH /api/admin/stores/{storeId}/account/password — 포스 비번 초기화 */
    resetPassword: (storeId: string | number, password: string) =>
      http.patch<null>(`/api/admin/stores/${storeId}/account/password`, { body: { password } }),
  },
  /** GET /api/admin/sales/summary?date= — 전 매장 매출 합산 */
  salesSummaryAll: (date?: string) =>
    http.get<AdminSalesSummaryResponse>("/api/admin/sales/summary", { query: { date } }),

  /* 매장 상세 미러 — 포스 API 와 응답 동일, 경로만 /api/admin/stores/{storeId}/… */
  tableStatus: (storeId: string | number) =>
    http.get<TableStatusResponse[]>(`/api/admin/stores/${storeId}/table-status`),
  orders: (storeId: string | number, filter?: OrderFilter) =>
    http.get<OrderResponse[]>(`/api/admin/stores/${storeId}/orders`, { query: { ...filter } }),
  staffCalls: (storeId: string | number) =>
    http.get<StaffCallResponse[]>(`/api/admin/stores/${storeId}/staff-calls`),
  categories: (storeId: string | number) =>
    http.get<CategoryResponse[]>(`/api/admin/stores/${storeId}/categories`),
  menus: (storeId: string | number) =>
    http.get<MenuResponse[]>(`/api/admin/stores/${storeId}/menus`),
  tables: {
    list: (storeId: string | number) =>
      http.get<TableResponse[]>(`/api/admin/stores/${storeId}/tables`),
    qrImageUrl: (storeId: string | number, tableId: number, opts?: QrImageOpts) =>
      fetchImageObjectUrl(
        `/api/admin/stores/${storeId}/tables/${tableId}/qr-image`,
        qrImageQuery(opts),
      ),
  },
  pickupQrImageUrl: (storeId: string | number, opts?: QrImageOpts) =>
    fetchImageObjectUrl(`/api/admin/stores/${storeId}/pickup-qr-image`, qrImageQuery(opts)),
  sales: {
    summary: (storeId: string | number, date?: string) =>
      http.get<SalesSummaryResponse>(`/api/admin/stores/${storeId}/sales/summary`, { query: { date } }),
    orders: (storeId: string | number, type?: OrderType) =>
      http.get<OrderResponse[]>(`/api/admin/stores/${storeId}/sales/orders`, { query: { type } }),
    exportCsv: (storeId: string | number, type?: OrderType) =>
      fetchFile(`/api/admin/stores/${storeId}/sales/export`, { query: type ? { type } : undefined }),
  },
};

/* ── 헬스체크 ── */
export const healthApi = {
  /** GET /api/health 🌐 */
  check: () => http.get<{ status: string; service: string; time: string }>("/api/health", { auth: false }),
};
