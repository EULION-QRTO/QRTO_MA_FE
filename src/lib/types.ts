export interface OrderItem {
  name: string;
  qty: number;
  price: number;
}

/** 메뉴 분류 */
export type MenuCategory = "메뉴" | "기타";

export const MENU_CATEGORIES: MenuCategory[] = ["메뉴", "기타"];

export const DEFAULT_MENU_CATEGORY: MenuCategory = "메뉴";

export interface MenuItem {
  id: string;
  name: string;
  price: number;
  category: MenuCategory;
  /** 품절 여부 */
  soldOut: boolean;
  /** 선택 첨부 이미지 (서버 imageUrl 을 절대 URL 로 변환한 값) */
  image?: string;
}

/** 정산 계좌 — 주문 후 고객 송금 대상 계좌 */
export interface SettlementAccount {
  /** 은행명 */
  bank: string;
  /** 계좌번호 */
  number: string;
  /** 예금주 */
  holder: string;
}

export interface TableOrder {
  items: OrderItem[];
  /** epoch ms — 주문 시작 시각 */
  startedAt: number;
  /** 이 테이블에 묶인 주문 ID 목록 (table-status 기준) */
  orderIds?: number[];
}

export interface Table {
  id: number;
  number: number;
  order: TableOrder | null;
  /** 직원 호출 진행중 여부 (table-status 기준) */
  staffCallActive?: boolean;
}

export type WaitStage = "received" | "preparing" | "cooked" | "picked-up";
export type WaitType = "dine-in" | "takeout";

/** 상태 라벨 */
export const STAGE_LABEL: Record<WaitStage, string> = {
  received: "주문 접수",
  preparing: "준비중",
  cooked: "조리완료",
  "picked-up": "픽업완료",
};

/** 주문 유형별 선택 가능한 상태 목록 */
export const STAGES_BY_TYPE: Record<WaitType, WaitStage[]> = {
  "dine-in": ["received", "preparing", "cooked"],
  takeout: ["received", "preparing", "cooked", "picked-up"],
};

/** 유형별 완료(목록에서 제거) 상태 */
export const TERMINAL_STAGE: Record<WaitType, WaitStage> = {
  "dine-in": "cooked",
  takeout: "picked-up",
};

export interface WaitingOrder {
  id: string;
  type: WaitType;
  /** dine-in 일 때 테이블 번호 */
  tableNumber?: number;
  /** takeout 일 때 주문번호 */
  orderNo?: string;
  /** takeout 일 때 픽업 예정 시각 (epoch ms) */
  pickupAt?: number;
  items: OrderItem[];
  createdAt: number;
  stage: WaitStage;
  /** 신규 도착 하이라이트 여부 */
  isNew?: boolean;
}

export const orderTotal = (items: OrderItem[]): number =>
  items.reduce((sum, it) => sum + it.price * it.qty, 0);

export const formatKRW = (n: number): string => `${n.toLocaleString("ko-KR")}원`;
