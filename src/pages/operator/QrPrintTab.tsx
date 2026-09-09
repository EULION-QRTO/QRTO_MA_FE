import { useEffect, useRef, useState } from "react";
import { adminApi } from "@/lib/endpoints";
import { ApiError } from "@/lib/api";
import { getManagedStores } from "@/lib/operator";

interface Props {
  /** 다른 탭에서 넘어올 때 prefill 할 매장 ID */
  initialStoreId?: string;
}

interface TableQr {
  id: number;
  name: string;
  url: string;
}
interface QrData {
  tableQrs: TableQr[];
  togoUrl: string | null;
}
/** 감시 목록에서 만든 매장 디렉터리 (이름 검색용). name 은 조회 실패 시 undefined. */
interface StoreDirEntry {
  id: string;
  name?: string;
}

const labelOf = (d: StoreDirEntry) => (d.name ? `${d.name} (#${d.id})` : `#${d.id}`);

/**
 * 입력값(이름 또는 ID)을 매장 ID 로 해석한다.
 * 우선순위: 정확한 라벨 → "#숫자" 포함 → 순수 숫자 → 이름 부분일치
 */
function resolveStoreId(query: string, dir: StoreDirEntry[]): string | null {
  const q = query.trim();
  if (!q) return null;
  const byLabel = dir.find((d) => labelOf(d) === q);
  if (byLabel) return byLabel.id;
  const hash = q.match(/#(\d+)/);
  if (hash) return hash[1];
  if (/^\d+$/.test(q)) return q;
  const byName = dir.find((d) => d.name && d.name.toLowerCase().includes(q.toLowerCase()));
  return byName ? byName.id : null;
}

/**
 * 주점별 테이블 QR + TOGO(픽업) QR 인쇄.
 * 백엔드에 매장 검색 API 가 없어, 이름 검색은 감시 목록(watchlist) 내 매장으로 한정된다.
 * (감시 목록에 없는 매장은 ID 로 직접 입력)
 */
export default function QrPrintTab({ initialStoreId }: Props) {
  const [dir, setDir] = useState<StoreDirEntry[]>([]);
  const [query, setQuery] = useState(initialStoreId ?? "");
  const [data, setData] = useState<QrData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const urlsRef = useRef<string[]>([]);

  // 관리 매장의 이름을 미리 조회해 디렉터리(이름 검색용) 구성. 로컬 라벨/운영단체도 병합.
  useEffect(() => {
    const managed = getManagedStores();
    setDir(managed.map((m) => ({ id: m.id, name: m.name })));
    setQuery((q) => q || initialStoreId || managed[0]?.id || "");
    let alive = true;
    Promise.all(
      managed.map(async (m): Promise<StoreDirEntry> => {
        try {
          const s = await adminApi.stores.get(m.id);
          return { id: m.id, name: s.name ?? m.name };
        } catch {
          return { id: m.id, name: m.name };
        }
      }),
    ).then((entries) => {
      if (alive) setDir(entries);
    });
    return () => {
      alive = false;
    };
  }, [initialStoreId]);

  const revokeAll = () => {
    urlsRef.current.forEach((u) => URL.revokeObjectURL(u));
    urlsRef.current = [];
  };

  const load = async () => {
    const storeId = resolveStoreId(query, dir);
    if (!storeId) {
      setError("매장을 찾을 수 없습니다. 이름 또는 ID를 확인하세요.");
      setData(null);
      return;
    }
    setLoading(true);
    setError(null);
    revokeAll();
    setData(null);
    try {
      const tables = await adminApi.tables.list(storeId);
      const tableQrs = await Promise.all(
        tables.map(async (t) => {
          const url = await adminApi.tables.qrImageUrl(storeId, t.id);
          urlsRef.current.push(url);
          return { id: t.id, name: t.name, url };
        }),
      );
      let togoUrl: string | null = null;
      try {
        togoUrl = await adminApi.pickupQrImageUrl(storeId);
        urlsRef.current.push(togoUrl);
      } catch {
        togoUrl = null; // TOGO 미사용 매장 등
      }
      setData({ tableQrs, togoUrl });
    } catch (e) {
      setError(e instanceof ApiError ? `${e.code} · ${e.message}` : "QR을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => () => revokeAll(), []);

  const resolvedId = resolveStoreId(query, dir);

  return (
    <>
      <div className="op__section-head op__no-print">
        <h2 className="op__section-title">QR 인쇄</h2>
      </div>

      <div className="op__add op__no-print">
        <input
          className="field field--sm op__store-search"
          list="op-store-list"
          placeholder="매장 이름 또는 ID"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void load()}
        />
        <datalist id="op-store-list">
          {dir.map((d) => (
            <option key={d.id} value={labelOf(d)} />
          ))}
        </datalist>
        <button className="btn btn--sm btn--primary" onClick={() => void load()} disabled={loading}>
          {loading ? "불러오는 중…" : "불러오기"}
        </button>
        {data && (
          <button className="btn btn--sm" onClick={() => window.print()}>
            🖨 인쇄
          </button>
        )}
        {query.trim() && (
          <span className="op__resolve-hint">
            {resolvedId ? `→ 매장 #${resolvedId}` : "매칭되는 매장 없음"}
          </span>
        )}
      </div>

      {error && <p className="op-card__error op__no-print">⚠️ {error}</p>}

      {data && (
        <div className="qr-print">
          <div className="qr-print__title">매장 #{resolvedId} QR 코드</div>

          {data.togoUrl && (
            <div className="qr-print__grid">
              <figure className="qr-print__item qr-print__item--togo">
                <img src={data.togoUrl} alt="TOGO QR" className="qr-print__img" />
                <figcaption className="qr-print__cap">📦 포장(TOGO) 주문</figcaption>
              </figure>
            </div>
          )}

          {data.tableQrs.length === 0 ? (
            <p className="op__empty op__no-print">등록된 테이블이 없습니다.</p>
          ) : (
            <div className="qr-print__grid">
              {data.tableQrs.map((t) => (
                <figure className="qr-print__item" key={t.id}>
                  <img src={t.url} alt={`${t.name} QR`} className="qr-print__img" />
                  <figcaption className="qr-print__cap">🟠 {t.name}</figcaption>
                </figure>
              ))}
            </div>
          )}
        </div>
      )}

      {!data && !loading && !error && (
        <p className="op__empty op__no-print">매장 이름 또는 ID를 입력하고 불러오기를 누르세요.</p>
      )}
    </>
  );
}
