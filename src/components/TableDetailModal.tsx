import { useCallback, useEffect, useMemo, useState } from "react";
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
import { parseServerTime } from "@/lib/mappers";
import { tableApi, orderApi } from "@/lib/endpoints";
import { ApiError } from "@/lib/api";
import type { OrderResponse, PaymentMethod, TableOrdersResponse } from "@/lib/dto";

type PayMethod = "CASH" | "TRANSFER";

interface Props {
  table: Table;
  /** 현금·계좌이체 주문에 고를 메뉴 (품절 포함 — 카드에서 비활성 처리) */
  menu: MenuItem[];
  /** 계좌이체 선택 시 보여줄 정산 계좌 (관리자 탭에서 등록) */
  account: SettlementAccount;
  onClose: () => void;
  onClear: (tableId: number) => void;
  /** 주문 생성·카운터 결제 후 테이블 그리드·대기 목록 등 앱 전체 상태를 갱신시킨다 */
  onChanged?: () => void;
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

const METHOD_LABEL: Record<PaymentMethod, string> = {
  PAYAPP: "간편결제",
  CASH: "현금",
  TRANSFER: "계좌이체",
  FREE: "무료",
};

/**
 * 주문 하나의 결제 상태 배지 — 미결제/결제수단별로 표시.
 * PENDING_PAYMENT(손님이 페이앱 결제창을 열어둔 채 아직 안 낸 것)는 일반 "미결제"와
 * 구분해서 보여준다 — 테이블 전체 카운터 결제를 누르면 이것도 같이 결제 처리되므로,
 * 홀 직원이 손님이 지금 페이앱으로 결제 중일 수 있다는 걸 알고 눌러야 한다.
 */
function PayBadge({ order }: { order: OrderResponse }) {
  if (order.status === "PENDING_PAYMENT") {
    return (
      <span className="table-detail__order-badge table-detail__order-badge--pending">
        결제대기(페이앱)
      </span>
    );
  }
  if (!order.paid) return <span className="table-detail__order-badge table-detail__order-badge--unpaid">미결제</span>;
  return (
    <span className="table-detail__order-badge">
      {order.paymentMethod ? METHOD_LABEL[order.paymentMethod] : "결제완료"}
    </span>
  );
}

export default function TableDetailModal({ table, menu, account, onClose, onClear, onChanged }: Props) {
  const [confirming, setConfirming] = useState(false);
  const order = table.order; // table-status 기준 요약 — 헤더의 빠른 표시·정리 가능 여부에만 사용

  // ── 섹션 1: 실제 주문 묶음(GET /tables/{id}/orders) ──
  const [bundle, setBundle] = useState<TableOrdersResponse | null>(null);
  const [bundleLoading, setBundleLoading] = useState(true);
  const [bundleError, setBundleError] = useState<string | null>(null);

  const reloadBundle = useCallback(async () => {
    setBundleLoading(true);
    setBundleError(null);
    try {
      setBundle(await tableApi.orders(table.id));
    } catch (e) {
      setBundleError(e instanceof ApiError ? `${e.code} · ${e.message}` : "불러오지 못했습니다.");
    } finally {
      setBundleLoading(false);
    }
  }, [table.id]);

  useEffect(() => {
    void reloadBundle();
  }, [reloadBundle]);

  const orders = bundle?.orders ?? [];
  const unpaidTotal = bundle?.unpaidTotal ?? 0;
  const grandTotal = (bundle?.paidTotal ?? 0) + unpaidTotal;
  /** 손님이 페이앱 결제창을 열어둔 채 아직 안 낸 주문 — 테이블 일괄 결제에 같이 쓸려 들어갈 수 있다 */
  const pendingPaymentOrders = orders.filter((o) => o.status === "PENDING_PAYMENT");

  // ── 섹션 1: 미결제 합계 결제(현금·계좌이체) — 테이블의 미결제 전부를 한 번에 처리한다 ──
  const [paying, setPaying] = useState<PayMethod | null>(null);
  const [payError, setPayError] = useState<string | null>(null);

  const settleUnpaid = async (method: PayMethod) => {
    if (paying) return;
    // 페이앱 결제대기 주문이 섞여 있으면, 그것까지 같이 이 결제수단으로 처리된다는 걸
    // 한 번 더 확인시킨다(손님이 지금 막 페이앱으로 결제하려던 걸 덮어쓸 수 있어서).
    if (
      pendingPaymentOrders.length > 0 &&
      !window.confirm(
        `결제대기(페이앱) 주문 ${pendingPaymentOrders.length}건이 포함돼 있습니다. 손님이 지금 ` +
          `페이앱으로 결제 중일 수 있습니다 — 그래도 전부 ${method === "CASH" ? "현금" : "계좌이체"}로 ` +
          `처리할까요?`,
      )
    ) {
      return;
    }
    setPaying(method);
    setPayError(null);
    try {
      await tableApi.payment(table.id, { method });
      await reloadBundle();
      onChanged?.();
    } catch (e) {
      setPayError(e instanceof ApiError ? `${e.code} · ${e.message}` : "결제 처리에 실패했습니다.");
    } finally {
      setPaying(null);
    }
  };

  // ── 섹션 2·3: 현금/계좌이체 신규 주문 담기 (로컬 장바구니) ──
  const [cart, setCart] = useState<Record<string, number>>({});
  const [payMethod, setPayMethod] = useState<PayMethod | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
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

  const canSubmit =
    cartItems.length > 0 && payMethod !== null && (payMethod !== "TRANSFER" || hasAccount) && !submitting;

  /**
   * "주문 접수": 새 주문을 만들고(POST .../orders, 접수 즉시 RECEIVED·미결제),
   * 방금 만든 "그 주문 하나만" 주문 단위 결제(POST orders/{id}/payment)로 정산한다.
   * ⚠️ 테이블 단위 결제(tableApi.payment)를 여기서 쓰면 안 된다 — 그건 그 테이블의
   * 미결제 전부(손님이 페이앱 결제창을 열어둔 채 아직 안 낸 PENDING_PAYMENT 주문 포함)를
   * 한꺼번에 이 결제수단으로 처리해버려서, 손님이 지금 막 페이앱으로 결제하려던 주문까지
   * 엉뚱하게 "현금 결제완료"로 바뀌어 버릴 수 있다. 그래서 방금 만든 주문의 id 로만
   * 결제를 확정한다 — 테이블에 있던 다른 미결제 주문은 건드리지 않는다.
   */
  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const items = Object.entries(cart).map(([id, quantity]) => ({ menuId: Number(id), quantity }));
      const created = await tableApi.createOrder(table.id, { items });
      await orderApi.payment(created.id, { method: payMethod! });
      setCart({});
      setPayMethod(null);
      setJustSubmitted(true);
      setTimeout(() => setJustSubmitted(false), 2500);
      await reloadBundle();
      onChanged?.();
    } catch (e) {
      setSubmitError(e instanceof ApiError ? `${e.code} · ${e.message}` : "주문 접수에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
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
            {/* 섹션 1 — 기존 주문 내역(QR 주문 + 포스 현금·계좌이체 주문) + 미결제 결제 */}
            <section className="table-detail__col table-detail__col--receipt">
              <h3 className="table-detail__col-title">주문 내역</h3>

              {bundleLoading ? (
                <p className="table-detail__empty">불러오는 중…</p>
              ) : bundleError ? (
                <p className="table-detail__empty table-detail__empty--err">⚠️ {bundleError}</p>
              ) : orders.length === 0 ? (
                <p className="table-detail__empty">진행중인 주문이 없습니다.</p>
              ) : (
                <>
                  {orders.map((o) => (
                    <div className="table-detail__order" key={o.id}>
                      <div className="table-detail__order-head">
                        <span className="table-detail__order-time">
                          #{o.id} · {clock(parseServerTime(o.createdAt))}
                        </span>
                        <PayBadge order={o} />
                      </div>
                      <div className="table-detail__list">
                        <BillingRows
                          items={o.items.map((it) => ({
                            name: it.menuName,
                            qty: it.quantity,
                            price: it.unitPrice,
                          }))}
                        />
                      </div>
                    </div>
                  ))}

                  <div className="modal__total-row">
                    <span>합계</span>
                    <span className="modal__total-value">{formatKRW(grandTotal)}</span>
                  </div>

                  {unpaidTotal > 0 && (
                    <div className="table-detail__settle">
                      <div className="table-detail__settle-amount">
                        <span>미결제</span>
                        <span className="table-detail__settle-value">{formatKRW(unpaidTotal)}</span>
                      </div>
                      {payError && <p className="table-detail__empty table-detail__empty--err">⚠️ {payError}</p>}
                      <div className="manual-pay__btns">
                        <button
                          type="button"
                          className="btn btn--sm btn--secondary"
                          disabled={paying !== null}
                          onClick={() => void settleUnpaid("CASH")}
                        >
                          {paying === "CASH" ? "처리 중…" : "현금 결제"}
                        </button>
                        <button
                          type="button"
                          className="btn btn--sm btn--secondary"
                          disabled={paying !== null}
                          onClick={() => void settleUnpaid("TRANSFER")}
                        >
                          {paying === "TRANSFER" ? "처리 중…" : "계좌이체 결제"}
                        </button>
                      </div>
                    </div>
                  )}
                </>
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
                    className={`btn btn--sm${payMethod === "CASH" ? " btn--primary" : " btn--secondary"}`}
                    onClick={() => setPayMethod("CASH")}
                  >
                    현금
                  </button>
                  <button
                    type="button"
                    className={`btn btn--sm${payMethod === "TRANSFER" ? " btn--primary" : " btn--secondary"}`}
                    onClick={() => setPayMethod("TRANSFER")}
                  >
                    계좌이체
                  </button>
                </div>
                {payMethod === "TRANSFER" && (
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

              {submitError && <p className="table-detail__empty table-detail__empty--err">⚠️ {submitError}</p>}
              {justSubmitted && <p className="manual-submit-ok">✓ 주문이 접수·결제되었습니다.</p>}
              <button
                type="button"
                className="btn btn--primary btn--block manual-submit"
                disabled={!canSubmit}
                onClick={() => void submit()}
              >
                {submitting ? "처리 중…" : "주문 접수"}
              </button>
            </section>
          </div>
        </div>
      )}
    </div>
  );
}
