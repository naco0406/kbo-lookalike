import type { FC } from 'react';
import { useState, useEffect, useRef, useMemo, useCallback, useId } from 'react';
import { Play, Pause, SkipForward, SkipBack, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ParsedAtBat, ParsedPitch } from './pitch-utils';
import {
  computeTrajectoryPoints,
  PITCH_RESULT_COLOR,
  PITCH_RESULT_LABEL,
  PITCH_TYPE_SHORT,
} from './pitch-utils';
import { UmpireView } from './umpire-view';

// ── Trajectory SVG Layout ──────────────────────────────────────────────────
// Larger than at-bat-card version — this is the hero view.

const SVG_W = 500;
const SVG_H = 200;
const PAD = { left: 28, right: 16, top: 14, bottom: 16 };

const Y_MIN = -1;
const Y_MAX = 55;
const Z_MIN = -0.5;
const Z_MAX = 7.5;

const toSvgX = (physY: number) =>
  PAD.left + ((Y_MAX - physY) / (Y_MAX - Y_MIN)) * (SVG_W - PAD.left - PAD.right);

const toSvgY = (physZ: number) =>
  PAD.top + ((Z_MAX - physZ) / (Z_MAX - Z_MIN)) * (SVG_H - PAD.top - PAD.bottom);

// ── Helpers ─────────────────────────────────────────────────────────────────

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

const getBallPos = (
  points: Array<{ x: number; y: number; z: number }>,
  progress: number,
) => {
  const idx = progress * (points.length - 1);
  const i = Math.floor(idx);
  const f = idx - i;
  if (i >= points.length - 1) return points[points.length - 1];
  return {
    x: lerp(points[i].x, points[i + 1].x, f),
    y: lerp(points[i].y, points[i + 1].y, f),
    z: lerp(points[i].z, points[i + 1].z, f),
  };
};

