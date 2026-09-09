import { useCallback, useEffect, useState } from "react";
import * as XLSX from "xlsx";
import { salesApi } from "@/lib/endpoints";
import type { OrderResponse, SalesSummaryResponse } from "@/lib/dto";
import { ApiError } from "@/lib/api";
import { formatKRW } from "@/lib/types";

/** 오늘 날짜(Asia/Seoul) 를 YYYY-MM-DD 로 */
const todaySeoul = (): string =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

/** 요약 → 내보내기용 행 [항목, 값] */
const toRows = (s: SalesSummaryResponse): (string | number)[][] => [
  ["항목", "값"],
  ["날짜", s.date],
  ["총 매출", s.totalSales],
  ["누적 매출", s.cumulativeSales],
  ["현장 주문 매출", s.dineInSales],
  ["포장 주문 매출", s.takeoutSales],
  ["총 주문 건수", s.orderCount],
  ["현장 주문 건수", s.dineInOrderCount],
  ["포장 주문 건수", s.takeoutOrderCount],
  ["평균 객단가", s.avgOrderPrice],
  ["취소 건수", s.canceledCount],
];

/** 브라우저 다운로드 트리거 */
const triggerDownload = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};

export default function SalesSummaryCard() {
  // 빈 값 = 오늘(Asia/Seoul). date input 은 항상 값을 요구하므로 오늘로 초기화.
  const [date, setDate] = useState<string>(todaySeoul());
  const [summary, setSummary] = useState<SalesSummaryResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 누적 주문 내역 (GET /api/pos/sales/orders)
  const [orders, setOrders] = useState<OrderResponse[] | null>(null);
  const [ordersOpen, setOrdersOpen] = useState(false);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async (d: string) => {
    setLoading(true);
    setError(null);
    try {
      // 오늘이면 date 파라미터 생략 → 서버 기준 오늘(Asia/Seoul)
      const query = d && d !== todaySeoul() ? d : undefined;
      setSummary(await salesApi.summary(query));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "매출을 불러오지 못했습니다.");
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(todaySeoul());
  }, [load]);

  const loadOrders = async () => {
    if (ordersOpen) {
      setOrdersOpen(false);
      return;
    }
    setOrdersOpen(true);
    if (orders) return;
    setOrdersLoading(true);
    try {
      setOrders(await salesApi.orders());
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "주문 내역을 불러오지 못했습니다.");
    } finally {
      setOrdersLoading(false);
    }
  };

  const exportServerCsv = async () => {
    setExporting(true);
    try {
      const { blob, filename } = await salesApi.exportCsv();
      triggerDownload(blob, filename || `매출내역_${todaySeoul()}.csv`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "CSV 내보내기에 실패했습니다.");
    } finally {
      setExporting(false);
    }
  };

  const exportCsv = () => {
    if (!summary) return;
    const rows = toRows(summary);
    const body = rows
      .map((r) =>
        r
          .map((cell) => {
            const v = String(cell);
            return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
          })
          .join(","),
      )
      .join("\r\n");
    const blob = new Blob(["﻿" + body], { type: "text/csv;charset=utf-8;" });
    triggerDownload(blob, `매출요약_${summary.date}.csv`);
  };

  const exportXlsx = () => {
    if (!summary) return;
    const ws = XLSX.utils.aoa_to_sheet(toRows(summary));
    ws["!cols"] = [{ wch: 16 }, { wch: 16 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "매출요약");
    XLSX.writeFile(wb, `매출요약_${summary.date}.xlsx`);
  };

  return (
    <section className="admin-card">
      <div className="admin-card__head">
        <h2 className="admin-card__title">매출 요약</h2>
        <div className="sales-summary__controls">
          <input
            type="date"
            className="field field--date"
            value={date}
            max={todaySeoul()}
            onChange={(e) => setDate(e.target.value)}
            aria-label="조회 날짜"
          />
          <button
            className="btn btn--sm"
            onClick={() => load(date || todaySeoul())}
            disabled={loading}
          >
            {loading ? "조회 중…" : "조회"}
          </button>
        </div>
      </div>
      <p className="admin-card__desc">날짜를 지정하지 않으면 오늘(Asia/Seoul) 매출을 조회합니다.</p>

      {error && <p className="sales-summary__error">{error}</p>}

      {summary ? (
        <>
          <div className="admin__total-value">{formatKRW(summary.totalSales)}</div>
          <div className="admin__grid">
            <div className="admin__stat">
              <div className="admin__stat-label">🟠 현장 주문 매출</div>
              <div className="admin__stat-value">{formatKRW(summary.dineInSales)}</div>
            </div>
            <div className="admin__stat">
              <div className="admin__stat-label">📦 포장 주문 매출</div>
              <div className="admin__stat-value">{formatKRW(summary.takeoutSales)}</div>
            </div>
            <div className="admin__stat">
              <div className="admin__stat-label">누적 매출</div>
              <div className="admin__stat-value admin__stat-value--accent">
                {formatKRW(summary.cumulativeSales)}
              </div>
            </div>
            <div className="admin__stat">
              <div className="admin__stat-label">총 주문 건수</div>
              <div className="admin__stat-value">{summary.orderCount.toLocaleString("ko-KR")}건</div>
            </div>
            <div className="admin__stat">
              <div className="admin__stat-label">평균 객단가</div>
              <div className="admin__stat-value">{formatKRW(summary.avgOrderPrice)}</div>
            </div>
            <div className="admin__stat">
              <div className="admin__stat-label">현장 / 포장 건수</div>
              <div className="admin__stat-value">
                {summary.dineInOrderCount.toLocaleString("ko-KR")} /{" "}
                {summary.takeoutOrderCount.toLocaleString("ko-KR")}건
              </div>
            </div>
            <div className="admin__stat">
              <div className="admin__stat-label">취소 건수</div>
              <div className="admin__stat-value">{summary.canceledCount.toLocaleString("ko-KR")}건</div>
            </div>
          </div>

          <div className="sales-summary__export">
            <span className="sales-summary__export-label">내보내기</span>
            <button className="btn btn--sm" onClick={exportCsv}>
              요약 CSV
            </button>
            <button className="btn btn--sm" onClick={exportXlsx}>
              요약 XLSX
            </button>
            <button className="btn btn--sm" onClick={exportServerCsv} disabled={exporting}>
              {exporting ? "내보내는 중…" : "전체 주문내역 CSV"}
            </button>
            <button className="btn btn--sm" onClick={loadOrders} disabled={ordersLoading}>
              {ordersOpen ? "주문 내역 접기" : ordersLoading ? "불러오는 중…" : "주문 내역 보기"}
            </button>
          </div>

          {ordersOpen && orders && (
            <ul className="menu-list sales-summary__orders">
              {orders.length === 0 && <li className="menu-list__empty">주문 내역이 없습니다</li>}
              {orders.map((o) => (
                <li className="menu-row" key={o.id}>
                  <span className="field--grow">
                    {o.orderTypeLabel} · {o.tableName ?? o.pickupNo ?? `#${o.id}`} · {o.statusLabel}
                  </span>
                  <span>{formatKRW(o.totalPrice)}</span>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : (
        !loading && !error && <p className="sales-summary__empty">조회된 매출이 없습니다.</p>
      )}
    </section>
  );
}
