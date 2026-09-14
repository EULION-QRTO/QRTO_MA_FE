/**
 * QR 카드 생성 — src/assets/TableQR.svg 템플릿에 맞춰 canvas 로 합성.
 *
 * 템플릿(561×747, #FF6000 라운드 카드)에서 자동으로 바뀌는 부분:
 *  - QR 영역: 서버가 준 매장/테이블별 QR 로 교체 (흰 모듈, transparent PNG)
 *  - 우측 하단 "{주점이름} T{번호}" 텍스트: 주점 이름 40px + 테이블 라벨 64px (SUITE ExtraBold)
 * 나머지(Lpay 워드마크, 멋사대학, 배경/테두리)는 템플릿 그대로 둔다.
 *
 * 좌표는 템플릿 SVG 를 눈금자로 실측한 값(SVG 유닛 = 561×747 기준).
 */
import templateSrc from "@/assets/TableQR.png";

const TPL = {
  w: 561,
  h: 747,
  orange: "#FF6000",
  ink: "#F9F9F9",
  /**
   * QR 배치: 카드 가장자리에서 41px 여백. (561 - 41*2 = 479)
   * 서버 QR 의 투명 quiet zone 은 잘라내고 코드 부분만 이 영역을 채운다.
   */
  qr: { margin: 41, coverPad: 12 },
  text: {
    /** 오른쪽 정렬 기준선 x (베이크된 "T2" 오른쪽 끝), 알파벳 baseline y */
    right: 505,
    baseline: 599,
    /** 이름과 라벨 사이 간격 */
    gap: 12,
    nameSize: 40,
    labelSize: 64,
    /** 주점 이름 왼쪽 한계 (Lpay 워드마크는 x≤139). 넘으면 폰트 축소 */
    nameLeft: 172,
    nameSizeMin: 22,
    /** 베이크된 "멋사포차 T2"(x 285~505, y 553~604) 를 가리는 사각형 */
    cover: { x: 272, y: 544, w: 246, h: 70 },
  },
};

export interface TableCardInput {
  /** 서버 QR PNG 의 object URL (transparent=true 권장) */
  qrUrl: string;
  /** 주점 이름 */
  storeName: string;
  /** 테이블 라벨 — "T1", "T2" … 또는 "포장" */
  label: string;
}

function loadImg(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const im = new Image();
    im.onload = () => resolve(im);
    im.onerror = () => reject(new Error(`이미지 로드 실패: ${src}`));
    im.src = src;
  });
}

let templateImgP: Promise<HTMLImageElement> | null = null;

/**
 * 서버 QR 이미지에서 실제 코드 영역(불투명 픽셀)의 정사각 bbox 를 찾는다.
 * transparent=true 요청 시 quiet zone 은 알파 0 이므로 이걸로 여백을 제거한다.
 * 알파 정보가 없으면(불투명 PNG) 전체 이미지를 그대로 사용.
 */
function qrContentBox(img: HTMLImageElement): { sx: number; sy: number; s: number } {
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  const off = document.createElement("canvas");
  off.width = w;
  off.height = h;
  const octx = off.getContext("2d", { willReadFrequently: true });
  if (!octx) return { sx: 0, sy: 0, s: Math.min(w, h) };
  octx.drawImage(img, 0, 0);
  let data: Uint8ClampedArray;
  try {
    data = octx.getImageData(0, 0, w, h).data;
  } catch {
    return { sx: 0, sy: 0, s: Math.min(w, h) };
  }
  let minX = w;
  let minY = h;
  let maxX = -1;
  let maxY = -1;
  const A = 8; // 성능: 8px 간격 샘플
  for (let y = 0; y < h; y += A) {
    for (let x = 0; x < w; x += A) {
      if (data[(y * w + x) * 4 + 3] > 16) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return { sx: 0, sy: 0, s: Math.min(w, h) }; // 전부 투명 → 통짜 사용
  // 정사각형으로 맞춤 (샘플 간격만큼 여유)
  const bw = maxX - minX + A;
  const bh = maxY - minY + A;
  const s = Math.max(bw, bh);
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  return {
    sx: Math.max(0, cx - s / 2),
    sy: Math.max(0, cy - s / 2),
    s: Math.min(s, w, h),
  };
}

async function ensureFont(): Promise<void> {
  try {
    await Promise.all([
      document.fonts.load("800 64px SUITE"),
      document.fonts.load("800 40px SUITE"),
    ]);
    await document.fonts.ready;
  } catch {
    /* 폰트 로드 실패 시 시스템 폰트로 진행 (문구는 나옴) */
  }
}

/**
 * 카드 한 장을 PNG Blob 으로 렌더링한다.
 * @param scale 출력 배율 (기본 4 → 2244×2988, 제공된 PNG 와 동일 해상도)
 */
export async function renderTableCard(input: TableCardInput, scale = 4): Promise<Blob> {
  const [tpl, qr] = await Promise.all([
    (templateImgP ??= loadImg(templateSrc)),
    loadImg(input.qrUrl),
    ensureFont(),
  ]);

  const canvas = document.createElement("canvas");
  canvas.width = TPL.w * scale;
  canvas.height = TPL.h * scale;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas 2d 컨텍스트를 만들 수 없습니다.");
  ctx.scale(scale, scale);

  // 1) 템플릿
  ctx.drawImage(tpl, 0, 0, TPL.w, TPL.h);

  // 2) QR 교체 — 기존 QR 을 주황으로 덮고, 서버 QR 의 코드 부분(투명 여백 제외)을
  //    카드 가장자리 41px 여백에 맞춰 그린다.
  const dSize = TPL.w - TPL.qr.margin * 2; // 479
  const dX = TPL.qr.margin;
  const dY = TPL.qr.margin;
  const pad = TPL.qr.coverPad;
  ctx.fillStyle = TPL.orange;
  ctx.fillRect(dX - pad, dY - pad, dSize + pad * 2, dSize + pad * 2);
  const box = qrContentBox(qr);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(qr, box.sx, box.sy, box.s, box.s, dX, dY, dSize, dSize);
  ctx.imageSmoothingEnabled = true;

  // 3) 텍스트 교체
  const t = TPL.text;
  ctx.fillStyle = TPL.orange;
  ctx.fillRect(t.cover.x, t.cover.y, t.cover.w, t.cover.h);
  ctx.fillStyle = TPL.ink;
  ctx.textAlign = "right";
  ctx.textBaseline = "alphabetic";

  ctx.font = `800 ${t.labelSize}px SUITE, sans-serif`;
  ctx.fillText(input.label, t.right, t.baseline);
  const labelW = ctx.measureText(input.label).width;

  // 주점 이름 — Lpay 워드마크와 겹치면 폰트를 줄여 맞춘다
  const nameRight = t.right - labelW - t.gap;
  const nameMaxW = nameRight - t.nameLeft;
  let nameSize = t.nameSize;
  ctx.font = `800 ${nameSize}px SUITE, sans-serif`;
  const measured = ctx.measureText(input.storeName).width;
  if (measured > nameMaxW && nameMaxW > 0) {
    nameSize = Math.max(t.nameSizeMin, Math.floor(nameSize * (nameMaxW / measured)));
    ctx.font = `800 ${nameSize}px SUITE, sans-serif`;
  }
  ctx.fillText(input.storeName, nameRight, t.baseline);

  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("PNG 생성 실패"))),
      "image/png",
    ),
  );
}
