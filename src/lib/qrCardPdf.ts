/**
 * QR 카드 → 인쇄용 PDF.
 * A4 세로 한 장에 3×3 = 9장. 카드 크기 동일, 사이 간격(여유) + 코너 절단 표시.
 */
import type { PDFDocument as PDFDocumentType, PDFPage, Color } from "pdf-lib";

const MM = 2.834645669; // 1mm in PDF points
const A4 = { w: 210 * MM, h: 297 * MM };
const COLS = 3;
const ROWS = 3;
const PER_PAGE = COLS * ROWS;

const PAGE_MARGIN = 9 * MM; // 페이지 가장자리 여백
const GUTTER = 7 * MM; // 카드 사이 간격
const CARD_ASPECT = 561 / 747; // w / h (템플릿 비율)

/** 코너 절단 표시 */
const MARK_LEN = 4 * MM;
const MARK_OFFSET = 2 * MM; // 카드 모서리에서 띄우는 거리
const MARK_GRAY = 0.45;
const MARK_WIDTH = 0.3;

interface PdfCard {
  label: string;
  blob: Blob;
}

/** 셀(카드) 크기 계산 — 3열이 폭에 맞고, 3행이 높이를 넘지 않도록 */
function cellSize() {
  const availW = A4.w - 2 * PAGE_MARGIN - (COLS - 1) * GUTTER;
  const availH = A4.h - 2 * PAGE_MARGIN - (ROWS - 1) * GUTTER;
  let w = availW / COLS;
  let h = w / CARD_ASPECT;
  if (h * ROWS > availH) {
    h = availH / ROWS;
    w = h * CARD_ASPECT;
  }
  return { w, h };
}

function drawCropMarks(page: PDFPage, x: number, y: number, w: number, h: number, color: Color) {
  const opts = { thickness: MARK_WIDTH, color };
  // 각 코너마다 바깥쪽으로 뻗는 짧은 가로/세로 선 (카드 면에는 닿지 않음)
  const corners = [
    { cx: x, cy: y, sx: -1, sy: -1 }, // BL
    { cx: x + w, cy: y, sx: 1, sy: -1 }, // BR
    { cx: x, cy: y + h, sx: -1, sy: 1 }, // TL
    { cx: x + w, cy: y + h, sx: 1, sy: 1 }, // TR
  ];
  for (const c of corners) {
    // 가로 tick
    page.drawLine({
      start: { x: c.cx + c.sx * MARK_OFFSET, y: c.cy },
      end: { x: c.cx + c.sx * (MARK_OFFSET + MARK_LEN), y: c.cy },
      ...opts,
    });
    // 세로 tick
    page.drawLine({
      start: { x: c.cx, y: c.cy + c.sy * MARK_OFFSET },
      end: { x: c.cx, y: c.cy + c.sy * (MARK_OFFSET + MARK_LEN) },
      ...opts,
    });
  }
}

export async function buildCardsPdf(cards: PdfCard[]): Promise<Blob> {
  const { PDFDocument, rgb } = await import("pdf-lib");
  const doc: PDFDocumentType = await PDFDocument.create();
  const markColor = rgb(MARK_GRAY, MARK_GRAY, MARK_GRAY);

  const { w: cardW, h: cardH } = cellSize();
  const blockW = cardW * COLS + GUTTER * (COLS - 1);
  const blockH = cardH * ROWS + GUTTER * (ROWS - 1);
  const originX = (A4.w - blockW) / 2;
  const originY = (A4.h - blockH) / 2;

  // 이미지 임베드 (같은 blob 이 여러 장일 일은 없지만 캐시)
  const embedded = await Promise.all(
    cards.map(async (c) => doc.embedPng(await c.blob.arrayBuffer())),
  );

  for (let i = 0; i < cards.length; i += PER_PAGE) {
    const page = doc.addPage([A4.w, A4.h]);
    const slice = embedded.slice(i, i + PER_PAGE);
    slice.forEach((img, k) => {
      const col = k % COLS;
      const row = Math.floor(k / COLS);
      const x = originX + col * (cardW + GUTTER);
      const y = originY + (ROWS - 1 - row) * (cardH + GUTTER); // row 0 = 위
      page.drawImage(img, { x, y, width: cardW, height: cardH });
      drawCropMarks(page, x, y, cardW, cardH, markColor);
    });
  }

  const bytes = await doc.save();
  return new Blob([bytes.buffer as ArrayBuffer], { type: "application/pdf" });
}
