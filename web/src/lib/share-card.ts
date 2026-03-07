import type { MatchResult } from '@/types/player';

interface ShareCardOptions {
  userPhotoUrl: string;
  matches: MatchResult[]; // Top 3 이상
}

// Canvas 공유 카드 (1080×1350, 4:5 비율)
const WIDTH = 1080;
const HEIGHT = 1350;
const FONT_FAMILY = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

const loadImage = (src: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });

const drawRoundedRect = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
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

const drawCircleImage = (
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  cx: number,
  cy: number,
  radius: number,
) => {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.clip();

  const scale = Math.max((radius * 2) / img.width, (radius * 2) / img.height);
  const sw = (radius * 2) / scale;
  const sh = (radius * 2) / scale;
  const sx = (img.width - sw) / 2;
  const sy = (img.height - sh) / 2;
  ctx.drawImage(img, sx, sy, sw, sh, cx - radius, cy - radius, radius * 2, radius * 2);

  ctx.restore();
};

const drawImageCover = (
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number,
) => {
  ctx.save();
  drawRoundedRect(ctx, x, y, w, h, radius);
  ctx.clip();

  const scale = Math.max(w / img.width, h / img.height);
  const sw = w / scale;
  const sh = h / scale;
  const sx = (img.width - sw) / 2;
  const sy = (img.height - sh) / 2;
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);

  ctx.restore();
};

