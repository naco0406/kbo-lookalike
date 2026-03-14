import type { FC } from 'react';
import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import type { ParsedAtBat } from './pitch-utils';

// ── Layout ──────────────────────────────────────────────────────────────────

const SVG_W = 400;
const SVG_H = 140;
const PAD = { left: 32, right: 12, top: 16, bottom: 24 };
const DRAW_W = SVG_W - PAD.left - PAD.right;
const DRAW_H = SVG_H - PAD.top - PAD.bottom;

const toX = (i: number, total: number) =>
  PAD.left + (total <= 1 ? DRAW_W / 2 : (i / (total - 1)) * DRAW_W);
const toY = (pct: number) =>
  PAD.top + ((100 - pct) / 100) * DRAW_H;

// ── Types ───────────────────────────────────────────────────────────────────

interface WpaPoint {
  index: number;
  homeWinRate: number;
  inning: number;
  isHome: boolean;
  isScoring: boolean; // WPA > 5% or < -5%
  batterName: string;
}

// ── Main Component ──────────────────────────────────────────────────────────

interface WinProbabilityChartProps {
  atBats: ParsedAtBat[];
  homeTeamName?: string;
  awayTeamName?: string;
  homeColor?: string;
  awayColor?: string;
  className?: string;
}

export const WinProbabilityChart: FC<WinProbabilityChartProps> = ({
  atBats,
  homeTeamName = '홈',
  awayTeamName = '원정',
  homeColor = '#4ade80',
  awayColor = '#60a5fa',
  className,
}) => {
  const points = useMemo(() => {
    const pts: WpaPoint[] = [];
    for (const ab of atBats) {
      if (ab.homeWinRate === null) continue;
      pts.push({
        index: pts.length,
        homeWinRate: ab.homeWinRate,
        inning: ab.inning,
        isHome: ab.isHome,
        isScoring: ab.wpa !== null && Math.abs(ab.wpa) >= 5,
        batterName: ab.batterName,
      });
    }
    return pts;
  }, [atBats]);

  if (points.length < 2) {
    return (
      <div className={cn('flex items-center justify-center py-8', className)}>
        <p className="text-[12px] text-muted-foreground/40">승리 확률 데이터가 부족합니다</p>
      </div>
    );
  }

  const total = points.length;

  // Build path
  const linePath = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${toX(i, total).toFixed(1)},${toY(p.homeWinRate).toFixed(1)}`)
    .join(' ');

  // Area fill (above 50% → home color, below 50% → away color)
  // We'll use two clip paths to separate above/below 50%
  const areaPath = `${linePath} L${toX(total - 1, total).toFixed(1)},${toY(50).toFixed(1)} L${toX(0, total).toFixed(1)},${toY(50).toFixed(1)} Z`;

  // Inning boundaries for grid lines
  const inningBoundaries: Array<{ x: number; inn: number }> = [];
  for (let i = 1; i < points.length; i++) {
    if (points[i].inning !== points[i - 1].inning || (points[i].isHome !== points[i - 1].isHome && !points[i].isHome)) {
      // New inning starts (top half)
      if (points[i].inning !== points[i - 1].inning) {
        inningBoundaries.push({ x: toX(i, total), inn: points[i].inning });
      }
    }
  }

  // Key moments (big WPA swings)
  const keyMoments = points.filter(p => p.isScoring);

  const y50 = toY(50);

  return (
    <div className={cn('flex flex-col', className)}>
      <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} className="w-full">
        <defs>
          {/* Clip for above 50% */}
          <clipPath id="wpa-clip-above">
            <rect x={PAD.left} y={PAD.top} width={DRAW_W} height={y50 - PAD.top} />
          </clipPath>
          {/* Clip for below 50% */}
          <clipPath id="wpa-clip-below">
            <rect x={PAD.left} y={y50} width={DRAW_W} height={PAD.top + DRAW_H - y50} />
          </clipPath>
        </defs>

        {/* Grid lines */}
        {[25, 50, 75].map(pct => (
          <g key={pct}>
            <line
              x1={PAD.left} y1={toY(pct)} x2={SVG_W - PAD.right} y2={toY(pct)}
              stroke="currentColor" strokeWidth={pct === 50 ? 0.8 : 0.4}
              opacity={pct === 50 ? 0.15 : 0.06}
              strokeDasharray={pct === 50 ? undefined : '2 4'}
            />
            <text
              x={PAD.left - 5} y={toY(pct) + 1.5}
              textAnchor="end" fontSize={6} fill="currentColor"
              opacity={pct === 50 ? 0.2 : 0.12}
            >
              {pct}%
            </text>
          </g>
        ))}

        {/* Inning boundaries */}
        {inningBoundaries.map(({ x, inn }) => (
          <g key={`inn-${inn}`}>
            <line
              x1={x} y1={PAD.top} x2={x} y2={PAD.top + DRAW_H}
              stroke="currentColor" strokeWidth={0.3} opacity={0.06}
            />
            <text
              x={x} y={PAD.top + DRAW_H + 12}
              textAnchor="middle" fontSize={6} fill="currentColor" opacity={0.15}
            >
              {inn}
            </text>
          </g>
        ))}

        {/* Area fills */}
        <path d={areaPath} fill={homeColor} opacity={0.08} clipPath="url(#wpa-clip-above)" />
        <path d={areaPath} fill={awayColor} opacity={0.08} clipPath="url(#wpa-clip-below)" />

        {/* Main line */}
        <path
          d={linePath} fill="none" stroke="currentColor"
          strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"
          opacity={0.5}
        />

        {/* Key moment dots */}
        {keyMoments.map(p => {
          const cx = toX(p.index, total);
          const cy = toY(p.homeWinRate);
          const dotColor = p.homeWinRate >= 50 ? homeColor : awayColor;
          return (
            <g key={p.index}>
              <circle cx={cx} cy={cy} r={4} fill={dotColor} opacity={0.15} />
              <circle cx={cx} cy={cy} r={2.5} fill={dotColor} opacity={0.7}
                stroke="rgba(0,0,0,0.1)" strokeWidth={0.3} />
            </g>
          );
        })}

        {/* Start/end dots */}
        <circle
          cx={toX(0, total)} cy={toY(points[0].homeWinRate)}
          r={2} fill="currentColor" opacity={0.2}
        />
        <circle
          cx={toX(total - 1, total)} cy={toY(points[total - 1].homeWinRate)}
          r={3} fill={points[total - 1].homeWinRate >= 50 ? homeColor : awayColor}
          stroke="rgba(0,0,0,0.1)" strokeWidth={0.3}
        />

        {/* Team labels at y-axis */}
        <text
          x={PAD.left - 5} y={PAD.top + 4}
          textAnchor="end" fontSize={6} fill={homeColor} opacity={0.5}
          fontWeight={600}
        >
          {homeTeamName}
        </text>
        <text
          x={PAD.left - 5} y={PAD.top + DRAW_H - 1}
          textAnchor="end" fontSize={6} fill={awayColor} opacity={0.5}
          fontWeight={600}
        >
          {awayTeamName}
        </text>

        {/* Final win probability label */}
        {(() => {
          const last = points[total - 1];
          const cx = toX(total - 1, total);
          const cy = toY(last.homeWinRate);
          const isHomeWinning = last.homeWinRate >= 50;
          const labelColor = isHomeWinning ? homeColor : awayColor;
          const pct = isHomeWinning ? last.homeWinRate : 100 - last.homeWinRate;
          return (
            <g>
              <text
                x={cx} y={cy - 8}
                textAnchor="end" fontSize={8} fill={labelColor}
                fontWeight={700} opacity={0.7}
              >
                {pct.toFixed(1)}%
              </text>
            </g>
          );
        })()}
      </svg>
    </div>
  );
};
