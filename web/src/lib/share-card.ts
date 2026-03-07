import type { MatchResult } from '@/types/player';
import { getTeamDisplayName } from '@/constants/analysis-messages';

interface ShareCardOptions {
  userPhotoUrl: string;
  matches: MatchResult[];
}

const SIZE = 1080;
const CX = SIZE / 2;
const F = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

const loadImage = (src: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });

const roundRect = (
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number,
) => {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
};

/** object-fit: cover로 이미지를 그리기 */
const drawCover = (
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number, y: number, w: number, h: number, r: number,
) => {
  ctx.save();
  roundRect(ctx, x, y, w, h, r);
  ctx.clip();
  const s = Math.max(w / img.width, h / img.height);
  const sw = w / s;
  const sh = h / s;
  ctx.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, x, y, w, h);
  ctx.restore();
};

/** 원형으로 이미지 그리기 (+ 흰 테두리) */
const drawCircle = (
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  cx: number, cy: number, r: number,
  borderWidth = 4, borderColor = '#F7F6F3',
) => {
  // 테두리
  ctx.beginPath();
  ctx.arc(cx, cy, r + borderWidth, 0, Math.PI * 2);
  ctx.fillStyle = borderColor;
  ctx.fill();

  // 이미지
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();
  const s = Math.max((r * 2) / img.width, (r * 2) / img.height);
  const sw = (r * 2) / s;
  const sh = (r * 2) / s;
  ctx.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, cx - r, cy - r, r * 2, r * 2);
  ctx.restore();
};

export const generateShareCard = async ({
  userPhotoUrl,
  matches,
}: ShareCardOptions): Promise<Blob> => {
  const top3 = matches.slice(0, 3);
  const top1 = top3[0];
  const pct = (Math.round(top1.similarity * 1000) / 10).toFixed(1);

  const [userImg, ...pImgs] = await Promise.all([
    loadImage(userPhotoUrl),
    ...top3.map((m) => loadImage(m.player.imageUrl)),
  ]);

  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d')!;

  // ── 배경 ──
  ctx.fillStyle = '#F7F6F3';
  ctx.fillRect(0, 0, SIZE, SIZE);

  // ── 상단 브랜드 (심플 텍스트) ──
  ctx.font = `600 24px ${F}`;
  ctx.fillStyle = '#B5B0A8';
  ctx.textAlign = 'center';
  ctx.fillText('⚾  KBO 닮은꼴', CX, 56);

  // ── 선수 사진 (히어로) ──
  const photoW = 520;
  const photoH = 520;
  const photoX = (SIZE - photoW) / 2;
  const photoY = 96;
  const photoR = 36;

  ctx.shadowColor = 'rgba(0,0,0,0.10)';
  ctx.shadowBlur = 48;
  ctx.shadowOffsetY = 12;
  drawCover(ctx, pImgs[0], photoX, photoY, photoW, photoH, photoR);
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  // ── 유저 사진 (원형, 좌하단 오버레이) ──
  const userR = 64;
  const userCX = photoX + 52;
  const userCY = photoY + photoH - 52;
  drawCircle(ctx, userImg, userCX, userCY, userR, 5, '#F7F6F3');

  // "나" 라벨 (유저 원 바로 아래)
  ctx.font = `600 18px ${F}`;
  ctx.fillStyle = '#A5A09A';
  ctx.textAlign = 'center';
  ctx.fillText('나', userCX, userCY + userR + 22);

  // ── 퍼센트 ──
  const pctY = photoY + photoH + 102;
  ctx.font = `800 104px ${F}`;
  ctx.fillStyle = '#1A1917';
  ctx.textAlign = 'center';
  ctx.fillText(`${pct}%`, CX, pctY);

  // ── 선수 정보 ──
  ctx.font = `600 32px ${F}`;
  ctx.fillStyle = '#3D3B37';
  ctx.fillText(`${top1.player.name} 선수와 닮았어요`, CX, pctY + 50);

  ctx.font = `400 25px ${F}`;
  ctx.fillStyle = '#A5A09A';
  ctx.fillText(
    `${getTeamDisplayName(top1.player.teamCode)} · ${top1.player.position}`,
    CX, pctY + 88,
  );

  // ── 2위, 3위 ──
  if (top3.length > 1) {
    const runY = pctY + 156;

    const parts = top3.slice(1).map((m, i) => {
      const p = (Math.round(m.similarity * 1000) / 10).toFixed(1);
      return `${i + 2}위 ${m.player.name} ${p}%`;
    });

    ctx.font = `500 23px ${F}`;
    ctx.fillStyle = '#C5C1BB';
    ctx.fillText(parts.join('      '), CX, runY);
  }

  // ── 하단 URL ──
  ctx.font = `400 21px ${F}`;
  ctx.fillStyle = '#D0CDC8';
  ctx.fillText('lookalike.naco.kr', CX, SIZE - 44);

  // ── PNG ──
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Canvas toBlob failed'))),
      'image/png',
    );
  });
};
