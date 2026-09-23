import { Table, orderTotal, formatKRW } from "@/lib/types";
import { clock, elapsedMin } from "@/lib/time";
import { IconBell } from "@/components/icons";

const WARNING_MIN = 60;

interface Props {
  table: Table;
  now: number;
  onOpen: (table: Table) => void;
  /** 직원 호출 해제 — 해당 테이블의 진행중 호출을 모두 RESOLVED 처리한다. */
  onResolveStaffCall?: (tableId: number) => void;
}

export default function TableCard({ table, now, onOpen, onResolveStaffCall }: Props) {
  const calling = !!table.staffCallActive;

  /**
   * 카드 탭 동작:
   * - 직원 호출 중이면 → 호출 해제 (상세 탭은 열지 않음)
   * - 호출이 없으면 → 항상 상세 탭 열기 (빈 테이블도 현금·계좌이체 주문을 받을 수 있어야 함)
   */
  const handleTap = () => {
    if (calling) onResolveStaffCall?.(table.id);
    else onOpen(table);
  };

  const callBadge = calling ? (
    <span className="table-card__call-badge">
      <IconBell /> 호출
    </span>
  ) : null;

  // ── 빈 테이블 ──
  if (!table.order) {
    return (
      <button
        type="button"
        className={`table-card table-card--empty${calling ? " table-card--calling" : ""}`}
        onClick={handleTap}
        aria-label={
          calling ? `${table.number}번 테이블 직원 호출 — 탭하여 해제` : `${table.number}번 빈 테이블`
        }
      >
        {callBadge}
        <span className="table-card__num">{table.number}</span>
      </button>
    );
  }

  // ── 사용중 테이블 ──
  const { items, startedAt } = table.order;
  const mins = elapsedMin(startedAt, now);
  const isWarning = mins >= WARNING_MIN;
  const preview =
    items.length === 1 ? items[0].name : `${items[0].name} 외 ${items.length - 1}건`;

  return (
    <button
      className={`table-card table-card--occupied${calling ? " table-card--calling" : ""}`}
      onClick={handleTap}
      aria-label={
        calling
          ? `${table.number}번 테이블 직원 호출 — 탭하여 해제`
          : `${table.number}번 테이블 주문 상세`
      }
    >
      {callBadge}
      {isWarning && !calling && <span className="table-card__warn-badge">{mins}분</span>}
      <div className="table-card__top">
        <span className="table-card__num">{table.number}번</span>
        {/* 경고/호출 배지가 우상단·상단을 쓰므로 시계는 그때 숨긴다 */}
        {!isWarning && !calling && <span className="table-card__time">{clock(startedAt)}</span>}
      </div>
      <p className="table-card__preview">{preview}</p>
      {table.unpaidTotal > 0 && (
        <span className="table-card__unpaid">미결제 {formatKRW(table.unpaidTotal)}</span>
      )}
      <span className="table-card__total">{formatKRW(orderTotal(items))}</span>
    </button>
  );
}
