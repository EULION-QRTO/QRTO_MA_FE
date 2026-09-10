import { useCallback, useEffect, useRef, useState } from "react";
import { formatKRW } from "@/lib/types";
import { useStores } from "@/pages/operator/stores";
import { fetchSnapshot, type StoreSnapshot } from "./storeSnapshot";

const REFRESH_MS = 15000;

export default function OverviewTab() {
  const { stores, error: listError } = useStores();
  const idsKey = stores.map((s) => s.id).join(",");
  const [snapshots, setSnapshots] = useState<Record<string, StoreSnapshot>>({});
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(async () => {
    const storeIds = idsKey ? idsKey.split(",") : [];
    if (storeIds.length === 0) {
      setSnapshots({});
      return;
    }
    setLoading(true);
    const results = await Promise.all(storeIds.map(fetchSnapshot));
    setSnapshots(Object.fromEntries(results.map((s) => [s.id, s])));
    setLastUpdated(new Date().toLocaleTimeString("ko-KR", { hour12: false }));
    setLoading(false);
  }, [idsKey]);

  useEffect(() => {
    void refresh();
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => void refresh(), REFRESH_MS);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [refresh]);

  const list = stores.map((st) => snapshots[st.id]).filter(Boolean) as StoreSnapshot[];
  const onlineList = list.filter((s) => s.online);
  const sum = (pick: (s: StoreSnapshot) => number | undefined) =>
    onlineList.reduce((acc, s) => acc + (pick(s) ?? 0), 0);
  const offlineCount = list.length - onlineList.length;

  return (
    <>
      <div className="op__section-head">
        <h2 className="op__section-title">전체 매장 개요</h2>
        <span className="op__updated">
          {loading ? "갱신 중…" : lastUpdated ? `업데이트 ${lastUpdated}` : ""}
        </span>
        <button className="btn btn--sm" onClick={() => void refresh()} disabled={loading}>
          새로고침
        </button>
      </div>

      {listError && <p className="op-card__error">⚠️ {listError}</p>}

      <section className="op__kpis">
        <div className="op__kpi">
          <div className="op__kpi-label">관리 매장</div>
          <div className="op__kpi-value">
            {onlineList.length}
            <span className="op__kpi-unit"> / {stores.length}</span>
          </div>
          {offlineCount > 0 && (
            <div className="op__kpi-foot op__kpi-foot--warn">{offlineCount}개 오프라인</div>
          )}
        </div>
        <div className="op__kpi">
          <div className="op__kpi-label">오늘 총매출</div>
          <div className="op__kpi-value op__kpi-value--accent">{formatKRW(sum((s) => s.totalSales))}</div>
        </div>
        <div className="op__kpi">
          <div className="op__kpi-label">진행중 주문</div>
          <div className="op__kpi-value">{sum((s) => s.activeOrders).toLocaleString("ko-KR")}건</div>
        </div>
        <div className="op__kpi">
          <div className="op__kpi-label">사용중 테이블</div>
          <div className="op__kpi-value">{sum((s) => s.occupied).toLocaleString("ko-KR")}</div>
        </div>
        <div className="op__kpi">
          <div className="op__kpi-label">직원 호출</div>
          <div className={`op__kpi-value${sum((s) => s.staffCalls) > 0 ? " op__kpi-value--warn" : ""}`}>
            {sum((s) => s.staffCalls).toLocaleString("ko-KR")}
          </div>
        </div>
      </section>

      <div className="op__grid">
        {stores.length === 0 && (
          <p className="op__empty">등록된 매장이 없습니다.</p>
        )}
        {stores.map((store) => {
          const id = store.id;
          const s = snapshots[id];
          return (
            <article key={id} className={`op-card${s && !s.online ? " op-card--offline" : ""}`}>
              <div className="op-card__head">
                <span className="op-card__name">{s?.name ?? store.name}</span>
                <span className="op-card__id">#{id}</span>
              </div>

              {!s ? (
                <p className="op-card__loading">불러오는 중…</p>
              ) : !s.online ? (
                <p className="op-card__error">⚠️ {s.error}</p>
              ) : (
                <>
                  <div className="op-card__sales">{formatKRW(s.totalSales ?? 0)}</div>
                  <div className="op-card__stats">
                    <div>
                      <span className="op-card__stat-label">진행 주문</span>
                      <span className="op-card__stat-value">{s.activeOrders}건</span>
                    </div>
                    <div>
                      <span className="op-card__stat-label">테이블</span>
                      <span className="op-card__stat-value">
                        {s.occupied}/{s.tableCount}
                      </span>
                    </div>
                    <div>
                      <span className="op-card__stat-label">직원호출</span>
                      <span
                        className={`op-card__stat-value${(s.staffCalls ?? 0) > 0 ? " op-card__stat-value--warn" : ""}`}
                      >
                        {s.staffCalls}
                      </span>
                    </div>
                    <div>
                      <span className="op-card__stat-label">주문/취소</span>
                      <span className="op-card__stat-value">
                        {s.orderCount}/{s.canceledCount}
                      </span>
                    </div>
                  </div>
                </>
              )}
            </article>
          );
        })}
      </div>
    </>
  );
}