const buildPath = (
  points: Array<{ y: number; z: number }>,
  progress = 1,
) => {
  const end = Math.ceil(progress * (points.length - 1));
  return points
    .slice(0, end + 1)
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${toSvgX(p.y).toFixed(1)},${toSvgY(p.z).toFixed(1)}`)
    .join(' ');
};

const getCount = (pitches: ParsedPitch[], upTo: number): [number, number] => {
  let b = 0;
  let s = 0;
  for (let i = 0; i < upTo; i++) {
    const r = pitches[i].result;
    if (r === 'B') b++;
    else if (r === 'T' || r === 'S') s++;
    else if (r === 'F' && s < 2) s++;
  }
  return [b, s];
};

// ── Timing ──────────────────────────────────────────────────────────────────

const FLIGHT_MS = 1200;
const LANDED_MS = 800;
const INTRO_MS = 600;

// ── Main Component ──────────────────────────────────────────────────────────

interface PitchPlayerProps {
  atBats: ParsedAtBat[];
  className?: string;
}

export const PitchPlayer: FC<PitchPlayerProps> = ({ atBats, className }) => {
  const uid = useId().replace(/:/g, '');

  // Navigation
  const [abIdx, setAbIdx] = useState(0);
  const [pitchIdx, setPitchIdx] = useState(0);

  // View mode
  const [viewMode, setViewMode] = useState<'side' | 'front'>('side');

  // Playback
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<1 | 2>(1);

  // Animation
  const [phase, setPhase] = useState<'intro' | 'flying' | 'landed'>('intro');
  const [progress, setProgress] = useState(0);

  const animRef = useRef(0);
  const startRef = useRef(0);

  const ab = atBats[abIdx];
  const pitch = ab?.pitches[pitchIdx];
  const totalPitches = ab?.pitches.length ?? 0;

  const trajPoints = useMemo(
    () => pitch?.trajectory ? computeTrajectoryPoints(pitch.trajectory, 50) : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [abIdx, pitchIdx],
  );

  // ── Animation loop ──
  useEffect(() => {
    if (phase !== 'flying' || trajPoints.length === 0) return;
    const duration = FLIGHT_MS / speed;

    const tick = (ts: number) => {
      if (!startRef.current) startRef.current = ts;
      const p = Math.min(1, (ts - startRef.current) / duration);
      setProgress(p);
      if (p < 1) {
        animRef.current = requestAnimationFrame(tick);
      } else {
        setPhase('landed');
      }
    };

    startRef.current = 0;
    setProgress(0);
    animRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animRef.current);
  }, [phase, speed, pitchIdx, abIdx, trajPoints.length]);

  // ── Auto-advance (intro → flying) ──
  useEffect(() => {
    if (phase !== 'intro' || !playing) return;
    const t = setTimeout(() => setPhase('flying'), INTRO_MS / speed);
    return () => clearTimeout(t);
  }, [phase, playing, speed]);

  // ── Auto-advance (landed → next pitch) ──
  useEffect(() => {
    if (phase !== 'landed' || !playing) return;
    const t = setTimeout(() => advanceNext(), LANDED_MS / speed);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, playing, speed]);

  // ── Navigation callbacks ──
  const goToAtBat = useCallback((idx: number) => {
    cancelAnimationFrame(animRef.current);
    setAbIdx(Math.max(0, Math.min(idx, atBats.length - 1)));
    setPitchIdx(0);
    setPhase('intro');
    setProgress(0);
  }, [atBats.length]);

  const goToPitch = useCallback((idx: number) => {
    if (!ab) return;
    cancelAnimationFrame(animRef.current);
    setPitchIdx(Math.max(0, Math.min(idx, ab.pitches.length - 1)));
    setPhase('flying');
    setProgress(0);
  }, [ab]);

  const advanceNext = useCallback(() => {
    if (!ab) return;
    if (pitchIdx < ab.pitches.length - 1) {
      goToPitch(pitchIdx + 1);
    } else if (abIdx < atBats.length - 1) {
      goToAtBat(abIdx + 1);
    } else {
      setPlaying(false);
    }
  }, [ab, pitchIdx, abIdx, atBats.length, goToPitch, goToAtBat]);

  const togglePlay = useCallback(() => {
    if (!playing) {
      // If at end, restart
      if (phase === 'landed' && pitchIdx >= totalPitches - 1 && abIdx >= atBats.length - 1) {
        goToAtBat(0);
      }
      setPlaying(true);
      if (phase === 'landed') advanceNext();
      else if (phase !== 'intro') setPhase('flying');
    } else {
      setPlaying(false);
      cancelAnimationFrame(animRef.current);
    }
  }, [playing, phase, pitchIdx, totalPitches, abIdx, atBats.length, goToAtBat, advanceNext]);

  if (atBats.length === 0) {
    return (
      <div className="flex h-48 flex-col items-center justify-center gap-2">
        <p className="text-[13px] text-muted-foreground">투구 데이터가 없습니다</p>
        <p className="text-[11px] text-muted-foreground/40">PTS 궤적 데이터가 포함된 경기에서 사용할 수 있습니다</p>
      </div>
    );
  }

  const [balls, strikes] = ab ? getCount(ab.pitches, pitchIdx) : [0, 0];
  const topSz = pitch?.topSz ?? ab?.pitches[0]?.topSz ?? 3.4;
  const bottomSz = pitch?.bottomSz ?? ab?.pitches[0]?.bottomSz ?? 1.6;
  const ballPos = trajPoints.length > 0 && phase === 'flying' ? getBallPos(trajPoints, progress) : null;
  const isLastPitch = pitchIdx >= totalPitches - 1;
  const isLastAtBat = abIdx >= atBats.length - 1;

  return (
    <div className={cn('flex h-full flex-col', className)}>
      {/* ── Batter Info ── */}
      <div className="shrink-0 border-b border-border/40 px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted/80 text-[13px] font-black tabular-nums">
            {ab?.batterBacknum || '#'}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-2">
              <span className="text-[15px] font-bold">{ab?.batterName ?? ''}</span>
              {ab?.seasonAvg && (
                <span className="text-[11px] tabular-nums text-muted-foreground/50">{ab.seasonAvg}</span>
              )}
            </div>
            <div className="text-[10px] text-muted-foreground/40">
              {ab?.batterPos}{ab?.batterHitType ? ` · ${ab.batterHitType}` : ''}
              {ab ? ` · ${ab.inning}회${ab.isHome ? '말' : '초'}` : ''}
            </div>
          </div>

          {/* B-S Count */}
          <div className="flex items-center gap-2.5 text-[9px]">
            <div className="flex items-center gap-0.5">
              <span className="font-medium text-muted-foreground/40">B</span>
              {[0, 1, 2, 3].map(i => (
                <span key={i} className={cn(
                  'h-[6px] w-[6px] rounded-full transition-colors',
                  i < balls ? 'bg-blue-400' : 'bg-muted-foreground/10',
                )} />
              ))}
            </div>
            <div className="flex items-center gap-0.5">
              <span className="font-medium text-muted-foreground/40">S</span>
              {[0, 1, 2].map(i => (
                <span key={i} className={cn(
                  'h-[6px] w-[6px] rounded-full transition-colors',
                  i < strikes ? 'bg-amber-400' : 'bg-muted-foreground/10',
                )} />
              ))}
            </div>
          </div>
        </div>

        {/* Pitch stats summary for current at-bat */}
        {ab && totalPitches > 0 && (() => {
          const speeds = ab.pitches.map(p => p.speed).filter(s => s > 0);
          const maxSpd = speeds.length > 0 ? Math.max(...speeds) : 0;
          const typeCounts = new Map<string, number>();
          for (const p of ab.pitches) {
            const label = PITCH_TYPE_SHORT[p.type] ?? (p.type ? p.type.slice(0, 2) : '');
            if (label) typeCounts.set(label, (typeCounts.get(label) ?? 0) + 1);
          }
          const types = Array.from(typeCounts.entries()).sort((a, b) => b[1] - a[1]);

          return (
            <div className="mt-2 flex items-center gap-2 text-[9px] text-muted-foreground/35">
              <span className="tabular-nums font-medium">{totalPitches}구</span>
              {maxSpd > 0 && (
                <>
                  <span className="text-muted-foreground/15">·</span>
                  <span className="tabular-nums">최고 {maxSpd}</span>
                </>
              )}
              {types.length > 0 && (
                <>
                  <span className="text-muted-foreground/15">·</span>
                  <span>{types.map(([t, c]) => `${t}${c}`).join(' ')}</span>
                </>
              )}
            </div>
          );
        })()}
      </div>

      {/* ── View Toggle ── */}
      <div className="flex shrink-0 items-center justify-between px-4 pt-3 pb-1">
        <div className="flex items-center gap-1 rounded-lg bg-muted/40 p-0.5">
          <button
            type="button"
            onClick={() => setViewMode('side')}
            className={cn(
              'rounded-md px-2.5 py-1 text-[10px] font-medium transition-all',
              viewMode === 'side'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground/50 hover:text-muted-foreground/70',
            )}
          >
            궤적
          </button>
          <button
            type="button"
            onClick={() => setViewMode('front')}
            className={cn(
              'rounded-md px-2.5 py-1 text-[10px] font-medium transition-all',
              viewMode === 'front'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground/50 hover:text-muted-foreground/70',
            )}
          >
            심판
          </button>
        </div>
      </div>

      {/* ── Visualization ── */}
      <div className="shrink-0 px-3">
        {viewMode === 'front' ? (
          <div className="overflow-hidden rounded-xl border border-border/30 bg-muted/10">
            <UmpireView
              pitches={ab?.pitches ?? []}
              currentPitchIndex={pitchIdx}
              phase={phase}
              progress={progress}
              stance={pitch?.stance}
              batterHitType={ab?.batterHitType}
            />
          </div>
        ) : (
        <div className="overflow-hidden rounded-xl border border-border/30 bg-muted/10">
          <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} className="w-full">
            <defs>
              <linearGradient id={`${uid}-sz`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="currentColor" stopOpacity={0.02} />
                <stop offset="100%" stopColor="currentColor" stopOpacity={0.05} />
              </linearGradient>
              <filter id={`${uid}-glow`}>
                <feGaussianBlur stdDeviation="4" result="blur" />
                <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
              <radialGradient id={`${uid}-shine`}>
                <stop offset="0%" stopColor="white" stopOpacity={0.35} />
                <stop offset="100%" stopColor="white" stopOpacity={0} />
              </radialGradient>
            </defs>

            {/* Ground & height reference */}
            <line
              x1={PAD.left} y1={toSvgY(0)}
              x2={SVG_W - PAD.right} y2={toSvgY(0)}
              stroke="currentColor" strokeWidth={0.6} opacity={0.06}
            />
            {[1, 2, 3, 4, 5].map(h => {
              const inZone = h >= Math.floor(bottomSz) && h <= Math.ceil(topSz);
              return (
                <g key={h}>
                  <line
                    x1={PAD.left} y1={toSvgY(h)} x2={SVG_W - PAD.right} y2={toSvgY(h)}
                    stroke="currentColor" strokeWidth={0.3}
                    strokeDasharray="2 5" opacity={inZone ? 0.08 : 0.04}
                  />
                  <text
                    x={PAD.left - 4} y={toSvgY(h) + 1.5}
                    textAnchor="end" fontSize={6} fill="currentColor" opacity={0.15}
                  >
                    {h}ft
                  </text>
                </g>
              );
            })}

            {/* Mound */}
            <ellipse cx={toSvgX(50)} cy={toSvgY(0)} rx={8} ry={2} fill="currentColor" opacity={0.03} />

            {/* Strike zone */}
            {(() => {
              const szL = toSvgX(0.7083);
              const szR = toSvgX(-0.5);
              const szT = toSvgY(topSz);
              const szB = toSvgY(bottomSz);
              return (
                <g>
                  <rect x={szL - 2} y={PAD.top} width={szR - szL + 4} height={SVG_H - PAD.top - PAD.bottom}
                    fill="currentColor" opacity={0.01} rx={2} />
                  <rect x={szL} y={szT} width={szR - szL} height={szB - szT}
                    fill={`url(#${uid}-sz)`} rx={1} />
                  <rect x={szL} y={szT} width={szR - szL} height={szB - szT}
                    fill="none" stroke="currentColor" strokeWidth={0.7} opacity={0.12} rx={1} />
                </g>
              );
            })()}

            {/* Previous pitches (faded trails) */}
            {ab?.pitches.slice(0, pitchIdx).map((p, i) => {
              if (!p.trajectory) return null;
              const pts = computeTrajectoryPoints(p.trajectory, 30);
              if (pts.length < 2) return null;
              const color = PITCH_RESULT_COLOR[p.result];
              const last = pts[pts.length - 1];
              return (
                <g key={i} opacity={0.18}>
                  <path
                    d={buildPath(pts)} fill="none" stroke={color}
                    strokeWidth={0.8} strokeLinecap="round"
                  />
                  <circle cx={toSvgX(last.y)} cy={toSvgY(last.z)} r={3.5} fill={color} />
                  <text
                    x={toSvgX(last.y)} y={toSvgY(last.z) + 0.5}
                    textAnchor="middle" dominantBaseline="middle"
                    fill="white" fontSize={5} fontWeight={700}
                  >
                    {p.number}
                  </text>
                </g>
              );
            })}

            {/* Current pitch trail */}
            {trajPoints.length > 0 && phase !== 'intro' && (() => {
              const color = PITCH_RESULT_COLOR[pitch!.result];
              const trail = phase === 'landed' ? 1 : progress;
              const d = buildPath(trajPoints, trail);
              const tId = `${uid}-trail`;
              return (
                <g>
                  <defs>
                    <linearGradient id={tId} x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor={color} stopOpacity={0.1} />
                      <stop offset="50%" stopColor={color} stopOpacity={0.5} />
                      <stop offset="100%" stopColor={color} stopOpacity={1} />
                    </linearGradient>
                  </defs>
                  <path d={d} fill="none" stroke={color} strokeWidth={7} opacity={0.06}
                    strokeLinecap="round" filter={`url(#${uid}-glow)`} />
                  <path d={d} fill="none" stroke={`url(#${tId})`}
                    strokeWidth={2.5} strokeLinecap="round" />
                </g>
              );
            })()}

            {/* Flying ball */}
            {ballPos && phase === 'flying' && (() => {
              const color = PITCH_RESULT_COLOR[pitch!.result];
              const bx = toSvgX(ballPos.y);
              const by = toSvgY(ballPos.z);
              const r = 4 + progress * 5;
              return (
                <g>
                  <circle cx={bx} cy={by} r={r + 8} fill={color} opacity={0.1} />
                  <circle cx={bx} cy={by} r={r} fill={color} />
                  <circle cx={bx} cy={by} r={r} fill={`url(#${uid}-shine)`} />
                  <circle cx={bx} cy={by} r={r} fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth={0.8} />
                </g>
              );
            })()}

            {/* Landed dot */}
            {phase === 'landed' && trajPoints.length > 0 && (() => {
              const color = PITCH_RESULT_COLOR[pitch!.result];
              const last = trajPoints[trajPoints.length - 1];
              const bx = toSvgX(last.y);
              const by = toSvgY(last.z);
              return (
                <g>
                  <circle cx={bx} cy={by} r={12} fill={color} opacity={0.1} />
                  <circle cx={bx} cy={by} r={8} fill={color} stroke="rgba(0,0,0,0.12)" strokeWidth={0.5} />
                  <text
                    x={bx} y={by + 0.5}
                    textAnchor="middle" dominantBaseline="middle"
                    fill="white" fontSize={8} fontWeight={700}
                    style={{ textShadow: '0 1px 1px rgba(0,0,0,0.2)' }}
                  >
                    {pitch!.number}
                  </text>
                </g>
              );
            })()}
          </svg>
        </div>
        )}
      </div>

      {/* ── Pitch Info ── */}
      <div className="shrink-0 px-4 py-3">
        {phase === 'landed' && pitch ? (
          <div className="flex items-center justify-center gap-3">
            {pitch.speed > 0 && (
              <span className="text-[15px] font-black tabular-nums">{pitch.speed}<span className="text-[10px] font-medium text-muted-foreground/40">km/h</span></span>
            )}
            {pitch.type && (
              <span className="text-[12px] font-medium text-muted-foreground/60">{pitch.type}</span>
            )}
            <span
              className="inline-flex h-5 items-center rounded-full px-2 text-[10px] font-bold text-white"
              style={{ backgroundColor: PITCH_RESULT_COLOR[pitch.result] }}
            >
              {PITCH_RESULT_LABEL[pitch.result]}
            </span>
          </div>
        ) : phase === 'flying' && pitch ? (
          <div className="flex items-center justify-center gap-2 text-[12px] text-muted-foreground/40">
            {pitch.speed > 0 && <span className="tabular-nums">{pitch.speed}km/h</span>}
            {pitch.type && <span>{pitch.type}</span>}
          </div>
        ) : (
          <div className="text-center text-[12px] text-muted-foreground/30">
            타석 시작
          </div>
        )}
      </div>

      {/* ── Result banner (after last pitch of at-bat) ── */}
      {phase === 'landed' && isLastPitch && ab && (
        <div className="mx-4 mb-2 rounded-xl bg-muted/30 px-4 py-2.5 text-center">
          <span className="text-[13px] font-semibold">{ab.result.replace(/^[^ ]+ : /, '')}</span>
          {ab.wpa !== null && (
            <span className={cn(
              'ml-2 text-[10px] font-bold tabular-nums',
              ab.wpa >= 0 ? 'text-green-500' : 'text-red-400',
            )}>
              WPA {ab.wpa >= 0 ? '+' : ''}{ab.wpa.toFixed(1)}%
            </span>
          )}
        </div>
      )}

      {/* ── Timeline dots ── */}
      <div className="shrink-0 px-4 pb-2">
        <div className="flex items-center justify-center gap-1.5">
          {ab?.pitches.map((p, i) => {
            const done = i < pitchIdx || (i === pitchIdx && phase === 'landed');
            const current = i === pitchIdx;
            const color = PITCH_RESULT_COLOR[p.result];
            return (
              <button
                key={i}
                onClick={() => goToPitch(i)}
                className={cn(
                  'rounded-full transition-all',
                  current ? 'h-3 w-3' : 'h-2 w-2',
                )}
                style={{
                  backgroundColor: done || current ? color : undefined,
                  boxShadow: current ? `0 0 0 2px var(--background), 0 0 0 3.5px ${color}` : undefined,
                  opacity: done || current ? 1 : 0.15,
                }}
              />
            );
          })}
          <span className="ml-2 text-[10px] tabular-nums text-muted-foreground/30">
            {pitchIdx + 1}/{totalPitches}
          </span>
        </div>
      </div>

      {/* ── Controls ── */}
      <div className="shrink-0 border-t border-border/40 px-4 py-3">
        <div className="flex items-center justify-between">
          {/* At-bat counter */}
          <span className="w-20 text-[10px] tabular-nums text-muted-foreground/35">
            {abIdx + 1}/{atBats.length} 타석
          </span>

          {/* Transport */}
          <div className="flex items-center gap-0.5">
            <button
              onClick={() => goToAtBat(abIdx - 1)}
              disabled={abIdx <= 0}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-all hover:bg-muted hover:text-foreground disabled:opacity-15 active:scale-90"
            >
              <SkipBack className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => goToPitch(pitchIdx - 1)}
              disabled={pitchIdx <= 0}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-all hover:bg-muted hover:text-foreground disabled:opacity-15 active:scale-90"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            <button
              onClick={togglePlay}
              className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm transition-all hover:bg-primary/90 active:scale-95"
            >
              {playing
                ? <Pause className="h-4 w-4" />
                : <Play className="h-4 w-4 ml-0.5" />
              }
            </button>

            <button
              onClick={() => {
                if (!isLastPitch) goToPitch(pitchIdx + 1);
                else if (!isLastAtBat) goToAtBat(abIdx + 1);
              }}
              disabled={isLastPitch && isLastAtBat}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-all hover:bg-muted hover:text-foreground disabled:opacity-15 active:scale-90"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <button
              onClick={() => goToAtBat(abIdx + 1)}
              disabled={isLastAtBat}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-all hover:bg-muted hover:text-foreground disabled:opacity-15 active:scale-90"
            >
              <SkipForward className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Speed toggle */}
          <button
            onClick={() => setSpeed(s => s === 1 ? 2 : 1)}
            className="w-20 rounded-full bg-muted/50 px-2.5 py-1 text-right text-[10px] font-bold tabular-nums text-muted-foreground/40 transition-colors hover:bg-muted hover:text-foreground active:scale-95"
          >
            {speed === 1 ? '1x' : '2x'}
          </button>
        </div>
      </div>
    </div>
  );
};
