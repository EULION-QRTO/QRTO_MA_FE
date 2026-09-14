/**
 * QRTO API 명세서 엔드포인트 래퍼. (springdoc 자동생성, 2026-09-14 최신화)
 * base URL 은 config.API_BASE_URL(= https://api.lapy.shop) 로 고정.
 *
 * - authApi   : /api/auth        (로그인 · 세션 확인, 관리자·포스 통합)
 * - posApi 계열 : /api/pos/**     🔐 STORE — 매장은 JWT 토큰에서 식별(경로에 storeId 없음).
 *   단, 2026-09-14 명세서엔 모든 /api/pos/** 엔드포인트가 필수 쿼리 storeId(long)로 문서화돼
 *   있다(섹션 설명 자체는 "경로에 storeId 없음"이라 커스텀 인자 리졸버를 springdoc 이 일반
 *   쿼리 파라미터로 오인했을 가능성이 높지만) — 서버가 무시해도 무해하니 안전하게 세션의
 *   storeId 를 함께 실어 보낸다 (posQuery 참고).
 * - adminApi  : /api/admin/**    🛡 ADMIN — 운영자 대시보드용(매장별 조회는 storeId 경로)
 */
import { http, fetchImageObjectUrl, fetchFile } from "./api";
import { getSession } from "./session";
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
type Query = Record<string, string | number | boolean | undefined>;

/** /api/pos/** 쿼리에 세션의 storeId 를 얹는다. (파일 상단 설명 참고) */
const posQuery = (extra?: Query): Query => ({ storeId: getSession()?.storeId, ...extra });

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
  get: () => http.get<StoreResponse>("/api/pos/store", { query: posQuery() }),
  /** PATCH /api/pos/store — 보낸 필드만 변경 */
  update: (patch: UpdateStoreRequest) =>
    http.patch<StoreResponse>("/api/pos/store", { query: posQuery(), body: patch }),
  /** PATCH /api/pos/store/open — 영업 개폐(장사 시작/종료) */
  setOpen: (open: boolean) =>
    http.patch<StoreResponse>("/api/pos/store/open", { query: posQuery(), body: { open } }),
};

/* ── 카테고리 ── */
export const categoryApi = {
  /** GET /api/pos/categories (sortOrder 순) */
  list: () => http.get<CategoryResponse[]>("/api/pos/categories", { query: posQuery() }),
  /** POST /api/pos/categories */
  create: (name: string, sortOrder: number) =>
    http.post<CategoryResponse>("/api/pos/categories", { query: posQuery(), body: { name, sortOrder } }),
  /** PATCH /api/pos/categories/{categoryId} */
  update: (categoryId: number, patch: { name?: string; sortOrder?: number }) =>
    http.patch<CategoryResponse>(`/api/pos/categories/${categoryId}`, { query: posQuery(), body: patch }),
  /** DELETE /api/pos/categories/{categoryId} */
  remove: (categoryId: number) =>
    http.delete<null>(`/api/pos/categories/${categoryId}`, { query: posQuery() }),
};

/* ── 메뉴 ── */
export const menuApi = {
  /** GET /api/pos/menus */
  list: (categoryId?: number) =>
    http.get<MenuResponse[]>("/api/pos/menus", { query: posQuery({ categoryId }) }),
  /** GET /api/pos/menus/{menuId} */
  get: (menuId: number) => http.get<MenuResponse>(`/api/pos/menus/${menuId}`, { query: posQuery() }),
  /** POST /api/pos/menus */
  create: (req: CreateMenuRequest) =>
    http.post<MenuResponse>("/api/pos/menus", { query: posQuery(), body: req }),
  /** PATCH /api/pos/menus/{menuId} — 보낸 필드만 변경 */
  update: (menuId: number, patch: UpdateMenuRequest) =>
    http.patch<MenuResponse>(`/api/pos/menus/${menuId}`, { query: posQuery(), body: patch }),
  /** PATCH /api/pos/menus/{menuId}/sold-out */
  setSoldOut: (menuId: number, soldOut: boolean) =>
    http.patch<MenuResponse>(`/api/pos/menus/${menuId}/sold-out`, { query: posQuery(), body: { soldOut } }),
  /**
   * POST /api/pos/menus/{menuId}/image — 메뉴 사진 업로드(교체).
   * JPEG/PNG/WebP, 5MB·한 변 12000px 이하. 서버가 리사이즈해 S3 URL 로 imageUrl 갱신.
   */
  uploadImage: (menuId: number, file: File) => {
    const form = new FormData();
    form.append("file", file);
    return http.post<MenuResponse>(`/api/pos/menus/${menuId}/image`, { query: posQuery(), form });
  },
  /** DELETE /api/pos/menus/{menuId}/image — 사진 삭제(imageUrl=null) */
  removeImage: (menuId: number) =>
    http.delete<MenuResponse>(`/api/pos/menus/${menuId}/image`, { query: posQuery() }),
  /** DELETE /api/pos/menus/{menuId} */
  remove: (menuId: number) => http.delete<null>(`/api/pos/menus/${menuId}`, { query: posQuery() }),
};

