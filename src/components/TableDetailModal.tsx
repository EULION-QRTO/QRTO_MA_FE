import { useMemo, useState } from "react";
import {
  Table,
  MenuItem,
  MenuCategory,
  MENU_CATEGORIES,
  SettlementAccount,
  OrderItem,
  orderTotal,
  formatKRW,
} from "@/lib/types";
import { clock } from "@/lib/time";

type PayMethod = "cash" | "transfer";

interface Props {
  table: Table;
  /** 현금·계좌이체 주문에 고를 메뉴 (품절 포함 — 카드에서 비활성 처리) */
  menu: MenuItem[];
  /** 계좌이체 선택 시 보여줄 정산 계좌 (관리자 탭에서 등록) */
  account: SettlementAccount;
  onClose: () => void;
  onClear: (tableId: number) => void;
  /**
   * 현금·계좌이체 주문 접수.
   * TODO: 아직 서버 연동 전 — 지금은 전달돼도 화면(로컬)에서만 초기화된다.
   * 백엔드에 현금/계좌이체 주문 생성 API 가 생기면 PosApp 에서 실제 호출로 연결한다.
   */
  onSubmitManualOrder?: (input: { tableId: number; items: OrderItem[]; method: PayMethod }) => void;
}

/** 주문 내역 한 줄(빌링지 공통 포맷) — 기존 주문(섹션1)·신규 주문(섹션3) 모두 사용 */
function BillingRows({ items }: { items: OrderItem[] }) {
  return (
    <>
      {items.map((it, i) => (
        <div className="modal__row" key={i}>
          <span>
            <span className="modal__item-name">{it.name}</span>
            <span className="modal__item-qty">x{it.qty}</span>
          </span>
          <span className="modal__item-price">{formatKRW(it.price * it.qty)}</span>
        </div>
      ))}
    </>
  );
}

