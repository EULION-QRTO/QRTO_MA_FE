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
  /** QR 위치·크기 (템플릿 픽셀 실측). cover 는 베이크된 QR 을 가리는 여유 */
  qr: { x: 41, y: 41, size: 478, coverPad: 9 },
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

  // 2) QR 교체 (기존 QR 을 주황으로 덮고 새 QR 을 얹음)
  const q = TPL.qr;
  ctx.fillStyle = TPL.orange;
  ctx.fillRect(q.x - q.coverPad, q.y - q.coverPad, q.size + q.coverPad * 2, q.size + q.coverPad * 2);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(qr, q.x, q.y, q.size, q.size);
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
