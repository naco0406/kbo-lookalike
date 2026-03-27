import type { FC } from 'react';
import type { PtrPhase } from '@/hooks/use-pull-to-refresh';
import { TEAM_COLORS } from '@/constants/analysis-messages';
import { cn } from '@/lib/utils';

interface PullToRefreshIndicatorProps {
  phase: PtrPhase;
  pullDistance: number;
  progress: number;
  teamCode: string | null;
}

const SIZE = 40;
const STROKE = 3;
const R = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * R;

export const PullToRefreshIndicator: FC<PullToRefreshIndicatorProps> = ({
  phase,
  pullDistance,
  progress,
  teamCode,
}) => {
  const team = teamCode ? TEAM_COLORS[teamCode] : null;
  const color = team?.primary ?? 'var(--accent)';
  const isActive = phase !== 'idle';
  const isRefreshing = phase === 'refreshing';
  const isDone = phase === 'done';
  const isSettling = phase === 'settling';
  const isPulling = phase === 'pulling' || phase === 'armed';

  if (!isActive) return null;

  const opacity = isRefreshing || isDone ? 1 : Math.min(progress * 2, 1);
  const scale = isDone ? 1.15 : isRefreshing ? 1 : 0.6 + progress * 0.4;

  // 프로그레스 아크: progress에 따라 원이 채워짐
  const arcOffset = CIRCUMFERENCE * (1 - progress);

  return (
    <div
      className={cn(
        'flex items-center justify-center',
        isSettling && 'transition-[height] duration-300 ease-out',
      )}
      style={{ height: isSettling ? 0 : pullDistance }}
    >
      <div
        className={cn(
          'relative transition-transform duration-300 ease-out',
          isDone && 'animate-ptr-done',
        )}
        style={{
          width: SIZE,
          height: SIZE,
          opacity,
          transform: `scale(${scale})`,
        }}
      >
        {/* ── SVG ring ── */}
        <svg
          width={SIZE}
          height={SIZE}
          className={cn(
            'absolute inset-0',
            isRefreshing && 'animate-ptr-ring-spin',
          )}
          style={{ transform: 'rotate(-90deg)' }}
        >
          {/* Track */}
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={R}
            fill="none"
            stroke="currentColor"
            strokeWidth={STROKE}
            className="text-muted/40"
          />
          {/* Arc */}
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={R}
            fill="none"
            stroke={color}
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={isRefreshing ? CIRCUMFERENCE * 0.25 : isPulling ? arcOffset : 0}
            className="transition-[stroke-dashoffset] duration-150 ease-out"
          />
        </svg>

        {/* ── Center: team logo or 643 ── */}
        <div className="absolute inset-0 flex items-center justify-center">
          {isDone ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path
                d="M5 13l4 4L19 7"
                stroke={color}
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="animate-ptr-check"
              />
            </svg>
          ) : (
            <span
              className="font-extrabold leading-none select-none"
              style={{
                color,
                fontSize: team ? 11 : 10,
                fontFamily: team ? undefined : 'var(--font-score)',
                letterSpacing: team ? undefined : '0.05em',
              }}
            >
              {team?.shortName ?? '643'}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
