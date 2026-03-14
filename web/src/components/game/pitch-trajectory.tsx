import type { FC } from 'react';
import { useId } from 'react';
import type { ParsedPitch } from './pitch-utils';
import { computeTrajectoryPoints, PITCH_RESULT_COLOR, PITCH_RESULT_LABEL } from './pitch-utils';
import { cn } from '@/lib/utils';

// ── Layout ──────────────────────────────────────────────────────────────────
// Side profile view: pitcher's mound (left) → home plate (right)

const SVG_W = 400;
const SVG_H = 170;
const PAD = { left: 24, right: 14, top: 10, bottom: 28 };

// Physics coordinate range
const Y_MIN = -1;    // behind plate
const Y_MAX = 55;    // behind mound
const Z_MIN = -0.5;  // below ground
const Z_MAX = 7.5;   // max display height

const drawW = SVG_W - PAD.left - PAD.right;
const drawH = SVG_H - PAD.top - PAD.bottom;

const toSvgX = (physY: number) =>
  PAD.left + ((Y_MAX - physY) / (Y_MAX - Y_MIN)) * drawW;

const toSvgY = (physZ: number) =>
  PAD.top + ((Z_MAX - physZ) / (Z_MAX - Z_MIN)) * drawH;

// ── Field Background ────────────────────────────────────────────────────────

const FieldBackground: FC<{
  topSz: number;
  bottomSz: number;
  uid: string;
}> = ({ topSz, bottomSz, uid }) => {
  const szLeft = toSvgX(0.7083);
  const szRight = toSvgX(-0.5);
  const szTop = toSvgY(topSz);
  const szBottom = toSvgY(bottomSz);
  const moundCx = toSvgX(50);

  return (
    <g>
      <defs>
        <linearGradient id={`${uid}-sz`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity={0.02} />
          <stop offset="100%" stopColor="currentColor" stopOpacity={0.05} />
        </linearGradient>
        <filter id={`${uid}-glow`}>
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Ground line */}
      <line
        x1={PAD.left} y1={toSvgY(0)}
        x2={SVG_W - PAD.right} y2={toSvgY(0)}
        stroke="currentColor" strokeWidth={0.6} opacity={0.06}
      />

      {/* Height reference lines */}
      {[1, 2, 3, 4, 5].map(h => {
        const inZone = h >= Math.floor(bottomSz) && h <= Math.ceil(topSz);
        return (
          <g key={h}>
            <line
              x1={PAD.left} y1={toSvgY(h)}
              x2={SVG_W - PAD.right} y2={toSvgY(h)}
              stroke="currentColor" strokeWidth={0.3}
              strokeDasharray="2 5" opacity={inZone ? 0.08 : 0.04}
            />
            <text
              x={PAD.left - 3} y={toSvgY(h) + 1.5}
              textAnchor="end" fontSize={5.5}
              fill="currentColor" opacity={inZone ? 0.2 : 0.1}
            >
              {h}ft
            </text>
          </g>
        );
      })}

      {/* Mound indicator */}
      <ellipse
        cx={moundCx} cy={toSvgY(0)}
        rx={6} ry={1.5}
        fill="currentColor" opacity={0.03}
      />

      {/* Home plate column highlight */}
      <rect
        x={szLeft - 2} y={PAD.top}
        width={szRight - szLeft + 4} height={drawH}
        fill="currentColor" opacity={0.012} rx={2}
      />

      {/* Strike zone */}
      <rect
        x={szLeft} y={szTop}
        width={szRight - szLeft} height={szBottom - szTop}
        fill={`url(#${uid}-sz)`} rx={1}
      />
      <rect
        x={szLeft} y={szTop}
        width={szRight - szLeft} height={szBottom - szTop}
        fill="none" stroke="currentColor" strokeWidth={0.7}
        opacity={0.12} rx={1}
      />

      {/* Home plate pentagon */}
      {(() => {
        const cx = (szLeft + szRight) / 2;
        const baseY = toSvgY(0);
        const s = 3.5;
        return (
          <polygon
            points={[
              `${cx - s},${baseY - s * 0.4}`,
              `${cx + s},${baseY - s * 0.4}`,
              `${cx + s},${baseY + s * 0.2}`,
              `${cx},${baseY + s * 0.6}`,
              `${cx - s},${baseY + s * 0.2}`,
            ].join(' ')}
            fill="currentColor" opacity={0.08}
          />
        );
      })()}

      {/* Distance markers */}
      {[10, 20, 30, 40].map(d => (
        <text
          key={d}
          x={toSvgX(d)} y={toSvgY(0) + 9}
          textAnchor="middle" fontSize={5.5}
          fill="currentColor" opacity={0.1}
        >
          {d}ft
        </text>
      ))}
    </g>
  );
};

