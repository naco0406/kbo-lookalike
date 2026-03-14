import type { FC } from 'react';
import { useMemo, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ParsedAtBat, PitchResult } from './pitch-utils';
import { PITCH_RESULT_COLOR, PITCH_RESULT_LABEL, PITCH_TYPE_SHORT } from './pitch-utils';
import { StrikeZone } from './strike-zone';
import { PitchTrajectory } from './pitch-trajectory';

// ── Pitch Row ───────────────────────────────────────────────────────────────

const PitchBadge: FC<{ result: PitchResult }> = ({ result }) => (
  <span
    className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[9px] font-bold text-white"
    style={{ backgroundColor: PITCH_RESULT_COLOR[result] }}
  >
    {PITCH_RESULT_LABEL[result]}
  </span>
);

const PitchRow: FC<{
  number: number;
  count: string;
  type: string;
  speed: number;
  result: PitchResult;
  isActive: boolean;
  onHover: () => void;
  onLeave: () => void;
}> = ({ number, count, type, speed, result, isActive, onHover, onLeave }) => (
  <div
    className={cn(
      'flex items-center gap-1.5 rounded-lg px-2 py-1 transition-colors cursor-default',
      isActive ? 'bg-muted/80' : 'hover:bg-muted/30',
    )}
    onMouseEnter={onHover}
    onMouseLeave={onLeave}
    onTouchStart={onHover}
  >
    {/* 번호 */}
    <span className="w-3 text-right text-[10px] tabular-nums text-muted-foreground/30">
      {number}
    </span>

    {/* B-S 카운트 */}
    <span className="w-5 text-center text-[9px] tabular-nums text-muted-foreground/35 font-medium">
      {count}
    </span>

    {/* 구종 약어 */}
    <span className="w-5 text-[10px] font-semibold text-muted-foreground/70">
      {PITCH_TYPE_SHORT[type] ?? type.slice(0, 2)}
    </span>

    {/* 구속 */}
    <span className="w-8 text-right text-[11px] font-bold tabular-nums">
      {speed || '-'}
    </span>

    {/* 결과 뱃지 */}
    <PitchBadge result={result} />
  </div>
);

// ── Result Bar ──────────────────────────────────────────────────────────────

const RESULT_BG: Record<ParsedAtBat['resultType'], string> = {
  hit: 'bg-green-500/10 text-green-600 dark:text-green-400',
  out: 'bg-muted/60 text-muted-foreground',
  walk: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  other: 'bg-muted/40 text-muted-foreground/70',
};

// ── WPA Badge ───────────────────────────────────────────────────────────────

const WpaBadge: FC<{ wpa: number }> = ({ wpa }) => {
  const positive = wpa >= 0;
  return (
    <span
      className={cn(
        'ml-auto text-[10px] font-bold tabular-nums',
        positive ? 'text-green-500' : 'text-red-400',
      )}
    >
      WPA {positive ? '+' : ''}{wpa.toFixed(1)}%
    </span>
  );
};

// ── Pitch Type Distribution Bar ──────────────────────────────────────────────

