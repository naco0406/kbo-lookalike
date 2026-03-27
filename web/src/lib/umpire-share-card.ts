/**
 * 심판 게임 결과를 1080×1080 PNG 이미지로 생성한다.
 * Canvas API로 렌더링 → Blob 반환.
 */

interface UmpireShareCardOptions {
  pct: number;
  gradeLabel: string;
  gradeSub: string;
  gradeColor: string;
  correct: number;
  total: number;
  maxStreak: number;
  avgReactionMs: number;
  ballPct: number;
  strikePct: number;
  avgDifficulty: number;
  judgments: Array<{ correct: boolean; guess: string }>;
}

const SIZE = 1080;
const CX = SIZE / 2;
const F = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
const FB = `"Bebas Neue", ${F}`;

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

export const generateUmpireShareCard = (opts: UmpireShareCardOptions): Promise<Blob> => {
  const {
    pct, gradeLabel, gradeSub, gradeColor,
    correct, total, maxStreak, avgReactionMs,
    ballPct, strikePct, avgDifficulty, judgments,
  } = opts;

  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    canvas.width = SIZE;
    canvas.height = SIZE;
    const ctx = canvas.getContext('2d');
    if (!ctx) return reject(new Error('Canvas not supported'));

    // ── Background ──
    ctx.fillStyle = '#0f1923';
    ctx.fillRect(0, 0, SIZE, SIZE);

    // ── Grade glow circle ──
    const grad = ctx.createRadialGradient(CX, 300, 40, CX, 300, 280);
    grad.addColorStop(0, gradeColor + '25');
    grad.addColorStop(1, 'transparent');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, SIZE, SIZE);

    // ── 643 watermark top ──
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.font = `42px ${FB}`;
    ctx.textAlign = 'center';
    ctx.fillText('643', CX, 70);

    // ── Grade badge ──
    const badgeW = ctx.measureText(gradeLabel).width + 48;
    roundRect(ctx, CX - badgeW / 2, 130, badgeW, 44, 22);
    ctx.fillStyle = gradeColor + '30';
    ctx.fill();
    ctx.fillStyle = gradeColor;
    ctx.font = `bold 20px ${F}`;
    ctx.textAlign = 'center';
    ctx.letterSpacing = '4px';
    ctx.fillText(gradeLabel, CX, 159);
    ctx.letterSpacing = '0px';

    // ── Score ──
    ctx.fillStyle = gradeColor;
    ctx.font = `120px ${FB}`;
    ctx.fillText(String(pct), CX, 310);

    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.font = `bold 28px ${F}`;
    ctx.fillText('점', CX + 75, 310);

    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = `500 22px ${F}`;
    ctx.fillText(gradeSub, CX, 350);

    // ── 3 Stats row ──
    const statsY = 430;
    const statsGap = 200;

    const drawStat = (x: number, value: string, label: string) => {
      ctx.fillStyle = '#f2f0eb';
      ctx.font = `900 38px ${F}`;
      ctx.textAlign = 'center';
      ctx.fillText(value, x, statsY);
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.font = `500 16px ${F}`;
      ctx.fillText(label, x, statsY + 28);
    };

    drawStat(CX - statsGap, `${correct}/${total}`, '정답');
    drawStat(CX, String(maxStreak), '최대 연속');
    drawStat(CX + statsGap, avgReactionMs > 0 ? `${(avgReactionMs / 1000).toFixed(1)}s` : '-', '평균 반응');

    // ── Dividers ──
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(CX - 100, statsY - 28);
    ctx.lineTo(CX - 100, statsY + 32);
    ctx.moveTo(CX + 100, statsY - 28);
    ctx.lineTo(CX + 100, statsY + 32);
    ctx.stroke();

    // ── 2×2 Grid ──
    const gridY = 520;
    const gridW = 420;
    const gridH = 140;
    const gridGap = 16;
    const gridLeft = CX - gridW - gridGap / 2;

    const drawGridCell = (x: number, y: number, label: string, value: string, color: string) => {
      roundRect(ctx, x, y, gridW, gridH, 20);
      ctx.fillStyle = '#1a2733';
      ctx.fill();
      ctx.fillStyle = color;
      ctx.font = `bold 16px ${F}`;
      ctx.textAlign = 'center';
      ctx.fillText(label, x + gridW / 2, y + 40);
      ctx.font = `900 36px ${F}`;
      ctx.fillText(value, x + gridW / 2, y + 90);
    };

    drawGridCell(gridLeft, gridY, 'BALL', `${ballPct}%`, '#3b82f6');
    drawGridCell(gridLeft + gridW + gridGap, gridY, 'STRIKE', `${strikePct}%`, '#ef4444');
    drawGridCell(gridLeft, gridY + gridH + gridGap, '난이도', '★'.repeat(Math.round(avgDifficulty)), '#f59e0b');
    drawGridCell(gridLeft + gridW + gridGap, gridY + gridH + gridGap, 'CLOSE CALL', `${judgments.filter(j => j.correct).length}`, '#a855f7');

    // ── Pitch strip ──
    const stripY = 840;
    const dotSize = 28;
    const dotGap = 4;
    const totalStripW = judgments.length * (dotSize + dotGap) - dotGap;
    const stripStartX = CX - totalStripW / 2;

    judgments.forEach((j, i) => {
      const x = stripStartX + i * (dotSize + dotGap);
      roundRect(ctx, x, stripY, dotSize, dotSize, 6);
      if (j.correct) {
        ctx.fillStyle = 'rgba(34,197,94,0.15)';
        ctx.fill();
        ctx.fillStyle = '#22c55e';
      } else if (j.guess === 'timeout') {
        ctx.fillStyle = 'rgba(245,158,11,0.15)';
        ctx.fill();
        ctx.fillStyle = '#f59e0b';
      } else {
        ctx.fillStyle = 'rgba(239,68,68,0.15)';
        ctx.fill();
        ctx.fillStyle = '#ef4444';
      }
      ctx.font = `bold 12px ${F}`;
      ctx.textAlign = 'center';
      ctx.fillText(
        j.correct ? 'O' : j.guess === 'timeout' ? 'T' : 'X',
        x + dotSize / 2, stripY + dotSize / 2 + 4,
      );
    });

    // ── Bottom text ──
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.font = `28px ${FB}`;
    ctx.textAlign = 'center';
    ctx.fillText('643', CX, SIZE - 50);

    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.font = `14px ${F}`;
    ctx.fillText('puttheballinthebox.com', CX, SIZE - 25);

    // ── Export ──
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Failed to create blob'))),
      'image/png',
    );
  });
};