// ── Trajectory Path ─────────────────────────────────────────────────────────

const TrajectoryPath: FC<{
  pitch: ParsedPitch;
  isActive: boolean;
  isLatest: boolean;
  uid: string;
}> = ({ pitch, isActive, isLatest, uid }) => {
  if (!pitch.trajectory) return null;

  const points = computeTrajectoryPoints(pitch.trajectory, 40);
  if (points.length < 2) return null;

  const color = PITCH_RESULT_COLOR[pitch.result];
  const gradId = `${uid}-t${pitch.number}`;

  const d = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${toSvgX(p.y).toFixed(1)},${toSvgY(p.z).toFixed(1)}`)
    .join(' ');

  const release = points[0];
  const plate = points[points.length - 1];

  // ── Inactive pitch: minimal rendering ──
  if (!isActive && !isLatest) {
    return (
      <g opacity={0.25}>
        <path
          d={d} fill="none" stroke={color}
          strokeWidth={1} strokeLinecap="round" strokeLinejoin="round"
        />
        <circle
          cx={toSvgX(plate.y)} cy={toSvgY(plate.z)}
          r={4} fill={color}
          stroke="rgba(0,0,0,0.12)" strokeWidth={0.4}
        />
        <text
          x={toSvgX(plate.y)} y={toSvgY(plate.z) + 0.5}
          textAnchor="middle" dominantBaseline="middle"
          fill="white" fontSize={5.5} fontWeight={700}
        >
          {pitch.number}
        </text>
      </g>
    );
  }

  // ── Active / Latest: gradient stroke, glow, labels ──
  const strokeW = isActive ? 2.5 : 1.8;

  return (
    <g>
      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={color} stopOpacity={isActive ? 0.25 : 0.12} />
          <stop offset="35%" stopColor={color} stopOpacity={isActive ? 0.6 : 0.4} />
          <stop offset="100%" stopColor={color} stopOpacity={isActive ? 1 : 0.75} />
        </linearGradient>
      </defs>

      {/* Glow */}
      {isActive && (
        <path
          d={d} fill="none" stroke={color}
          strokeWidth={strokeW + 4} opacity={0.08}
          strokeLinecap="round" strokeLinejoin="round"
          filter={`url(#${uid}-glow)`}
        />
      )}

      {/* Gradient path */}
      <path
        d={d} fill="none" stroke={`url(#${gradId})`}
        strokeWidth={strokeW}
        strokeLinecap="round" strokeLinejoin="round"
      />

      {/* Release dot */}
      <circle
        cx={toSvgX(release.y)} cy={toSvgY(release.z)}
        r={isActive ? 3 : 2} fill={color}
        opacity={isActive ? 0.5 : 0.35}
      />

      {/* Plate dot — outer glow ring */}
      {isActive && (
        <circle
          cx={toSvgX(plate.y)} cy={toSvgY(plate.z)}
          r={10} fill={color} opacity={0.1}
        />
      )}

      {/* Plate dot — main */}
      <circle
        cx={toSvgX(plate.y)} cy={toSvgY(plate.z)}
        r={isActive ? 7 : 5.5} fill={color}
        stroke="rgba(0,0,0,0.18)" strokeWidth={0.5}
      />
      <text
        x={toSvgX(plate.y)} y={toSvgY(plate.z) + 0.5}
        textAnchor="middle" dominantBaseline="middle"
        fill="white" fontSize={isActive ? 7 : 6} fontWeight={700}
        style={{ textShadow: '0 1px 1px rgba(0,0,0,0.25)' }}
      >
        {pitch.number}
      </text>

      {/* Speed + pitch type tooltip (active only) */}
      {isActive && pitch.speed > 0 && (() => {
        const tx = toSvgX(release.y);
        const ty = Math.max(toSvgY(release.z) - 16, PAD.top + 8);
        const label = `${pitch.speed}km/h${pitch.type ? ` · ${pitch.type}` : ''}`;
        const textW = label.length * 3.8 + 14;
        return (
          <g>
            <rect
              x={tx - textW / 2} y={ty - 6}
              width={textW} height={12}
              rx={6} fill="rgba(0,0,0,0.6)"
            />
            <text
              x={tx} y={ty + 0.5}
              textAnchor="middle" dominantBaseline="middle"
              fill="white" fontSize={7} fontWeight={500}
              letterSpacing={0.2}
            >
              {label}
            </text>
          </g>
        );
      })()}
    </g>
  );
};

