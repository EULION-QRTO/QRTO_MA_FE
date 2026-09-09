import { Table, orderTotal, formatKRW } from "@/lib/types";
import { clock, elapsedMin } from "@/lib/time";

const WARNING_MIN = 60;

interface Props {
  table: Table;
  now: number;
  onOpen: (table: Table) => void;
  /** 직원 호출 배지 탭 시 호출 — 해당 테이블의 진행중 호출을 해제한다. */
  onResolveStaffCall?: (tableId: number) => void;
}

export default function TableCard({ table, now, onOpen, onResolveStaffCall }: Props) {
  // 직원 호출 배지 — 사용중/빈 테이블 공통. 탭하면 호출을 해제한다.
  const callBadge = table.staffCallActive ? (
    <button
      type="button"
      className="table-card__call-badge"
      onClick={(e) => {
        e.stopPropagation();
        onResolveStaffCall?.(table.id);
      }}
      aria-label={`${table.number}번 테이블 직원 호출 — 탭하여 해제`}
    >
      🔔 호출
    </button>
  ) : null;

  if (!table.order) {
    return (
      <div
        className={`table-card table-card--empty${table.staffCallActive ? " table-card--calling" : ""}`}
        aria-label={`${table.number}번 빈 테이블${table.staffCallActive ? " — 직원 호출" : ""}`}
      >
        {callBadge}
        <span className="table-card__num">{table.number}</span>
      </div>
    );
  }

  const { items, startedAt } = table.order;
  const mins = elapsedMin(startedAt, now);
  const isWarning = mins >= WARNING_MIN;
  const preview =
    items.length === 1
      ? items[0].name
      : `${items[0].name} 외 ${items.length - 1}건`;

  return (
    <button
      className={`table-card table-card--occupied${table.staffCallActive ? " table-card--calling" : ""}`}
      onClick={() => onOpen(table)}
      aria-label={`${table.number}번 테이블 주문 상세`}
    >
      {callBadge}
      {isWarning && <span className="table-card__warn-badge">{mins}분</span>}
      <div className="table-card__top">
        <span className="table-card__num">{table.number}번</span>
        {/* 경고 상태에서는 우상단 배지가 시간을 대신하므로 겹치지 않도록 숨김 */}
        {!isWarning && <span className="table-card__time">{clock(startedAt)}</span>}
      </div>
      <p className="table-card__preview">{preview}</p>
      <span className="table-card__total">{formatKRW(orderTotal(items))}</span>
    </button>
  );
}