/* ── 테이블 · QR ── */
export const tableApi = {
  /** GET /api/pos/tables */
  list: () => http.get<TableResponse[]>("/api/pos/tables", { query: posQuery() }),
  /** GET /api/pos/tables/{tableId} */
  get: (tableId: number) => http.get<TableResponse>(`/api/pos/tables/${tableId}`, { query: posQuery() }),
  /** POST /api/pos/tables */
  create: (name: string) =>
    http.post<TableResponse>("/api/pos/tables", { query: posQuery(), body: { name } }),
  /** PATCH /api/pos/tables/{tableId} */
  rename: (tableId: number, name: string) =>
    http.patch<TableResponse>(`/api/pos/tables/${tableId}`, { query: posQuery(), body: { name } }),
  /** DELETE /api/pos/tables/{tableId} */
  remove: (tableId: number) => http.delete<null>(`/api/pos/tables/${tableId}`, { query: posQuery() }),
  /** PUT /api/pos/tables/bulk — 개수 일괄 설정(0~100). 응답은 전체 테이블 목록 */
  bulk: (count: number) =>
    http.put<TableResponse[]>("/api/pos/tables/bulk", { query: posQuery(), body: { count } }),
  /** POST /api/pos/tables/{tableId}/clear — 테이블 정리(청산). 진행중 주문 일괄 SERVED */
  clear: (tableId: number) =>
    http.post<ClearTableResponse>(`/api/pos/tables/${tableId}/clear`, { query: posQuery() }),
  /** 테이블 QR PNG object URL */
  qrImageUrl: (tableId: number) =>
    fetchImageObjectUrl(`/api/pos/tables/${tableId}/qr-image`, posQuery()),
  /** 매장 픽업 QR PNG object URL */
  pickupQrImageUrl: () => fetchImageObjectUrl("/api/pos/pickup-qr-image", posQuery()),
};

/* ── 포스 메인: 테이블 현황 ── */
export const tableStatusApi = {
  /** GET /api/pos/table-status — elapsedMinutes 는 서버 계산값, 클라이언트에서 재계산 금지 */
  list: () => http.get<TableStatusResponse[]>("/api/pos/table-status", { query: posQuery() }),
};

/* ── 주문 ── */
export const orderApi = {
  /** GET /api/pos/orders?status=&type= (전화번호 원본) */
  list: (filter?: OrderFilter) =>
    http.get<OrderResponse[]>("/api/pos/orders", { query: posQuery({ ...filter }) }),
  /**
   * PATCH /api/pos/orders/{orderId}/status
   * 허용 전이: RECEIVED→PREPARING→COOKED→SERVED(DINE_IN)/PICKED_UP(TAKEOUT), 각 단계에서 CANCELED.
   * SERVED 는 이 API 로 보내지 않는다 — 테이블 청산(tableApi.clear) 전용.
   * 결제된 주문을 CANCELED 로 바꾸면 서버가 페이앱 환불을 먼저 시도하고, 실패 시 400 P004
   * (주문은 그대로 유지) — ApiError.message 를 그대로 보여주면 된다.
   */
  setStatus: (orderId: number, status: OrderStatus) =>
    http.patch<OrderResponse>(`/api/pos/orders/${orderId}/status`, { query: posQuery(), body: { status } }),
};

/* ── 직원 호출 ── */
export const staffCallApi = {
  /** GET /api/pos/staff-calls?onlyActive= */
  list: (onlyActive?: boolean) =>
    http.get<StaffCallResponse[]>("/api/pos/staff-calls", { query: posQuery({ onlyActive }) }),
  /** PATCH /api/pos/staff-calls/{callId}/resolve */
  resolve: (callId: number) =>
    http.patch<StaffCallResponse>(`/api/pos/staff-calls/${callId}/resolve`, { query: posQuery() }),
};

/* ── 매출 ── */
export const salesApi = {
  /** GET /api/pos/sales/summary?date= — date 생략 시 오늘(Asia/Seoul) */
  summary: (date?: string) =>
    http.get<SalesSummaryResponse>("/api/pos/sales/summary", { query: posQuery({ date }) }),
  /** GET /api/pos/sales/orders?type= — 누적 주문(시간순, 결제 확정분만) */
  orders: (type?: OrderType) =>
    http.get<OrderResponse[]>("/api/pos/sales/orders", { query: posQuery({ type }) }),
  /** GET /api/pos/sales/export?type= — CSV(BOM) 다운로드 */
  exportCsv: (type?: OrderType) =>
    fetchFile("/api/pos/sales/export", { query: posQuery(type ? { type } : undefined) }),
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
    qrImageUrl: (storeId: string | number, tableId: number) =>
      fetchImageObjectUrl(`/api/admin/stores/${storeId}/tables/${tableId}/qr-image`),
  },
  pickupQrImageUrl: (storeId: string | number) =>
    fetchImageObjectUrl(`/api/admin/stores/${storeId}/pickup-qr-image`),
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