// ── Inline Legend ────────────────────────────────────────────────────────────

const LEGEND_ITEMS: Array<{ key: 'B' | 'T' | 'S' | 'F' | 'H'; label: string }> = [
  { key: 'B', label: PITCH_RESULT_LABEL.B },
  { key: 'T', label: PITCH_RESULT_LABEL.T },
  { key: 'S', label: PITCH_RESULT_LABEL.S },
  { key: 'F', label: PITCH_RESULT_LABEL.F },
  { key: 'H', label: PITCH_RESULT_LABEL.H },
];

const SvgLegend: FC = () => {
  const y = SVG_H - 8;
  const startX = SVG_W / 2 - 78;

  return (
    <g>
      {LEGEND_ITEMS.map(({ key, label }, i) => {
        const x = startX + i * 38;
        return (
          <g key={key}>
            <circle cx={x} cy={y} r={2.5} fill={PITCH_RESULT_COLOR[key]} opacity={0.65} />
            <text
              x={x + 5.5} y={y + 0.5}
              fontSize={6} fill="currentColor" opacity={0.22}
              dominantBaseline="middle"
            >
              {label}
            </text>
          </g>
        );
      })}
    </g>
  );
};

// ── Main Component ──────────────────────────────────────────────────────────

interface PitchTrajectoryProps {
  pitches: ParsedPitch[];
  activePitchIndex?: number;
  className?: string;
}

export const PitchTrajectory: FC<PitchTrajectoryProps> = ({
  pitches,
  activePitchIndex,
  className,
}) => {
  const uid = useId().replace(/:/g, '');
  const hasTrajectory = pitches.some(p => p.trajectory);
  if (!hasTrajectory) return null;

  const topSz = pitches[0]?.topSz ?? 3.4;
  const bottomSz = pitches[0]?.bottomSz ?? 1.6;

  return (
    <div className={cn('flex flex-col', className)}>
      <svg
        viewBox={`0 0 ${SVG_W} ${SVG_H}`}
        className="w-full"
        role="img"
        aria-label="투구 궤적"
      >
        <FieldBackground topSz={topSz} bottomSz={bottomSz} uid={uid} />

        {/* Back layer: inactive pitches */}
        {pitches.map((pitch, i) => {
          if (activePitchIndex === i) return null;
          if (i === pitches.length - 1 && activePitchIndex === undefined) return null;
          return (
            <TrajectoryPath
              key={i} pitch={pitch}
              isActive={false} isLatest={false} uid={uid}
            />
          );
        })}

        {/* Middle layer: latest pitch (when nothing is hovered) */}
        {activePitchIndex === undefined && pitches.length > 0 && (
          <TrajectoryPath
            pitch={pitches[pitches.length - 1]}
            isActive={false} isLatest uid={uid}
          />
        )}

        {/* Top layer: active (hovered) pitch */}
        {activePitchIndex !== undefined && pitches[activePitchIndex] && (
          <TrajectoryPath
            pitch={pitches[activePitchIndex]}
            isActive isLatest={false} uid={uid}
          />
        )}

        <SvgLegend />

        <text
          x={PAD.left + 2} y={PAD.top + 7}
          fontSize={6} fill="currentColor" opacity={0.1}
          fontWeight={500} letterSpacing={0.8}
        >
          TRAJECTORY
        </text>
      </svg>
    </div>
  );
};