export default function TableDetailModal({
  table,
  menu,
  account,
  onClose,
  onClear,
  onSubmitManualOrder,
}: Props) {
  const [confirming, setConfirming] = useState(false);
  const order = table.order;

  // ── 섹션 2·3: 현금/계좌이체 신규 주문 담기 (로컬 상태) ──
  const [cart, setCart] = useState<Record<string, number>>({});
  const [payMethod, setPayMethod] = useState<PayMethod | null>(null);
  const [justSubmitted, setJustSubmitted] = useState(false);

  const setQty = (id: string, qty: number) =>
    setCart((prev) => {
      if (qty <= 0) {
        const { [id]: _drop, ...rest } = prev;
        return rest;
      }
      return { ...prev, [id]: qty };
    });
  const addOne = (id: string) => setQty(id, (cart[id] ?? 0) + 1);
  const incr = (id: string) => setQty(id, (cart[id] ?? 0) + 1);
  const decr = (id: string) => setQty(id, (cart[id] ?? 0) - 1);

  const menuById = useMemo(() => new Map(menu.map((m) => [m.id, m])), [menu]);
  const cartItems: OrderItem[] = useMemo(
    () =>
      Object.entries(cart)
        .map(([id, qty]) => {
          const m = menuById.get(id);
          if (!m || qty <= 0) return null;
          return { name: m.name, qty, price: m.price };
        })
        .filter((x): x is OrderItem => x !== null),
    [cart, menuById],
  );
  const cartTotal = orderTotal(cartItems);
  const hasAccount = account.number.trim() !== "";

  const canSubmit = cartItems.length > 0 && payMethod !== null && (payMethod !== "transfer" || hasAccount);

  const submit = () => {
    if (!canSubmit) return;
    onSubmitManualOrder?.({ tableId: table.id, items: cartItems, method: payMethod! });
    setCart({});
    setPayMethod(null);
    setJustSubmitted(true);
    setTimeout(() => setJustSubmitted(false), 2500);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      {confirming ? (
        <div className="dialog" onClick={(e) => e.stopPropagation()}>
          <p className="dialog__msg">{table.number}번 테이블을 정리하시겠습니까?</p>
          <div className="dialog__actions">
            <button className="btn btn--secondary" onClick={() => setConfirming(false)}>
              취소
            </button>
            <button
              className="btn btn--destructive"
              onClick={() => {
                onClear(table.id);
                onClose();
              }}
            >
              테이블 정리
            </button>
          </div>
        </div>
      ) : (
        <div className="table-detail" onClick={(e) => e.stopPropagation()}>
          <div className="table-detail__head">
            <h2 className="table-detail__title">{table.number}번 테이블</h2>
            {order && (
              <span className="modal__sub">
                {order.orderIds && order.orderIds.length > 0 &&
                  `주문 ${order.orderIds.map((n) => `#${n}`).join(", ")} · `}
                {clock(order.startedAt)}
              </span>
            )}
            <div className="table-detail__head-actions">
              <button
                className="btn btn--destructive btn--sm"
                onClick={() => setConfirming(true)}
                disabled={!order}
              >
                테이블 정리
              </button>
              <button className="modal__close" onClick={onClose} aria-label="닫기">
                ✕
              </button>
            </div>
          </div>

          <div className="table-detail__body">
            {/* 섹션 1 — 기존 주문 내역 (QR 주문 · 결제 완료분) */}
            <section className="table-detail__col table-detail__col--receipt">
              <h3 className="table-detail__col-title">주문 내역</h3>
              {order ? (
                <>
                  <div className="table-detail__list">
                    <BillingRows items={order.items} />
                  </div>
                  <div className="modal__total-row">
                    <span>합계</span>
                    <span className="modal__total-value">{formatKRW(orderTotal(order.items))}</span>
                  </div>
                </>
              ) : (
                <p className="table-detail__empty">진행중인 주문이 없습니다.</p>
              )}
            </section>

            {/* 섹션 2 — 현금·계좌이체 메뉴 선택 */}
            <section className="table-detail__col table-detail__col--menu">
              <h3 className="table-detail__col-title">
                메뉴 선택 <span className="table-detail__col-hint">현금·계좌이체 주문</span>
              </h3>
              {MENU_CATEGORIES.map((cat: MenuCategory) => {
                const items = menu.filter((m) => m.category === cat);
                if (items.length === 0) return null;
                return (
                  <div key={cat} className="manual-menu-group">
                    <h4 className="manual-menu-group__title">{cat}</h4>
                    <div className="manual-menu-grid">
                      {items.map((m) => {
                        const qty = cart[m.id] ?? 0;
                        return (
                          <div
                            key={m.id}
                            className={`manual-menu-card${m.soldOut ? " manual-menu-card--soldout" : ""}`}
                            // QR 주문처럼 박스 자체를 눌러도 1개 담긴다. 스테퍼 안 −/+ 버튼은
                            // 각자 stopPropagation 해서 여기로 안 겹쳐 올라온다.
                            onClick={m.soldOut ? undefined : () => addOne(m.id)}
                            role={m.soldOut ? undefined : "button"}
                            tabIndex={m.soldOut ? undefined : 0}
                            onKeyDown={
                              m.soldOut
                                ? undefined
                                : (e) => {
                                    if (e.key === "Enter" || e.key === " ") {
                                      e.preventDefault();
                                      addOne(m.id);
                                    }
                                  }
                            }
                            aria-label={m.soldOut ? `${m.name} 품절` : `${m.name} 담기`}
                          >
                            {m.image ? (
                              <img className="manual-menu-card__img" src={m.image} alt="" />
                            ) : (
                              <div className="manual-menu-card__img manual-menu-card__img--ph" aria-hidden="true" />
                            )}
                            <div className="manual-menu-card__body">
                              <span className="manual-menu-card__name">{m.name}</span>
                              <span className="manual-menu-card__price">{formatKRW(m.price)}</span>
                            </div>

                            <div className="manual-menu-card__foot">
                              {m.soldOut ? (
                                <span className="manual-menu-card__soldout">품절</span>
                              ) : qty === 0 ? (
                                <span className="manual-menu-card__add" aria-hidden="true">
                                  +
                                </span>
                              ) : (
                                <div
                                  className="manual-menu-card__stepper"
                                  role="group"
                                  aria-label={`${m.name} 수량`}
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <button type="button" onClick={() => decr(m.id)} aria-label="수량 감소">
                                    −
                                  </button>
                                  <span className="manual-menu-card__qty">{qty}</span>
                                  <button type="button" onClick={() => incr(m.id)} aria-label="수량 증가">
                                    +
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
              {menu.length === 0 && <p className="table-detail__empty">등록된 메뉴가 없습니다.</p>}
            </section>

            {/* 섹션 3 — 신규(현금·계좌이체) 주문 빌링지 + 결제수단 + 접수 */}
            <section className="table-detail__col table-detail__col--cart">
              <h3 className="table-detail__col-title">신규 주문</h3>

              {cartItems.length === 0 ? (
                <p className="table-detail__empty">왼쪽에서 메뉴를 담아 주세요.</p>
              ) : (
                <div className="table-detail__list">
                  <BillingRows items={cartItems} />
                </div>
              )}
              <div className="modal__total-row">
                <span>합계</span>
                <span className="modal__total-value">{formatKRW(cartTotal)}</span>
              </div>

              <div className="manual-pay">
                <span className="manual-pay__label">결제 수단</span>
                <div className="manual-pay__btns">
                  <button
                    type="button"
                    className={`btn btn--sm${payMethod === "cash" ? " btn--primary" : " btn--secondary"}`}
                    onClick={() => setPayMethod("cash")}
                  >
                    현금
                  </button>
                  <button
                    type="button"
                    className={`btn btn--sm${payMethod === "transfer" ? " btn--primary" : " btn--secondary"}`}
                    onClick={() => setPayMethod("transfer")}
                  >
                    계좌이체
                  </button>
                </div>
                {payMethod === "transfer" && (
                  hasAccount ? (
                    <div className="manual-pay__account">
                      <span className="manual-pay__account-bank">
                        {account.bank}
                        {account.holder ? ` · ${account.holder}` : ""}
                      </span>
                      <span className="manual-pay__account-number">{account.number}</span>
                    </div>
                  ) : (
                    <p className="manual-pay__account manual-pay__account--warn">
                      등록된 정산 계좌가 없습니다 — 관리자 탭에서 먼저 등록해 주세요.
                    </p>
                  )
                )}
              </div>

              {justSubmitted && <p className="manual-submit-ok">✓ 주문이 접수되었습니다.</p>}
              <button
                type="button"
                className="btn btn--primary btn--block manual-submit"
                disabled={!canSubmit}
                onClick={submit}
              >
                주문 접수
              </button>
            </section>
          </div>
        </div>
      )}
    </div>
  );
}
