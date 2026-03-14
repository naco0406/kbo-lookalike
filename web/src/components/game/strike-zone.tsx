import type { FC } from 'react';
import { useId } from 'react';
import type { ParsedPitch, PitchResult } from './pitch-utils';
import { PITCH_RESULT_COLOR } from './pitch-utils';
import { cn } from '@/lib/utils';

// ── 좌표 상수 ───────────────────────────────────────────────────────────────
// 단위: feet. 홈플레이트 폭 17in = 1.4167ft, 중심 = 0

const PLATE_HALF_W = 0.7083;

// 표시 영역 (스트라이크존 + 여유 공간)
const X_MIN = -1.6;
const X_MAX = 1.6;
const Z_MIN = 0.3;
const Z_MAX = 4.7;

// SVG viewport
const W = 220;
const H = 280;

const toX = (ft: number) => ((ft - X_MIN) / (X_MAX - X_MIN)) * W;
const toY = (ft: number) => ((Z_MAX - ft) / (Z_MAX - Z_MIN)) * H;

// ── Sub-components ──────────────────────────────────────────────────────────

const ZoneGrid: FC<{ topSz: number; bottomSz: number; uid: string }> = ({ topSz, bottomSz, uid }) => {
  const x1 = toX(-PLATE_HALF_W);
  const x2 = toX(PLATE_HALF_W);
  const y1 = toY(topSz);
  const y2 = toY(bottomSz);
  const zw = x2 - x1;
  const zh = y2 - y1;

  return (
    <g>
      {/* 존 배경 — 미세한 그라데이션 (unique ID per instance) */}
      <defs>
        <linearGradient id={`${uid}-zone-bg`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity={0.03} />
          <stop offset="100%" stopColor="currentColor" stopOpacity={0.06} />
        </linearGradient>
      </defs>
      <rect x={x1} y={y1} width={zw} height={zh} fill={`url(#${uid}-zone-bg)`} rx={2} />

      {/* 존 외곽선 */}
      <rect
        x={x1} y={y1} width={zw} height={zh}
        fill="none" stroke="currentColor" strokeWidth={1.2} opacity={0.25} rx={2}
      />

      {/* 9분할 격자 */}
      {[1, 2].map(i => (
        <line
          key={`v${i}`}
          x1={x1 + (zw / 3) * i} y1={y1}
          x2={x1 + (zw / 3) * i} y2={y2}
          stroke="currentColor" strokeWidth={0.5} opacity={0.1}
          strokeDasharray="3 3"
        />
      ))}
      {[1, 2].map(i => (
        <line
          key={`h${i}`}
          x1={x1} y1={y1 + (zh / 3) * i}
          x2={x2} y2={y1 + (zh / 3) * i}
          stroke="currentColor" strokeWidth={0.5} opacity={0.1}
          strokeDasharray="3 3"
        />
      ))}

      {/* Section label */}
      <text
        x={x1} y={y1 - 6}
        fontSize={7} fill="currentColor" opacity={0.12}
        fontWeight={500} letterSpacing={0.6}
      >
        ZONE
      </text>
    </g>
  );
};

const HomePlate: FC<{ bottomSz: number }> = ({ bottomSz }) => {
  const cx = W / 2;
  const plateTop = toY(bottomSz) + 12;
  const hw = (toX(PLATE_HALF_W) - toX(-PLATE_HALF_W)) * 0.5;

  const pts = [
    `${cx - hw},${plateTop}`,
    `${cx + hw},${plateTop}`,
    `${cx + hw},${plateTop + 6}`,
    `${cx},${plateTop + 13}`,
    `${cx - hw},${plateTop + 6}`,
  ].join(' ');

  return <polygon points={pts} fill="currentColor" opacity={0.12} />;
};

const PitchDot: FC<{
  pitch: ParsedPitch;
  index: number;
  total: number;
  isActive: boolean;
  isLatest: boolean;
}> = ({ pitch, index, total, isActive, isLatest }) => {
  if (!pitch.location) return null;

  const cx = toX(pitch.location.x);
  const cy = toY(pitch.location.z);
  const color = PITCH_RESULT_COLOR[pitch.result];

  // 사이즈: 활성 > 최신 > 기본. 오래된 투구일수록 약간 작아짐
  const baseR = isActive ? 11 : isLatest ? 9 : 7;
  const opacity = isActive || isLatest ? 1 : 0.4 + (index / total) * 0.35;

  return (
    <g className={cn(isLatest && !isActive && 'animate-[pulse_2s_ease-in-out_infinite]')}>
      {/* 글로우 */}
      {(isActive || isLatest) && (
        <circle cx={cx} cy={cy} r={baseR + 5} fill={color} opacity={0.12} />
      )}

      {/* 메인 도트 */}
      <circle
        cx={cx} cy={cy} r={baseR}
        fill={color} opacity={opacity}
        stroke="rgba(0,0,0,0.25)" strokeWidth={0.8}
      />

      {/* 번호 */}
      <text
        x={cx} y={cy + 0.5}
        textAnchor="middle" dominantBaseline="middle"
        fill="white" fontSize={isActive ? 9 : 7.5} fontWeight={700}
        style={{ textShadow: '0 1px 2px rgba(0,0,0,0.25)' }}
      >
        {pitch.number}
      </text>
    </g>
  );
};

// ── Legend ───────────────────────────────────────────────────────────────────

const Legend: FC = () => {
  const items: Array<{ result: PitchResult; label: string }> = [
    { result: 'B', label: '볼' },
    { result: 'T', label: '스트라이크' },
    { result: 'S', label: '헛스윙' },
    { result: 'F', label: '파울' },
    { result: 'H', label: '인플레이' },
  ];

  return (
    <div className="mt-1.5 flex items-center justify-center gap-3">
      {items.map(({ result, label }) => (
        <div key={result} className="flex items-center gap-1">
          <span
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: PITCH_RESULT_COLOR[result] }}
          />
          <span className="text-[9px] text-muted-foreground/60">{label}</span>
        </div>
      ))}
    </div>
  );
};

// ── Main Component ──────────────────────────────────────────────────────────

interface StrikeZoneProps {
  pitches: ParsedPitch[];
  activePitchIndex?: number;
  showLegend?: boolean;
  className?: string;
}

export const StrikeZone: FC<StrikeZoneProps> = ({
  pitches,
  activePitchIndex,
  showLegend = false,
  className,
}) => {
  const uid = useId().replace(/:/g, '');
  const topSz = pitches[0]?.topSz ?? 3.4;
  const bottomSz = pitches[0]?.bottomSz ?? 1.6;

  return (
    <div className={cn('flex flex-col items-center', className)}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        role="img"
        aria-label="스트라이크존"
      >
        <ZoneGrid topSz={topSz} bottomSz={bottomSz} uid={uid} />
        <HomePlate bottomSz={bottomSz} />

        {pitches.map((pitch, i) => (
          <PitchDot
            key={i}
            pitch={pitch}
            index={i}
            total={pitches.length}
            isActive={activePitchIndex === i}
            isLatest={i === pitches.length - 1 && activePitchIndex === undefined}
          />
        ))}
      </svg>

      {showLegend && <Legend />}
    </div>
  );
};
