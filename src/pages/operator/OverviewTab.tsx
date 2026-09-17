import { useCallback, useEffect, useRef, useState } from "react";
import { formatKRW } from "@/lib/types";
import { useStores } from "@/pages/operator/stores";
import { fetchSnapshot, type StoreSnapshot } from "./storeSnapshot";
import { healthApi } from "@/lib/endpoints";
import { ApiError } from "@/lib/api";
import { parseServerTime } from "@/lib/mappers";

const REFRESH_MS = 15000;
/** 서버 헬스체크(GET /api/health) 갱신 주기. 매장 스냅샷과는 독립적으로 돈다. */
const HEALTH_REFRESH_MS = 30000;

type HealthState =
  | { kind: "checking" }
  | { kind: "up"; service: string; serverTime: string; latencyMs: number; checkedAt: string }
  | { kind: "down"; error: string; checkedAt: string };

export default function OverviewTab() {
  const { stores, error: listError } = useStores();
  const idsKey = stores.map((s) => s.id).join(",");
  const [snapshots, setSnapshots] = useState<Record<string, StoreSnapshot>>({});
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [health, setHealth] = useState<HealthState>({ kind: "checking" });
  const healthTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

  /** GET /api/health — 매장 구분 없는 서버 전체 liveness 체크. 왕복 지연시간을 함께 잰다. */
  const checkHealth = useCallback(async () => {
    const startedAt = performance.now();
    const checkedAt = new Date().toLocaleTimeString("ko-KR", { hour12: false });
    try {
      const res = await healthApi.check();
      setHealth({
        kind: "up",
        service: res.service,
        serverTime: res.time,
        latencyMs: Math.round(performance.now() - startedAt),
        checkedAt,
      });
    } catch (e) {
      setHealth({
        kind: "down",
        error: e instanceof ApiError ? `${e.code} · ${e.message}` : "서버에 연결할 수 없습니다.",
        checkedAt,
      });
    }
  }, []);

  useEffect(() => {
    void refresh();
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => void refresh(), REFRESH_MS);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [refresh]);

  useEffect(() => {
    void checkHealth();
    if (healthTimerRef.current) clearInterval(healthTimerRef.current);
    healthTimerRef.current = setInterval(() => void checkHealth(), HEALTH_REFRESH_MS);
    return () => {
      if (healthTimerRef.current) clearInterval(healthTimerRef.current);
    };
  }, [checkHealth]);

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

      {/*
       * 서버 헬스체크(GET /api/health) — 매장별 상태가 아니라 API 서버 전체가
       * 응답하는지만 보는 전역 liveness 체크다. 매장 카드의 온라인/오프라인
       * 배지와는 별개(그건 매장별 API 호출 성공 여부로 판단)이니 혼동하지 않게
       * 분리된 카드로 둔다.
       */}
      <section className={`op-health${health.kind === "down" ? " op-health--down" : ""}`}>
        <div className="op-health__status">
          {health.kind === "checking" ? (
            <span className="op__badge">확인 중…</span>
          ) : health.kind === "up" ? (
            <span className="op__badge op__badge--on">API 서버 정상</span>
          ) : (
            <span className="op__badge op__badge--off">API 서버 응답 없음</span>
          )}
          <span className="op-health__hint">
            매장 구분 없는 서버 전체 상태(GET /api/health)입니다 — 매장별 상태는 아래 카드를 보세요.
          </span>
        </div>

        {health.kind === "up" && (
          <div className="op-health__stats">
            <div>
              <span className="op-card__stat-label">지연시간</span>
              <span className="op-card__stat-value">{health.latencyMs}ms</span>
            </div>
            <div>
              <span className="op-card__stat-label">서버 시각</span>
              <span className="op-card__stat-value">
                {new Date(parseServerTime(health.serverTime)).toLocaleTimeString("ko-KR", {
                  hour12: false,
                })}
              </span>
            </div>
            <div>
              <span className="op-card__stat-label">서비스</span>
              <span className="op-card__stat-value">{health.service}</span>
            </div>
          </div>
        )}
        {health.kind === "down" && <p className="op-card__error">⚠️ {health.error}</p>}

        <span className="op__updated">
          {health.kind !== "checking" ? `확인 ${health.checkedAt}` : ""}
        </span>
        <button className="btn btn--sm" onClick={() => void checkHealth()}>
          새로고침
        </button>
      </section>

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
