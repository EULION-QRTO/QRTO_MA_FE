import { useCallback, useEffect, useState } from "react";
import { formatKRW } from "@/lib/types";
import { fetchSnapshot, type StoreSnapshot } from "./storeSnapshot";
import { useStores, setStoreOrgMeta, type OpStore } from "@/pages/operator/stores";

interface Props {
  /** QR 인쇄 탭으로 이동 (해당 매장 ID prefill) */
  onPrintQr: (id: string) => void;
}

const displayName = (store: OpStore, snap?: StoreSnapshot) => snap?.name ?? store.name;

export default function StoreListTab({ onPrintQr }: Props) {
  const { stores, loading: listLoading, error: listError, refresh } = useStores();
  const [snapshots, setSnapshots] = useState<Record<string, StoreSnapshot>>({});
  const [snapLoading, setSnapLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editOrg, setEditOrg] = useState("");

  const idsKey = stores.map((s) => s.id).join(",");

  const refreshSnapshots = useCallback(async () => {
    const ids = idsKey ? idsKey.split(",") : [];
    if (ids.length === 0) {
      setSnapshots({});
      return;
    }
    setSnapLoading(true);
    const results = await Promise.all(ids.map(fetchSnapshot));
    setSnapshots(Object.fromEntries(results.map((s) => [s.id, s])));
    setSnapLoading(false);
  }, [idsKey]);

  useEffect(() => {
    void refreshSnapshots();
  }, [refreshSnapshots]);

  const openDetail = (store: OpStore) => {
    setSelectedId(store.id);
    setEditOrg(store.organization ?? "");
  };

  const saveOrg = () => {
    if (!selectedId) return;
    setStoreOrgMeta(selectedId, editOrg);
    void refresh();
  };

  const q = query.trim().toLowerCase();
  const filtered = stores.filter((s) => {
    if (!q) return true;
    const snap = snapshots[s.id];
    return (
      displayName(s, snap).toLowerCase().includes(q) ||
      (s.organization ?? "").toLowerCase().includes(q) ||
      s.id.includes(q)
    );
  });

  const selected = selectedId ? stores.find((s) => s.id === selectedId) : null;
  const selectedSnap = selectedId ? snapshots[selectedId] : undefined;

  return (
    <>
      <div className="op__section-head">
        <h2 className="op__section-title">매장 리스트</h2>
        <span className="op__count">{stores.length}</span>
        <span className="op__updated">
          {listLoading || snapLoading ? "갱신 중…" : ""}
        </span>
        <button
          className="btn btn--sm"
          onClick={() => {
            void refresh();
            void refreshSnapshots();
          }}
          disabled={listLoading || snapLoading}
        >
          새로고침
        </button>
      </div>

      {listError && <p className="op-card__error">⚠️ {listError}</p>}

      {/* 검색 */}
      <div className="op__add">
        <input
          className="field field--sm op__store-search"
          placeholder="매장 이름 · 운영단체 · ID 검색"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {/* 목록 */}
      <div className="op__table-wrap">
        <table className="op__table">
          <thead>
            <tr>
              <th>매장</th>
              <th>운영단체</th>
              <th>ID</th>
              <th>상태</th>
              <th>오늘 매출</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="op__table-empty">
                  {stores.length === 0 ? "등록된 매장이 없습니다." : "검색 결과가 없습니다."}
                </td>
              </tr>
            ) : (
              filtered.map((s) => {
                const snap = snapshots[s.id];
                return (
                  <tr
                    key={s.id}
                    className={`op__row${selectedId === s.id ? " op__row--active" : ""}`}
                    onClick={() => openDetail(s)}
                  >
                    <td>{displayName(s, snap)}</td>
                    <td>{s.organization ?? "—"}</td>
                    <td>#{s.id}</td>
                    <td>
                      {!snap ? (
                        <span className="op__badge">…</span>
                      ) : snap.online ? (
                        <span className="op__badge op__badge--on">정상</span>
                      ) : (
                        <span className="op__badge op__badge--off">오프라인</span>
                      )}
                    </td>
                    <td>
                      {snap?.online
                        ? formatKRW(snap.totalSales ?? 0)
                        : formatKRW(s.todaySales ?? 0)}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* 상세 관리 패널 */}
      {selected && (
        <section className="op-detail">
          <div className="op-detail__head">
            <h3 className="op-detail__title">
              {displayName(selected, selectedSnap)} <span className="op-card__id">#{selected.id}</span>
            </h3>
            <button className="op-card__remove" onClick={() => setSelectedId(null)} aria-label="닫기">
              ✕
            </button>
          </div>

          {selectedSnap && !selectedSnap.online && (
            <p className="op-card__error">⚠️ {selectedSnap.error}</p>
          )}

          {selectedSnap?.online && (
            <div className="op-card__stats op-detail__stats">
              <div>
                <span className="op-card__stat-label">오늘 매출</span>
                <span className="op-card__stat-value">{formatKRW(selectedSnap.totalSales ?? 0)}</span>
              </div>
              <div>
                <span className="op-card__stat-label">진행 주문</span>
                <span className="op-card__stat-value">{selectedSnap.activeOrders}건</span>
              </div>
              <div>
                <span className="op-card__stat-label">테이블</span>
                <span className="op-card__stat-value">
                  {selectedSnap.occupied}/{selectedSnap.tableCount}
                </span>
              </div>
              <div>
                <span className="op-card__stat-label">직원호출</span>
                <span className="op-card__stat-value">{selectedSnap.staffCalls}</span>
              </div>
              <div>
                <span className="op-card__stat-label">주문/취소</span>
                <span className="op-card__stat-value">
                  {selectedSnap.orderCount}/{selectedSnap.canceledCount}
                </span>
              </div>
            </div>
          )}

          {/* 운영단체 (로컬 메타 — 서버에 organization 필드 추가 전까지 임시) */}
          <div className="op-detail__meta">
            <label className="op-form__field">
              <span className="op-form__label">운영단체</span>
              <input
                className="field field--sm"
                value={editOrg}
                onChange={(e) => setEditOrg(e.target.value)}
                placeholder="예: 멋쟁이사자처럼 LPAY"
              />
            </label>
            <button className="btn btn--sm" onClick={saveOrg}>
              저장
            </button>
          </div>

          <div className="op-detail__actions">
            <button className="btn btn--sm btn--primary" onClick={() => onPrintQr(selected.id)}>
              🖨 QR 인쇄
            </button>
          </div>
        </section>
      )}
    </>
  );
}