const PitchMixBar: FC<{ pitches: ParsedAtBat['pitches'] }> = ({ pitches }) => {
  const typeCounts = new Map<string, number>();
  for (const p of pitches) {
    const label = PITCH_TYPE_SHORT[p.type] ?? (p.type ? p.type.slice(0, 2) : '??');
    typeCounts.set(label, (typeCounts.get(label) ?? 0) + 1);
  }
  const entries = Array.from(typeCounts.entries()).sort((a, b) => b[1] - a[1]);
  const total = pitches.length;
  if (total === 0 || entries.length === 0) return null;

  // Assign colors — subtle palette
  const COLORS = ['#6366f1', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316'];

  return (
    <div className="flex items-center gap-2">
      {/* Stacked bar */}
      <div className="flex h-[6px] flex-1 overflow-hidden rounded-full bg-muted/30">
        {entries.map(([label, count], i) => (
          <div
            key={label}
            className="h-full transition-all"
            style={{
              width: `${(count / total) * 100}%`,
              backgroundColor: COLORS[i % COLORS.length],
              opacity: 0.7,
            }}
          />
        ))}
      </div>
      {/* Labels */}
      <div className="flex shrink-0 items-center gap-1.5">
        {entries.slice(0, 4).map(([label, count], i) => (
          <div key={label} className="flex items-center gap-0.5">
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: COLORS[i % COLORS.length], opacity: 0.7 }}
            />
            <span className="text-[8px] font-medium text-muted-foreground/40">
              {label}<span className="tabular-nums">{count}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

// ── Helpers ─────────────────────────────────────────────────────────────────

/** 투구별 누적 B-S 카운트를 계산한다. (각 투구 시점의 카운트) */
const computeCounts = (pitches: ParsedAtBat['pitches']): string[] => {
  let b = 0;
  let s = 0;
  return pitches.map((_, i) => {
    const label = `${b}-${s}`;
    const p = pitches[i];
    if (p.result === 'B') b++;
    else if (p.result === 'T' || p.result === 'S') s++;
    else if (p.result === 'F' && s < 2) s++;
    // 'H' (in-play) doesn't advance the count
    return label;
  });
};

// ── Main Component ──────────────────────────────────────────────────────────

interface AtBatCardProps {
  atBat: ParsedAtBat;
  defaultExpanded?: boolean;
  className?: string;
}

export const AtBatCard: FC<AtBatCardProps> = ({ atBat, defaultExpanded = false, className }) => {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [activePitch, setActivePitch] = useState<number | undefined>(undefined);
  const hasPts = atBat.pitches.some(p => p.location);
  const hasTrajectory = atBat.pitches.some(p => p.trajectory);

  const counts = useMemo(() => computeCounts(atBat.pitches), [atBat.pitches]);

  // Summary stats
  const speeds = atBat.pitches.map(p => p.speed).filter(s => s > 0);
  const maxSpeed = speeds.length > 0 ? Math.max(...speeds) : 0;
  const minSpeed = speeds.length > 0 ? Math.min(...speeds) : 0;
  const avgSpeed = speeds.length > 0 ? Math.round(speeds.reduce((a, b) => a + b, 0) / speeds.length) : 0;
  const pitchCount = atBat.pitches.length;

  return (
    <div
      className={cn(
        'overflow-hidden rounded-xl border border-border/60 bg-card/80 backdrop-blur-sm',
        'transition-all duration-200',
        className,
      )}
    >
      {/* ── Header: 타자 정보 ── */}
      <button
        type="button"
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left transition-colors hover:bg-muted/30 active:scale-[0.995]"
        onClick={() => setExpanded(!expanded)}
      >
        {/* 등번호 */}
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-muted/80 text-[11px] font-black tabular-nums">
          {atBat.batterBacknum || '#'}
        </span>

        {/* 이름 + 포지션 */}
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-1.5">
            <span className="text-[13px] font-bold leading-tight">{atBat.batterName}</span>
            {atBat.seasonAvg && (
              <span className="text-[10px] tabular-nums text-muted-foreground/50">
                {atBat.seasonAvg}
              </span>
            )}
          </div>
          <div className="text-[10px] text-muted-foreground/40">
            {atBat.batterPos}{atBat.batterHitType ? ` · ${atBat.batterHitType}` : ''}
          </div>
        </div>

        {/* 투구 수 미니 뱃지 */}
        <div className="flex items-center gap-0.5">
          {atBat.pitches.map((p, i) => (
            <span
              key={i}
              className="h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: PITCH_RESULT_COLOR[p.result], opacity: 0.7 }}
            />
          ))}
        </div>

        {/* 결과 요약 */}
        <span
          className={cn(
            'shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-semibold',
            RESULT_BG[atBat.resultType],
          )}
        >
          {atBat.result.replace(/^[^ ]+ : /, '')}
        </span>

        <ChevronDown
          className={cn(
            'h-3.5 w-3.5 shrink-0 text-muted-foreground/30 transition-transform duration-200',
            expanded && 'rotate-180',
          )}
        />
      </button>

      {/* ── 확장 영역: 궤적 + 스트라이크존 + 투구 목록 ── */}
      <div
        className={cn(
          'grid transition-all duration-300 ease-out',
          expanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
        )}
      >
        <div className="overflow-hidden">
          <div className="border-t border-border/40 px-3 pb-3 pt-2">
            {/* 궤적 뷰 (full width) */}
            {hasTrajectory && (
              <div className="mb-2.5 overflow-hidden rounded-lg border border-border/30 bg-muted/15 p-0.5">
                <PitchTrajectory
                  pitches={atBat.pitches}
                  activePitchIndex={activePitch}
                />
              </div>
            )}

            {/* 투구 서머리 */}
            <div className="mb-2 space-y-1.5 px-0.5">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-semibold text-muted-foreground/50 tabular-nums">
                  {pitchCount}구
                </span>
                {maxSpeed > 0 && (
                  <>
                    <span className="text-[8px] text-muted-foreground/20">·</span>
                    <span className="text-[10px] tabular-nums text-muted-foreground/40">
                      {minSpeed !== maxSpeed
                        ? `${minSpeed}–${maxSpeed}km/h (평균 ${avgSpeed})`
                        : `${maxSpeed}km/h`}
                    </span>
                  </>
                )}
              </div>
              {pitchCount > 1 && <PitchMixBar pitches={atBat.pitches} />}
            </div>

            <div className="flex gap-3">
              {/* 스트라이크존 */}
              {hasPts && (
                <div className="w-[120px] shrink-0">
                  <StrikeZone
                    pitches={atBat.pitches}
                    activePitchIndex={activePitch}
                    className="w-full"
                  />
                </div>
              )}

              {/* 투구 목록 */}
              <div className="min-w-0 flex-1">
                {/* 열 헤더 */}
                <div className="flex items-center gap-1.5 px-2 pb-1 text-[8px] font-medium tracking-wider text-muted-foreground/25 uppercase">
                  <span className="w-3 text-right">#</span>
                  <span className="w-5 text-center">CNT</span>
                  <span className="w-5">구종</span>
                  <span className="w-8 text-right">속도</span>
                  <span className="ml-1.5">결과</span>
                </div>
                <div className="space-y-px">
                  {atBat.pitches.map((p, i) => (
                    <PitchRow
                      key={i}
                      number={p.number}
                      count={counts[i]}
                      type={p.type}
                      speed={p.speed}
                      result={p.result}
                      isActive={activePitch === i}
                      onHover={() => setActivePitch(i)}
                      onLeave={() => setActivePitch(undefined)}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* WPA + 추가 이벤트 */}
            {(atBat.wpa !== null || atBat.events.some(e => [14, 24].includes(e.type))) && (
              <div className="mt-2.5 flex items-center gap-2 border-t border-border/30 pt-2">
                {/* 주자 이동 이벤트 */}
                <div className="min-w-0 flex-1 space-y-0.5">
                  {atBat.events
                    .filter(e => [13, 14, 23, 24].includes(e.type))
                    .map((e, i) => (
                      <div key={i} className="text-[10px] text-muted-foreground/50">
                        {e.text}
                      </div>
                    ))}
                </div>
                {atBat.wpa !== null && <WpaBadge wpa={atBat.wpa} />}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
