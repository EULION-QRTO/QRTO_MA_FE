import { useEffect, useRef, useState } from "react";
import { adminApi } from "@/lib/endpoints";
import { ApiError } from "@/lib/api";
import { renderTableCard } from "@/lib/qrCard";
import { useStores } from "@/pages/operator/stores";

interface Props {
  /** 다른 탭에서 넘어올 때 prefill 할 매장 ID */
  initialStoreId?: string;
}

interface Card {
  label: string;
  blob: Blob;
  url: string;
}

/** QR 요청 크기 — 카드 렌더 배율(4×480=1920)에 맞춤. 명세 상한 2000 */
const QR_SIZE = 1920;

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const canShareFiles = () =>
  typeof navigator !== "undefined" &&
  typeof navigator.canShare === "function" &&
  navigator.canShare({ files: [new File([], "x.png", { type: "image/png" })] });

/**
 * 주점별 QR 카드 생성 — src/assets/TableQR.svg 템플릿에 맞춰 canvas 로 합성.
 * 테이블 1..N + (포장 사용 시) 포장 카드. 개별 PNG 저장 / 공유 / 전체 ZIP / 인쇄.
 */
export default function QrPrintTab({ initialStoreId }: Props) {
  const { stores } = useStores();
  const [storeId, setStoreId] = useState(initialStoreId ?? "");
  const [cards, setCards] = useState<Card[]>([]);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [zipping, setZipping] = useState(false);
  const cardsRef = useRef<Card[]>([]);
  const shareable = canShareFiles();

  useEffect(() => {
    setStoreId((s) => s || initialStoreId || stores[0]?.id || "");
  }, [initialStoreId, stores]);

  const clearCards = () => {
    cardsRef.current.forEach((c) => URL.revokeObjectURL(c.url));
    cardsRef.current = [];
    setCards([]);
  };
  useEffect(() => () => clearCards(), []);

  const store = stores.find((s) => s.id === storeId);

  const generate = async () => {
    if (!storeId || !store) return;
    setError(null);
    clearCards();
    setProgress({ done: 0, total: 0 });
    try {
      const tables = await adminApi.tables.list(storeId);
      const ordered = [...tables].sort((a, b) => {
        const na = parseInt(a.name.match(/\d+/)?.[0] ?? "0", 10);
        const nb = parseInt(b.name.match(/\d+/)?.[0] ?? "0", 10);
        return na - nb || a.id - b.id;
      });

      const jobs: { label: string; getQr: () => Promise<string> }[] = ordered.map((t, i) => ({
        label: `T${i + 1}`,
        getQr: () => adminApi.tables.qrImageUrl(storeId, t.id, { transparent: true, size: QR_SIZE }),
      }));
      if (store.takeoutEnabled) {
        jobs.push({
          label: "포장",
          getQr: () => adminApi.pickupQrImageUrl(storeId, { transparent: true, size: QR_SIZE }),
        });
      }

      setProgress({ done: 0, total: jobs.length });
      const out: Card[] = [];
      for (const job of jobs) {
        const qrUrl = await job.getQr();
        try {
          const blob = await renderTableCard({ qrUrl, storeName: store.name, label: job.label });
          const card: Card = { label: job.label, blob, url: URL.createObjectURL(blob) };
          out.push(card);
          cardsRef.current.push(card);
          setCards([...out]);
        } finally {
          URL.revokeObjectURL(qrUrl);
        }
        setProgress({ done: out.length, total: jobs.length });
      }
    } catch (e) {
      setError(e instanceof ApiError ? `${e.code} · ${e.message}` : "카드를 생성하지 못했습니다.");
    } finally {
      setProgress(null);
    }
  };

  const fileName = (label: string) => `${store?.name ?? "매장"}_${label}.png`;

  const shareCard = async (card: Card) => {
    try {
      await navigator.share({
        files: [new File([card.blob], fileName(card.label), { type: "image/png" })],
      });
    } catch {
      /* 사용자 취소 등 무시 */
    }
  };

  const saveZip = async () => {
    if (cards.length === 0) return;
    setZipping(true);
    try {
      const { default: JSZip } = await import("jszip");
      const zip = new JSZip();
      cards.forEach((c) => zip.file(fileName(c.label), c.blob));
      const blob = await zip.generateAsync({ type: "blob" });
      downloadBlob(blob, `${store?.name ?? "매장"}_QR카드.zip`);
    } catch {
      setError("ZIP 생성에 실패했습니다.");
    } finally {
      setZipping(false);
    }
  };

  const busy = progress !== null;

  return (
    <>
      <div className="op__section-head op__no-print">
        <h2 className="op__section-title">QR 카드</h2>
      </div>

      <div className="op__add op__no-print">
        <select
          className="field field--sm op__store-search"
          value={storeId}
          onChange={(e) => setStoreId(e.target.value)}
        >
          <option value="">매장 선택</option>
          {stores.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} (#{s.id})
            </option>
          ))}
        </select>
        <button className="btn btn--sm btn--primary" onClick={() => void generate()} disabled={!storeId || busy}>
          {busy ? `생성 중 ${progress!.done}/${progress!.total || "…"}` : "카드 생성"}
        </button>
        {cards.length > 0 && !busy && (
          <>
            <button className="btn btn--sm" onClick={() => void saveZip()} disabled={zipping}>
              {zipping ? "압축 중…" : `전체 저장 (ZIP · ${cards.length}장)`}
            </button>
            <button className="btn btn--sm" onClick={() => window.print()}>
              🖨 인쇄
            </button>
          </>
        )}
      </div>

      {error && <p className="op-card__error op__no-print">⚠️ {error}</p>}

      {cards.length > 0 ? (
        <div className="qr-print">
          <div className="qr-print__title op__no-print">
            {store?.name} · QR 카드 {cards.length}장
          </div>
          <div className="qr-print__grid">
            {cards.map((c) => (
              <figure className="qr-print__item" key={c.label}>
                <img src={c.url} alt={`${c.label} QR 카드`} className="qr-print__img" />
                <figcaption className="qr-print__cap op__no-print">
                  <span>{c.label}</span>
                  <span className="qr-print__actions">
                    <button className="op__link-btn" onClick={() => downloadBlob(c.blob, fileName(c.label))}>
                      저장
                    </button>
                    {shareable && (
                      <button className="op__link-btn" onClick={() => void shareCard(c)}>
                        공유
                      </button>
                    )}
                  </span>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      ) : (
        !busy && (
          <p className="op__empty op__no-print">
            매장을 선택하고 <strong>카드 생성</strong>을 누르면 테이블 1번부터 순서대로 QR 카드가 만들어집니다.
          </p>
        )
      )}
    </>
  );
}