export const generateShareCard = async ({
  userPhotoUrl,
  matches,
}: ShareCardOptions): Promise<Blob> => {
  const top3 = matches.slice(0, 3);

  // 이미지 병렬 로드
  const [userImg, ...playerImgs] = await Promise.all([
    loadImage(userPhotoUrl),
    ...top3.map((m) => loadImage(m.player.imageUrl)),
  ]);

  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext('2d')!;

  // ── 배경 ──
  ctx.fillStyle = '#fafafa';
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // ── 상단 브랜딩 ──
  ctx.font = `bold 38px ${FONT_FAMILY}`;
  ctx.fillStyle = '#1a1a1a';
  ctx.textAlign = 'center';
  ctx.fillText('KBO 닮은꼴', WIDTH / 2, 80);

  ctx.font = `400 24px ${FONT_FAMILY}`;
  ctx.fillStyle = '#999';
  ctx.fillText('나와 닮은 KBO 선수는?', WIDTH / 2, 118);

  // ── 구분선 ──
  ctx.strokeStyle = '#e5e5e5';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(100, 150);
  ctx.lineTo(WIDTH - 100, 150);
  ctx.stroke();

  // ══════════════════════════════════════
  // ── 1위: 유저 사진 vs 선수 사진 (대형) ──
  // ══════════════════════════════════════
  const top1 = top3[0];
  const top1Percent = (Math.round(top1.similarity * 1000) / 10).toFixed(1);
  const heroY = 200;
  const heroPhotoSize = 300;
  const heroGap = 80;
  const heroLeftX = (WIDTH - heroPhotoSize * 2 - heroGap) / 2;
  const heroRightX = heroLeftX + heroPhotoSize + heroGap;

  // 그림자
  ctx.shadowColor = 'rgba(0, 0, 0, 0.1)';
  ctx.shadowBlur = 24;
  ctx.shadowOffsetY = 6;

  drawImageCover(ctx, userImg, heroLeftX, heroY, heroPhotoSize, heroPhotoSize, 20);
  drawImageCover(ctx, playerImgs[0], heroRightX, heroY, heroPhotoSize, heroPhotoSize, 20);

  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  // VS 배지
  const vsX = WIDTH / 2;
  const vsY = heroY + heroPhotoSize / 2;
  ctx.beginPath();
  ctx.arc(vsX, vsY, 32, 0, Math.PI * 2);
  ctx.fillStyle = '#1a1a1a';
  ctx.fill();
  ctx.font = `bold 22px ${FONT_FAMILY}`;
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('VS', vsX, vsY);
  ctx.textBaseline = 'alphabetic';

  // 사진 아래 라벨
  ctx.font = `500 26px ${FONT_FAMILY}`;
  ctx.fillStyle = '#888';
  ctx.fillText('나', heroLeftX + heroPhotoSize / 2, heroY + heroPhotoSize + 40);

  // 1위 매칭률 + 이름
  const match1Y = heroY + heroPhotoSize + 40;
  ctx.font = `bold 28px ${FONT_FAMILY}`;
  ctx.fillStyle = '#1a1a1a';
  ctx.fillText(top1.player.name, heroRightX + heroPhotoSize / 2, match1Y);

  // 퍼센트 (대형)
  const percentY = match1Y + 80;
  ctx.font = `bold 100px ${FONT_FAMILY}`;
  ctx.fillStyle = '#1a1a1a';
  ctx.textAlign = 'center';
  ctx.fillText(`${top1Percent}%`, WIDTH / 2, percentY);

  ctx.font = `600 28px ${FONT_FAMILY}`;
  ctx.fillStyle = '#999';
  ctx.fillText('MATCH', WIDTH / 2, percentY + 40);

  // 1위 팀 정보
  ctx.font = `500 26px ${FONT_FAMILY}`;
  ctx.fillStyle = '#888';
  ctx.fillText(
    `${top1.player.team} · ${top1.player.position}`,
    WIDTH / 2,
    percentY + 80,
  );

  // ══════════════════════════════════
  // ── 2위, 3위: 하단에 나란히 ──
  // ══════════════════════════════════
  const runnerUpY = percentY + 140;

  // 구분선
  ctx.strokeStyle = '#e5e5e5';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(100, runnerUpY - 20);
  ctx.lineTo(WIDTH - 100, runnerUpY - 20);
  ctx.stroke();

  const runnerUpRadius = 60;
  const runnerUpSpacing = 280;

  for (let i = 1; i < Math.min(top3.length, 3); i++) {
    const m = top3[i];
    const percent = (Math.round(m.similarity * 1000) / 10).toFixed(1);
    const colX = WIDTH / 2 + (i === 1 ? -runnerUpSpacing / 2 : runnerUpSpacing / 2);

    // 순위 배지 배경
    ctx.shadowColor = 'rgba(0, 0, 0, 0.06)';
    ctx.shadowBlur = 12;
    ctx.shadowOffsetY = 3;

    drawCircleImage(ctx, playerImgs[i], colX, runnerUpY + runnerUpRadius, runnerUpRadius);

    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    // 순위 배지
    const badgeX = colX - runnerUpRadius + 8;
    const badgeY = runnerUpY + 8;
    ctx.beginPath();
    ctx.arc(badgeX, badgeY, 18, 0, Math.PI * 2);
    ctx.fillStyle = '#666';
    ctx.fill();
    ctx.font = `bold 18px ${FONT_FAMILY}`;
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${i + 1}`, badgeX, badgeY);
    ctx.textBaseline = 'alphabetic';

    // 이름
    ctx.font = `bold 28px ${FONT_FAMILY}`;
    ctx.fillStyle = '#1a1a1a';
    ctx.textAlign = 'center';
    ctx.fillText(m.player.name, colX, runnerUpY + runnerUpRadius * 2 + 38);

    // 퍼센트
    ctx.font = `bold 32px ${FONT_FAMILY}`;
    ctx.fillStyle = '#555';
    ctx.fillText(`${percent}%`, colX, runnerUpY + runnerUpRadius * 2 + 76);

    // 팀
    ctx.font = `400 22px ${FONT_FAMILY}`;
    ctx.fillStyle = '#aaa';
    ctx.fillText(m.player.team, colX, runnerUpY + runnerUpRadius * 2 + 108);
  }

  // ── 하단 CTA ──
  ctx.font = `500 24px ${FONT_FAMILY}`;
  ctx.fillStyle = '#bbb';
  ctx.textAlign = 'center';
  ctx.fillText('lookalike.naco.kr', WIDTH / 2, HEIGHT - 60);

  // ── PNG 출력 (고퀄리티) ──
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Canvas toBlob failed'))),
      'image/png',
    );
  });
};
