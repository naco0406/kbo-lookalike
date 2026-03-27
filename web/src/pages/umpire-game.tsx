import type { FC } from 'react';
import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Link } from 'react-router';
import { ArrowLeft, Loader2, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TEAM_COLORS } from '@/constants/analysis-messages';
import { useMonthSchedule } from '@/hooks/use-month-schedule';
import type { ScheduleGame } from '@/hooks/use-schedule';
import type { RawTextRelay, ParsedAtBat, ParsedPitch } from '@/components/game/pitch-utils';
import { parseAtBats } from '@/components/game/pitch-utils';
import { UmpireView } from '@/components/game/umpire-view';
import { SlotRoulette } from '@/components/game/slot-roulette';
import { AdContainer } from '@/components/ad/ad-container';
import { AD_SLOTS } from '@/components/ad/ad-slots';

// ── Types ────────────────────────────────────────────────────────────────────

type Phase = 'select' | 'roulette' | 'loading' | 'playing' | 'result';
type PlayState = 'intro' | 'flying' | 'judging' | 'revealing';

interface QueueItem {
  pitch: ParsedPitch;
  answer: 'ball' | 'strike';
  abIndex: number;
  batterName: string;
  batterHitType: string;
  batterPos: string;
  seasonAvg: string;
  balls: number;
  strikes: number;
  outs: number;
  difficulty: number;   // 1~5 — 존 경계 거리 기반
  isCloseCAll: boolean; // 존 경계 ±0.5인치 이내
}

interface Judgment {
  correct: boolean;
  answer: 'ball' | 'strike';
  guess: 'ball' | 'strike' | 'timeout';
  speed: number;
  type: string;
  reactionMs: number;   // 판정까지 걸린 시간 (ms)
  difficulty: number;   // 해당 투구의 난이도
  isCloseCall: boolean;
}

// ── Timing ───────────────────────────────────────────────────────────────────

const INTRO_MS = 400;
const JUDGE_TIME = 3.0;
const REVEAL_MS = 1800;
const FLIGHT_K = 135_000; // 구속 비례 비행시간 (150km/h→900ms, 130km/h→1040ms)
const flightMs = (speed: number) => speed > 0 ? Math.round(FLIGHT_K / speed) : 1200;

// ── CSS Keyframes ───────────────────────────────────────────────────────────

const GAME_KEYFRAMES = `
  @keyframes umpire-scale-in{0%{transform:scale(.7);opacity:0}100%{transform:scale(1);opacity:1}}
  @keyframes umpire-shake{0%,100%{transform:translateX(0)}12%{transform:translateX(-6px)}25%{transform:translateX(5px)}37%{transform:translateX(-4px)}50%{transform:translateX(4px)}62%{transform:translateX(-3px)}75%{transform:translateX(2px)}}
  @keyframes umpire-flash{0%{opacity:.45}100%{opacity:0}}
  @keyframes umpire-dot-ping{0%{transform:scale(1)}50%{transform:scale(1.5)}100%{transform:scale(1)}}
`;

// ── Strike zone check (for S/F/H pitches) ───────────────────────────────────

const PLATE_HALF_W = 0.7083; // 17 inches / 2 in feet

const isInStrikeZone = (
  location: { x: number; z: number } | null,
  topSz: number,
  bottomSz: number,
): boolean => {
  if (!location) return false;
  return (
    Math.abs(location.x) <= PLATE_HALF_W &&
    location.z >= bottomSz &&
    location.z <= topSz
  );
};

const pitchAnswer = (pitch: ParsedPitch): 'ball' | 'strike' => {
  if (pitch.result === 'B') return 'ball';
  if (pitch.result === 'T') return 'strike';
  // S (swinging strike), F (foul), H (hit) → determine by location
  return isInStrikeZone(pitch.location, pitch.topSz, pitch.bottomSz) ? 'strike' : 'ball';
};

// ── Pitch difficulty (zone edge distance → 1~5 stars) ───────────────────────

/** 투구 위치가 존 경계에서 얼마나 가까운지 계산 (feet). 0이면 경계 위 */
const zoneEdgeDistance = (pitch: ParsedPitch): number => {
  if (!pitch.location) return 1.0; // 위치 없으면 중간 난이도
  const { x, z } = pitch.location;
  const dxOuter = Math.abs(x) - PLATE_HALF_W;     // 양수=존 밖, 음수=존 안
  const dzTop = z - pitch.topSz;                   // 양수=위로 벗어남
  const dzBot = pitch.bottomSz - z;                // 양수=아래로 벗어남
  // 각 축에서 경계까지의 최소 거리 (절대값)
  const dx = Math.abs(dxOuter);
  const dz = Math.min(Math.abs(dzTop), Math.abs(dzBot));
  return Math.min(dx, dz);
};

/** 존 경계 거리 → 별 1~5 (가까울수록 높음) */
const calcDifficulty = (pitch: ParsedPitch): number => {
  const dist = zoneEdgeDistance(pitch);
  const inches = dist * 12; // feet → inches
  if (inches <= 0.5) return 5;   // 경계 위
  if (inches <= 1.5) return 4;   // 아슬아슬
  if (inches <= 3.0) return 3;   // 애매
  if (inches <= 5.0) return 2;   // 어느 정도 명확
  return 1;                       // 누가 봐도 명확
};

const isCloseCall = (pitch: ParsedPitch): boolean =>
  zoneEdgeDistance(pitch) * 12 <= 1.5; // 1.5인치 이내

// ── Inning key helpers (top/bottom split) ───────────────────────────────────

type InningHalf = 'T' | 'B'; // T = top (초, away batting), B = bottom (말, home batting)

const toInningKey = (inning: number, isHome: boolean): string =>
  `${inning}${isHome ? 'B' : 'T'}`;

const parseInningKey = (key: string): { inning: number; half: InningHalf } => {
  const half = key.endsWith('B') ? 'B' : 'T';
  const inning = parseInt(key.slice(0, -1), 10);
  return { inning, half };
};

const formatInningLabel = (key: string): string => {
  const { inning, half } = parseInningKey(key);
  return `${inning}회${half === 'T' ? '초' : '말'}`;
};

// ── Helpers ──────────────────────────────────────────────────────────────────

/** KST 기준 "YYYY-MM" 문자열을 반환한다. */
const toKSTMonthString = (date: Date): string =>
  date.toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 7);

/** 현재 월 + 이전 월 (두 달 커버) */
const getMonths = (): [string, string] => {
  const now = new Date();
  const cur = toKSTMonthString(now);
  const prev = new Date(now);
  prev.setMonth(prev.getMonth() - 1);
  return [cur, toKSTMonthString(prev)];
};

const formatDateLabel = (dateStr: string): { day: string; weekday: string } => {
  const d = new Date(dateStr + 'T12:00:00');
  return {
    day: `${d.getMonth() + 1}/${d.getDate()}`,
    weekday: ['일', '월', '화', '수', '목', '금', '토'][d.getDay()],
  };
};

// ── Sub-components: Selection Phase ──────────────────────────────────────────

const MiniGameCard: FC<{
  game: ScheduleGame;
  selected: boolean;
  onClick: () => void;
}> = ({ game, selected, onClick }) => {
  const awayTeam = TEAM_COLORS[game.awayCode];
  const homeTeam = TEAM_COLORS[game.homeCode];
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-all active:scale-[0.98]',
        selected
          ? 'border-primary/40 bg-primary/5 ring-1 ring-primary/20'
          : 'border-border/60 bg-card hover:border-border',
      )}
    >
      <div
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white"
        style={{ backgroundColor: awayTeam?.primary ?? '#888' }}
      >
        {awayTeam?.shortName ?? game.awayCode}
      </div>
      <div className="flex flex-1 items-baseline justify-center gap-2">
        <span className="text-[18px] font-extrabold tabular-nums">{game.awayScore ?? 0}</span>
        <span className="text-[12px] font-light text-muted-foreground/30">:</span>
        <span className="text-[18px] font-extrabold tabular-nums">{game.homeScore ?? 0}</span>
      </div>
      <div
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white"
        style={{ backgroundColor: homeTeam?.primary ?? '#888' }}
      >
        {homeTeam?.shortName ?? game.homeCode}
      </div>
    </button>
  );
};

// ── Sub-components: Playing Phase ────────────────────────────────────────────

const TimerBar: FC<{ remaining: number; total: number }> = ({ remaining, total }) => {
  const pct = (remaining / total) * 100;
  const color = remaining > 2 ? '#4ade80' : remaining > 1 ? '#fbbf24' : '#ef4444';
  return (
    <div
      className={cn('h-2 w-full rounded-full', remaining <= 1 && 'animate-pulse')}
      style={{
        background: `linear-gradient(to right, ${color} ${pct}%, rgba(255,255,255,0.06) ${pct}%)`,
      }}
    />
  );
};

const JudgeButtons: FC<{
  onJudge: (guess: 'ball' | 'strike') => void;
  disabled: boolean;
}> = ({ onJudge, disabled }) => (
  <div className="flex gap-3">
    <button
      onClick={() => onJudge('ball')}
      disabled={disabled}
      className={cn(
        'flex h-14 flex-1 items-center justify-center rounded-2xl text-[16px] font-extrabold text-white shadow-sm transition-all',
        'active:scale-95 disabled:opacity-30',
        'bg-blue-500 hover:bg-blue-600',
      )}
    >
      BALL
    </button>
    <button
      onClick={() => onJudge('strike')}
      disabled={disabled}
      className={cn(
        'flex h-14 flex-1 items-center justify-center rounded-2xl text-[16px] font-extrabold text-white shadow-sm transition-all',
        'active:scale-95 disabled:opacity-30',
        'bg-red-500 hover:bg-red-600',
      )}
    >
      STRIKE
    </button>
  </div>
);

const RevealBanner: FC<{ correct: boolean; answer: string; isCloseCall?: boolean }> = ({ correct, answer, isCloseCall: close }) => (
  <div
    className={cn(
      'flex flex-col items-center justify-center gap-1 rounded-2xl px-5 py-4 font-bold backdrop-blur-sm',
      correct
        ? 'bg-green-500/15 text-green-500 dark:text-green-400'
        : 'bg-red-500/15 text-red-500 dark:text-red-400',
    )}
    style={{ animation: 'umpire-scale-in 0.3s cubic-bezier(0.34,1.56,0.64,1)' }}
  >
    <div className="flex items-center gap-3">
      <span className="text-[22px] font-black tracking-tight">
        {correct ? 'CORRECT!' : 'WRONG'}
      </span>
      <span className="text-[12px] font-semibold opacity-50">
        {answer === 'ball' ? 'BALL' : 'STRIKE'}
      </span>
    </div>
    {close && (
      <span className="text-[10px] font-bold tracking-widest text-amber-400">
        CLOSE CALL
      </span>
    )}
  </div>
);

// ── Sub-components: Scoreboard ───────────────────────────────────────────────

const BsoIndicator: FC<{ label: string; count: number; max: number; activeColor: string }> = ({
  label, count, max, activeColor,
}) => (
  <div className="flex items-center gap-[3px]">
    <span className="w-[9px] text-[9px] font-extrabold text-muted-foreground/40">{label}</span>
    {Array.from({ length: max }, (_, i) => (
      <span
        key={i}
        className="h-[7px] w-[7px] rounded-full"
        style={{ backgroundColor: i < count ? activeColor : 'rgba(255,255,255,0.08)' }}
      />
    ))}
  </div>
);

const ScoreboardBar: FC<{
  game: ScheduleGame;
  inningKey: string;
  balls: number;
  strikes: number;
  outs: number;
  pitcherName: string;
  pitchNum: number;
  batterName: string;
  seasonAvg: string;
  batterHitType: string;
  streak: number;
}> = ({ game, inningKey, balls, strikes, outs, pitcherName, pitchNum, batterName, seasonAvg, batterHitType, streak }) => {
  const away = TEAM_COLORS[game.awayCode];
  const home = TEAM_COLORS[game.homeCode];
  return (
    <div className="flex flex-col gap-1.5 rounded-xl border border-border/30 bg-card/80 px-3 py-2">
      {/* Row 1: Score + Inning */}
      <div className="flex items-center">
        {/* Away */}
        <div className="flex flex-1 items-center gap-1.5">
          <div
            className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-[7px] font-bold text-white"
            style={{ backgroundColor: away?.primary ?? '#888' }}
          >
            {away?.shortName ?? game.awayCode}
          </div>
          <span className="text-[16px] font-black tabular-nums leading-none">{game.awayScore ?? 0}</span>
        </div>

        {/* Center: Inning + BSO */}
        <div className="flex flex-col items-center gap-1">
          <span className="text-[11px] font-bold leading-none">{formatInningLabel(inningKey)}</span>
          <div className="flex items-center gap-2">
            <BsoIndicator label="B" count={balls} max={4} activeColor="#4ade80" />
            <BsoIndicator label="S" count={strikes} max={3} activeColor="#facc15" />
            <BsoIndicator label="O" count={outs} max={3} activeColor="#ef4444" />
          </div>
        </div>

        {/* Home */}
        <div className="flex flex-1 items-center justify-end gap-1.5">
          <span className="text-[16px] font-black tabular-nums leading-none">{game.homeScore ?? 0}</span>
          <div
            className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-[7px] font-bold text-white"
            style={{ backgroundColor: home?.primary ?? '#888' }}
          >
            {home?.shortName ?? game.homeCode}
          </div>
        </div>
      </div>

      {/* Row 2: Matchup */}
      <div className="flex items-center justify-between border-t border-border/20 pt-1.5">
        <div className="flex items-center gap-1 text-[10px]">
          <span className="font-bold text-muted-foreground/40">투</span>
          <span className="font-semibold">{pitcherName || '—'}</span>
          <span className="tabular-nums text-muted-foreground/40">{pitchNum}구째</span>
        </div>
        <div className="flex items-center gap-1 text-[10px]">
          <span className="font-bold text-muted-foreground/40">타</span>
          <span className="font-semibold">{batterName}</span>
          {seasonAvg && (
            <span className="tabular-nums text-muted-foreground/40">{seasonAvg}</span>
          )}
          {batterHitType && (
            <span className="text-muted-foreground/30">{batterHitType}</span>
          )}
        </div>
        {streak >= 3 && (
          <span
            className={cn(
              'rounded-full px-1.5 py-0.5 text-[8px] font-black tabular-nums leading-none',
              streak >= 10
                ? 'bg-red-500/20 text-red-400'
                : streak >= 7
                  ? 'bg-orange-500/20 text-orange-400'
                  : 'bg-amber-500/15 text-amber-500',
            )}
            style={{ animation: 'umpire-scale-in 0.3s cubic-bezier(0.34,1.56,0.64,1)' }}
          >
            {streak >= 10 ? 'ON FIRE ' : streak >= 5 ? 'HOT ' : ''}{streak}
          </span>
        )}
      </div>
    </div>
  );
};

// ── Sub-components: Result Phase ─────────────────────────────────────────────

// ── Difficulty stars ──

const DifficultyStars: FC<{ level: number }> = ({ level }) => (
  <span className="inline-flex gap-px text-[10px]" title={`난이도 ${level}/5`}>
    {Array.from({ length: 5 }, (_, i) => (
      <span key={i} className={i < level ? 'text-amber-400' : 'text-muted-foreground/15'}>★</span>
    ))}
  </span>
);

// ── Result Screen — 공유 카드형 ──

const ResultScreen: FC<{
  judgments: Judgment[];
  onRetry: () => void;
  onBack: () => void;
}> = ({ judgments, onRetry, onBack }) => {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  const total = judgments.length;
  const correct = judgments.filter(j => j.correct).length;
  const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
  const balls = judgments.filter(j => j.answer === 'ball');
  const strikes = judgments.filter(j => j.answer === 'strike');
  const ballCorrect = balls.filter(j => j.correct).length;
  const strikeCorrect = strikes.filter(j => j.correct).length;
  const timeouts = judgments.filter(j => j.guess === 'timeout').length;
  const closeCalls = judgments.filter(j => j.isCloseCall);
  const closeCorrect = closeCalls.filter(j => j.correct).length;

  // 평균 반응 속도 (타임아웃 제외)
  const validReactions = judgments.filter(j => j.guess !== 'timeout');
  const avgReactionMs = validReactions.length > 0
    ? Math.round(validReactions.reduce((s, j) => s + j.reactionMs, 0) / validReactions.length)
    : 0;
  const fastestMs = validReactions.length > 0
    ? Math.min(...validReactions.map(j => j.reactionMs))
    : 0;

  // 평균 난이도
  const avgDifficulty = total > 0
    ? (judgments.reduce((s, j) => s + j.difficulty, 0) / total)
    : 0;

  let maxStreak = 0, cur = 0;
  for (const j of judgments) { if (j.correct) { cur++; maxStreak = Math.max(maxStreak, cur); } else cur = 0; }

  const gradeColor = pct >= 80 ? '#22c55e' : pct >= 60 ? '#f59e0b' : '#ef4444';
  const grade =
    pct >= 95 ? { label: 'PERFECT', sub: '완벽한 심판' }
    : pct >= 85 ? { label: 'EXCELLENT', sub: '엘리트 심판' }
    : pct >= 70 ? { label: 'GREAT', sub: '프로 심판' }
    : pct >= 50 ? { label: 'GOOD', sub: '아마추어 심판' }
    : { label: 'KEEP GOING', sub: '연습이 필요해요' };

  const stagger = (delay: number): React.CSSProperties => ({
    opacity: mounted ? 1 : 0,
    transform: mounted ? 'translateY(0)' : 'translateY(16px)',
    transition: `opacity 0.5s cubic-bezier(0.4,0,0.2,1) ${delay}s, transform 0.5s cubic-bezier(0.4,0,0.2,1) ${delay}s`,
  });

  const ballPct = balls.length > 0 ? Math.round((ballCorrect / balls.length) * 100) : 0;
  const strikePct = strikes.length > 0 ? Math.round((strikeCorrect / strikes.length) * 100) : 0;

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col px-5 pb-8 pt-4">

      {/* ── Share Card — 캡처/공유 대상 영역 ── */}
      <div
        className="relative overflow-hidden rounded-3xl border border-border/40 bg-card"
        style={stagger(0.05)}
      >
        {/* 상단: 등급 + 점수 (그라데이션 배경) */}
        <div
          className="relative flex flex-col items-center px-6 pt-8 pb-6"
          style={{ background: `linear-gradient(180deg, ${gradeColor}15 0%, transparent 100%)` }}
        >
          {/* 등급 배지 */}
          <div
            className="mb-3 rounded-full px-4 py-1 text-[11px] font-black tracking-[0.2em]"
            style={{ backgroundColor: `${gradeColor}20`, color: gradeColor }}
          >
            {grade.label}
          </div>

          {/* 점수 */}
          <div className="flex items-baseline gap-1">
            <span
              className="font-score text-[64px] leading-none"
              style={{ color: gradeColor }}
            >
              {pct}
            </span>
            <span className="text-[18px] font-bold text-muted-foreground/30">점</span>
          </div>
          <p className="mt-1 text-[13px] font-medium text-muted-foreground/60">{grade.sub}</p>

          {/* 핵심 3스탯 */}
          <div className="mt-5 flex w-full items-center justify-center gap-5">
            <div className="flex flex-col items-center">
              <span className="text-[22px] font-black tabular-nums leading-none">{correct}<span className="text-[13px] text-muted-foreground/30">/{total}</span></span>
              <span className="mt-1 text-[10px] font-medium text-muted-foreground/40">정답</span>
            </div>
            <div className="h-8 w-px bg-border/30" />
            <div className="flex flex-col items-center">
              <span className="text-[22px] font-black tabular-nums leading-none">{maxStreak}</span>
              <span className="mt-1 text-[10px] font-medium text-muted-foreground/40">최대 연속</span>
            </div>
            <div className="h-8 w-px bg-border/30" />
            <div className="flex flex-col items-center">
              <span className="text-[22px] font-black tabular-nums leading-none">{avgReactionMs > 0 ? `${(avgReactionMs / 1000).toFixed(1)}` : '-'}<span className="text-[11px] text-muted-foreground/30">s</span></span>
              <span className="mt-1 text-[10px] font-medium text-muted-foreground/40">평균 반응</span>
            </div>
          </div>
        </div>

        {/* 중단: 상세 스탯 그리드 */}
        <div className="grid grid-cols-2 gap-px bg-border/20">
          {/* Ball 정확도 */}
          <div className="flex flex-col items-center bg-card px-4 py-4" style={stagger(0.3)}>
            <span className="text-[11px] font-bold text-blue-500">BALL</span>
            <span className="mt-1 text-[20px] font-black tabular-nums text-blue-500">{ballPct}%</span>
            <span className="text-[10px] text-muted-foreground/40">{ballCorrect}/{balls.length}</span>
          </div>
          {/* Strike 정확도 */}
          <div className="flex flex-col items-center bg-card px-4 py-4" style={stagger(0.35)}>
            <span className="text-[11px] font-bold text-red-500">STRIKE</span>
            <span className="mt-1 text-[20px] font-black tabular-nums text-red-500">{strikePct}%</span>
            <span className="text-[10px] text-muted-foreground/40">{strikeCorrect}/{strikes.length}</span>
          </div>
          {/* 난이도 */}
          <div className="flex flex-col items-center bg-card px-4 py-4" style={stagger(0.4)}>
            <span className="text-[11px] font-bold text-amber-500">난이도</span>
            <div className="mt-1"><DifficultyStars level={Math.round(avgDifficulty)} /></div>
            <span className="text-[10px] text-muted-foreground/40">{avgDifficulty.toFixed(1)} / 5</span>
          </div>
          {/* 클로즈 콜 */}
          <div className="flex flex-col items-center bg-card px-4 py-4" style={stagger(0.45)}>
            <span className="text-[11px] font-bold text-purple-500">CLOSE CALL</span>
            <span className="mt-1 text-[20px] font-black tabular-nums text-purple-500">
              {closeCalls.length > 0 ? `${closeCorrect}/${closeCalls.length}` : '-'}
            </span>
            <span className="text-[10px] text-muted-foreground/40">경계 투구</span>
          </div>
        </div>

        {/* 하단: 투구별 스트립 */}
        <div className="px-5 py-4" style={stagger(0.55)}>
          <div className="flex flex-wrap items-center justify-center gap-[3px]">
            {judgments.map((j, i) => (
              <div
                key={i}
                className={cn(
                  'flex h-[22px] w-[22px] items-center justify-center rounded text-[7px] font-bold',
                  j.correct
                    ? 'bg-green-500/15 text-green-500'
                    : j.guess === 'timeout'
                      ? 'bg-amber-500/15 text-amber-500'
                      : 'bg-red-500/15 text-red-500',
                )}
              >
                {j.correct ? 'O' : j.guess === 'timeout' ? 'T' : 'X'}
              </div>
            ))}
          </div>
        </div>

        {/* 워터마크 */}
        <div className="flex items-center justify-center pb-3">
          <span className="font-score text-[14px] tracking-widest text-muted-foreground/20">643</span>
        </div>
      </div>

      {/* 추가 정보 (카드 외부) */}
      {(timeouts > 0 || fastestMs > 0) && (
        <div className="mt-3 flex gap-2" style={stagger(0.65)}>
          {timeouts > 0 && (
            <div className="flex flex-1 items-center justify-between rounded-xl border border-border/30 bg-card/50 px-3.5 py-2.5">
              <span className="text-[10px] font-medium text-muted-foreground/50">타임아웃</span>
              <span className="text-[12px] font-bold tabular-nums text-amber-500">{timeouts}</span>
            </div>
          )}
          {fastestMs > 0 && (
            <div className="flex flex-1 items-center justify-between rounded-xl border border-border/30 bg-card/50 px-3.5 py-2.5">
              <span className="text-[10px] font-medium text-muted-foreground/50">최빠른 판정</span>
              <span className="text-[12px] font-bold tabular-nums">{(fastestMs / 1000).toFixed(2)}s</span>
            </div>
          )}
        </div>
      )}

      {/* Ad */}
      <AdContainer
        type={AD_SLOTS.umpireResult.type}
        unitId={AD_SLOTS.umpireResult.unitId}
      />

      {/* Spacer */}
      <div className="flex-1" />

      {/* Actions */}
      <div className="mt-6 flex flex-col gap-2.5" style={stagger(0.75)}>
        <button
          onClick={onRetry}
          className="flex h-[52px] items-center justify-center gap-2 rounded-2xl bg-accent text-[14px] font-bold text-accent-foreground shadow-sm transition-all hover:bg-accent/90 active:scale-[0.97]"
        >
          <RotateCcw className="h-4 w-4" />
          다시 도전
        </button>
        <button
          onClick={onBack}
          className="flex h-[48px] items-center justify-center rounded-2xl text-[13px] font-medium text-muted-foreground transition-all hover:bg-muted/60 active:scale-[0.97]"
        >
          다른 경기 선택
        </button>
      </div>
    </div>
  );
};

// ── Main Page ────────────────────────────────────────────────────────────────

export const UmpireGamePage: FC = () => {
  // ── Phase ──
  const [phase, setPhase] = useState<Phase>('select');

  // ── Selection state ──
  // 현재 월 + 이전 월 로드 → 완료된 경기 전체를 확보
  const [curMonth, prevMonth] = useMemo(getMonths, []);
  const { gamesByDate: curGames, loading: curLoading } = useMonthSchedule(curMonth);
  const { gamesByDate: prevGames, loading: prevLoading } = useMonthSchedule(prevMonth);
  const scheduleLoading = curLoading || prevLoading;

  // 두 달의 gamesByDate 병합
  const gamesByDate = useMemo(() => {
    const merged: Record<string, ScheduleGame[]> = {};
    for (const [d, g] of Object.entries(prevGames)) merged[d] = g;
    for (const [d, g] of Object.entries(curGames)) merged[d] = g;
    return merged;
  }, [curGames, prevGames]);

  const [selectedGameId, setSelectedGameId] = useState<string | null>(null);
  const [selectedInningKey, setSelectedInningKey] = useState<string>('1T');

  // ── Relay data ──
  const [allAtBats, setAllAtBats] = useState<ParsedAtBat[]>([]);
  const [relayLoading, setRelayLoading] = useState(false);
  const [pitcherNames, setPitcherNames] = useState<{ home: string; away: string }>({ home: '', away: '' });

  const currentPitcherName = useMemo(() => {
    if (!selectedInningKey) return '';
    const { half } = parseInningKey(selectedInningKey);
    // 초(T) = away batting → home pitching; 말(B) = home batting → away pitching
    return half === 'T' ? pitcherNames.home : pitcherNames.away;
  }, [selectedInningKey, pitcherNames]);

  const inningPitchCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const ab of allAtBats) {
      const key = toInningKey(ab.inning, ab.isHome);
      const count = ab.pitches.filter(p => p.trajectory).length;
      map.set(key, (map.get(key) ?? 0) + count);
    }
    return map;
  }, [allAtBats]);

  const availableInnings = useMemo(
    () => Array.from(inningPitchCounts.keys()).sort((a, b) => {
      const pa = parseInningKey(a);
      const pb = parseInningKey(b);
      if (pa.inning !== pb.inning) return pa.inning - pb.inning;
      return pa.half === 'T' ? -1 : 1; // 초 before 말
    }),
    [inningPitchCounts],
  );

  // ── Roulette metadata (random start용) ──
  const [rouletteInfo, setRouletteInfo] = useState<{
    dateLabel: string;
    matchLabel: string;
    awayCode: string;
    homeCode: string;
    inningLabel: string;
  } | null>(null);

  // ── All completed games (for random start + game list) ──
  const allCompletedGames = useMemo(() => {
    const games: Array<{ date: string; game: ScheduleGame }> = [];
    // 날짜 내림차순 (최신 먼저)
    const sortedDates = Object.keys(gamesByDate).sort((a, b) => b.localeCompare(a));
    for (const dateStr of sortedDates) {
      for (const g of gamesByDate[dateStr]) {
        if (g.status === 'completed') games.push({ date: dateStr, game: g });
      }
    }
    return games;
  }, [gamesByDate]);

  const selectedGame = useMemo(
    () => allCompletedGames.find(({ game: g }) => g.id === selectedGameId)?.game ?? null,
    [allCompletedGames, selectedGameId],
  );

  /** 랜덤 경기 선택 → 릴레이 로드 → 랜덤 이닝 선택 → 룰렛 시작 */
  const startRandom = useCallback(async () => {
    if (allCompletedGames.length === 0) return;

    // 1. 랜덤 경기 선택
    const pick = allCompletedGames[Math.floor(Math.random() * allCompletedGames.length)];
    const { date, game } = pick;

    // 2. 릴레이 로드
    setPhase('loading');
    try {
      const resp = await fetch(`/api/relay/${game.id}`);
      if (!resp.ok) throw new Error(`${resp.status}`);
      const json = await resp.json();
      const textRelays = json.textRelayData?.textRelays ?? [];
      const sorted = textRelays.slice().sort(
        (a: { no?: number }, b: { no?: number }) => (a.no ?? 0) - (b.no ?? 0),
      );
      const abs = parseAtBats(sorted as unknown as RawTextRelay[]);

      // 사용 가능한 이닝 계산
      const inningMap = new Map<string, number>();
      for (const ab of abs) {
        const key = toInningKey(ab.inning, ab.isHome);
        const count = ab.pitches.filter(p => p.trajectory).length;
        inningMap.set(key, (inningMap.get(key) ?? 0) + count);
      }
      const innings = Array.from(inningMap.keys()).filter(k => (inningMap.get(k) ?? 0) > 0);
      if (innings.length === 0) {
        // 투구 데이터 없으면 다시 select로
        setPhase('select');
        return;
      }

      // 3. 랜덤 이닝 선택
      const randomInning = innings[Math.floor(Math.random() * innings.length)];

      // 4. 상태 세팅
      setSelectedGameId(game.id);
      setAllAtBats(abs);
      setSelectedInningKey(randomInning);

      // pitcher names
      const td = json.textRelayData ?? json;
      const getPitcherName = (lineup: Record<string, unknown> | undefined): string => {
        const pitchers = ((lineup ?? {}).pitcher ?? []) as Array<{ name?: string }>;
        return pitchers[0]?.name ?? '';
      };
      setPitcherNames({
        home: getPitcherName(td.homeLineup),
        away: getPitcherName(td.awayLineup),
      });

      // 5. 룰렛 메타데이터
      const { day, weekday } = formatDateLabel(date);
      const away = TEAM_COLORS[game.awayCode];
      const home = TEAM_COLORS[game.homeCode];
      setRouletteInfo({
        dateLabel: `${day} ${weekday}`,
        matchLabel: `${away?.shortName ?? game.awayCode} vs ${home?.shortName ?? game.homeCode}`,
        awayCode: game.awayCode,
        homeCode: game.homeCode,
        inningLabel: formatInningLabel(randomInning),
      });

      // 6. 룰렛 페이즈로
      setPhase('roulette');
    } catch {
      setPhase('select');
    }
  }, [allCompletedGames]);

  // ── Playing state ──
  const [pitchQueue, setPitchQueue] = useState<QueueItem[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [playState, setPlayState] = useState<PlayState>('intro');
  const [animProgress, setAnimProgress] = useState(0);
  const [timer, setTimer] = useState(JUDGE_TIME);
  const [judgments, setJudgments] = useState<Judgment[]>([]);
  const [lastResult, setLastResult] = useState<{ correct: boolean; answer: string; isCloseCall?: boolean } | null>(null);
  const [shaking, setShaking] = useState(false);
  const [cameraOffset, setCameraOffset] = useState({ x: 0, y: 0 });

  const animRef = useRef(0);
  const startRef = useRef(0);
  const timerRef = useRef(0);
  const revealRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const judgeStartRef = useRef(0); // 판정 시작 시점 (performance.now)

  const currentItem = pitchQueue[currentIdx];

  // ── Fetch relay when game is selected ──
  useEffect(() => {
    if (!selectedGameId) {
      setAllAtBats([]);
      return;
    }

    let cancelled = false;
    const fetchRelay = async () => {
      setRelayLoading(true);
      try {
        const resp = await fetch(`/api/relay/${selectedGameId}`);
        if (!resp.ok) throw new Error(`${resp.status}`);
        const json = await resp.json();
        const textRelays = json.textRelayData?.textRelays ?? [];
        const sorted = textRelays.slice().sort(
          (a: { no?: number }, b: { no?: number }) => (a.no ?? 0) - (b.no ?? 0),
        );
        if (!cancelled) {
          const abs = parseAtBats(sorted as unknown as RawTextRelay[]);
          setAllAtBats(abs);
          const firstAb = abs.find(ab =>
            ab.pitches.some(p => p.trajectory),
          );
          if (firstAb) setSelectedInningKey(toInningKey(firstAb.inning, firstAb.isHome));

          // Extract pitcher names from lineup data
          const td = json.textRelayData ?? json;
          const getPitcherName = (lineup: Record<string, unknown> | undefined): string => {
            const pitchers = ((lineup ?? {}).pitcher ?? []) as Array<{ name?: string }>;
            return pitchers[0]?.name ?? '';
          };
          setPitcherNames({
            home: getPitcherName(td.homeLineup),
            away: getPitcherName(td.awayLineup),
          });
        }
      } catch {
        if (!cancelled) setAllAtBats([]);
      } finally {
        if (!cancelled) setRelayLoading(false);
      }
    };

    fetchRelay();
    return () => { cancelled = true; };
  }, [selectedGameId]);

  // ── Animation: intro → flying (judgable) ──
  useEffect(() => {
    if (playState !== 'intro') return;
    // 매 투구마다 카메라 흔들림 (심판 시야 변화 — 패럴랙스 기반)
    setCameraOffset({
      x: (Math.random() - 0.5) * 28,  // ±14px (near layer 기준)
      y: (Math.random() - 0.5) * 16,  // ±8px
    });
    const t = setTimeout(() => setPlayState('flying'), INTRO_MS);
    return () => clearTimeout(t);
  }, [playState, currentIdx]);

  // ── Animation: ball flight (duration scales with pitch speed) ──
  useEffect(() => {
    if (playState !== 'flying' || !currentItem) return;

    const duration = flightMs(currentItem.pitch.speed);

    const tick = (ts: number) => {
      if (!startRef.current) startRef.current = ts;
      const p = Math.min(1, (ts - startRef.current) / duration);
      setAnimProgress(p);
      if (p < 1) {
        animRef.current = requestAnimationFrame(tick);
      } else {
        setPlayState('judging');
        setTimer(JUDGE_TIME);
      }
    };

    startRef.current = 0;
    setAnimProgress(0);
    animRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animRef.current);
  }, [playState, currentIdx, currentItem]);

  // ── Timer countdown during judging ──
  useEffect(() => {
    if (playState !== 'judging') return;
    judgeStartRef.current = performance.now();

    const start = performance.now();
    const tick = (now: number) => {
      const elapsed = (now - start) / 1000;
      const remaining = Math.max(0, JUDGE_TIME - elapsed);
      setTimer(remaining);
      if (remaining > 0) {
        timerRef.current = requestAnimationFrame(tick);
      } else {
        handleJudge('timeout');
      }
    };

    timerRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(timerRef.current);
    // handleJudge is excluded: its deps (currentItem, advanceToNext) derive from currentIdx
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playState, currentIdx]);

  // ── Advance to next pitch ──
  const advanceToNext = useCallback(() => {
    const nextIdx = currentIdx + 1;
    if (nextIdx >= pitchQueue.length) {
      setPhase('result');
      return;
    }

    setCurrentIdx(nextIdx);
    setAnimProgress(0);
    setLastResult(null);
    setPlayState('intro');
  }, [currentIdx, pitchQueue]);

  // ── Judgment handler ──
  const handleJudge = useCallback((guess: 'ball' | 'strike' | 'timeout') => {
    if (playState !== 'judging' || !currentItem) return;
    cancelAnimationFrame(timerRef.current);

    const correct = guess !== 'timeout' && guess === currentItem.answer;
    const reactionMs = guess === 'timeout'
      ? JUDGE_TIME * 1000
      : Math.round(performance.now() - judgeStartRef.current);

    setJudgments(prev => [
      ...prev,
      {
        correct,
        answer: currentItem.answer,
        guess,
        speed: currentItem.pitch.speed,
        type: currentItem.pitch.type,
        reactionMs,
        difficulty: currentItem.difficulty,
        isCloseCall: currentItem.isCloseCAll,
      },
    ]);

    setLastResult({ correct, answer: currentItem.answer, isCloseCall: currentItem.isCloseCAll });
    setPlayState('revealing');

    // Haptic feedback
    if (navigator.vibrate) {
      navigator.vibrate(correct ? [25] : [40, 25, 40]);
    }
    // Screen shake on wrong
    if (!correct) {
      setShaking(true);
      setTimeout(() => setShaking(false), 500);
    }

    revealRef.current = setTimeout(() => advanceToNext(), REVEAL_MS);
  }, [playState, currentItem, advanceToNext]);

  // ── Start game (+ ref for stable callback from roulette) ──
  const startGameRef = useRef<() => void>(() => {});
  const startGame = useCallback(() => {
    const { inning, half } = parseInningKey(selectedInningKey);
    const isHome = half === 'B';
    const inningAtBats = allAtBats.filter(
      ab => ab.inning === inning && ab.isHome === isHome,
    );

    const queue: QueueItem[] = [];
    let outs = 0;
    inningAtBats.forEach((ab, abI) => {
      let balls = 0, strikes = 0;
      for (const p of ab.pitches) {
        if (p.trajectory) {
          queue.push({
            pitch: p,
            answer: pitchAnswer(p),
            abIndex: abI,
            batterName: ab.batterName,
            batterHitType: ab.batterHitType,
            batterPos: ab.batterPos,
            seasonAvg: ab.seasonAvg,
            balls,
            strikes,
            outs,
            difficulty: calcDifficulty(p),
            isCloseCAll: isCloseCall(p),
          });
        }
        // Update BSO for every pitch (including non-trajectory)
        if (p.result === 'B') balls++;
        else if (p.result === 'T' || p.result === 'S') strikes = Math.min(strikes + 1, 2);
        else if (p.result === 'F' && strikes < 2) strikes++;
      }
      // Update outs after the at-bat
      if (ab.resultType === 'out') {
        outs += /병살/.test(ab.result) ? 2 : 1;
        outs = Math.min(outs, 3);
      }
    });

    if (queue.length === 0) return;

    setPitchQueue(queue);
    setCurrentIdx(0);
    setJudgments([]);
    setLastResult(null);
    setAnimProgress(0);
    setPlayState('intro');
    setPhase('playing');
  }, [allAtBats, selectedInningKey]);
  startGameRef.current = startGame;

  // ── Exit prevention during playing ──
  useEffect(() => {
    if (phase !== 'playing') return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [phase]);

  const confirmExit = useCallback(() => {
    if (phase !== 'playing') return true;
    return window.confirm('게임이 진행 중입니다. 정말 나가시겠습니까?');
  }, [phase]);

  // ── Streak tracking ──
  const streak = useMemo(() => {
    let s = 0;
    for (let i = judgments.length - 1; i >= 0; i--) {
      if (judgments[i].correct) s++;
      else break;
    }
    return s;
  }, [judgments]);

  // ── Cleanup ──
  useEffect(() => {
    return () => {
      cancelAnimationFrame(animRef.current);
      cancelAnimationFrame(timerRef.current);
      if (revealRef.current) clearTimeout(revealRef.current);
    };
  }, []);

  const umpirePhase = playState === 'intro' ? 'intro' : playState === 'flying' ? 'flying' : 'landed' as const;

  const pitchCount = inningPitchCounts.get(selectedInningKey) ?? 0;

  // ────────────────────────────────────────────────────────────────────────────
  // Render
  // ────────────────────────────────────────────────────────────────────────────

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <style>{GAME_KEYFRAMES}</style>

      {/* ── Header ── */}
      <header className="sticky top-0 z-50 border-b bg-background/90 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-md items-center gap-3 px-5">
          {phase === 'playing' ? (
            <>
              <button
                onClick={() => {
                  if (!confirmExit()) return;
                  cancelAnimationFrame(animRef.current);
                  cancelAnimationFrame(timerRef.current);
                  if (revealRef.current) clearTimeout(revealRef.current);
                  setPhase('select');
                }}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
              <div className="flex flex-1 items-center justify-center gap-2">
                <span className="text-[13px] font-bold">공을 네모 안에 넣어</span>
                <span className="text-[11px] tabular-nums text-muted-foreground/50">
                  {currentIdx + 1}/{pitchQueue.length}
                </span>
              </div>
              <div className="w-8" />
            </>
          ) : (
            <>
              <Link
                to="/"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <ArrowLeft className="h-4 w-4" />
              </Link>
              <span className="text-[15px] font-bold">공을 네모 안에 넣어</span>
            </>
          )}
        </div>
      </header>

      {/* ── Select Phase ── */}
      {phase === 'select' && (
        <div className="mx-auto w-full max-w-md flex-1 px-5 pb-12">

          {/* ── Hero: 바로 시작 ── */}
          <section className="mt-5 mb-10">
            <button
              onClick={startRandom}
              disabled={scheduleLoading || allCompletedGames.length === 0}
              className="group w-full animate-reveal-up overflow-hidden rounded-3xl bg-accent text-left transition-all active:scale-[0.98] disabled:opacity-50"
            >
              <div className="px-6 pt-6 pb-5">
                <span className="text-[36px] leading-none">🎰</span>
                <p className="mt-3 text-[22px] font-extrabold leading-tight tracking-tight text-accent-foreground">
                  바로 시작
                </p>
                <p className="mt-2 text-[14px] leading-relaxed text-accent-foreground/70">
                  랜덤 경기로 바로 판정해보세요
                </p>
                <div className="mt-5 inline-flex items-center rounded-full bg-accent-foreground/20 px-5 py-2.5 text-[14px] font-bold text-accent-foreground transition-colors group-hover:bg-accent-foreground/30">
                  랜덤 판정하기
                </div>
              </div>
            </button>
          </section>

          {/* ── 최근 경기 ── */}
          <section>
            <h2 className="mb-4 text-[17px] font-extrabold tracking-tight">최근 경기</h2>

            {scheduleLoading ? (
              <div className="flex h-32 items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground/40" />
              </div>
            ) : allCompletedGames.length === 0 ? (
              <div className="flex h-32 flex-col items-center justify-center gap-1.5 rounded-2xl border bg-card">
                <p className="text-[13px] text-muted-foreground/50">종료된 경기가 없습니다</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {/* 최근 15경기만 표시 (날짜 라벨 포함, 컴팩트) */}
                {(() => {
                  const recent = allCompletedGames.slice(0, 15);
                  let lastDate = '';
                  const todayStr = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });
                  return recent.map(({ date, game: g }) => {
                    const showDate = date !== lastDate;
                    lastDate = date;
                    const { day, weekday } = formatDateLabel(date);
                    const isSelected = selectedGameId === g.id;
                    return (
                      <div key={g.id}>
                        {showDate && (
                          <p className="mb-1.5 mt-3 first:mt-0 text-[12px] font-semibold text-muted-foreground/50">
                            {date === todayStr ? '오늘' : `${day} (${weekday})`}
                          </p>
                        )}
                        <MiniGameCard
                          game={g}
                          selected={isSelected}
                          onClick={() => setSelectedGameId(isSelected ? null : g.id)}
                        />
                        {/* 인라인 이닝 선택 */}
                        {isSelected && (
                          <div className="mt-2 animate-reveal-up rounded-2xl border border-border/30 bg-card/60 px-4 py-3">
                            {relayLoading ? (
                              <div className="flex h-12 items-center justify-center gap-2 text-muted-foreground/40">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                <span className="text-[12px]">투구 데이터 로딩...</span>
                              </div>
                            ) : availableInnings.length === 0 ? (
                              <p className="py-2 text-center text-[12px] text-muted-foreground/50">
                                판정 가능한 투구 데이터가 없습니다
                              </p>
                            ) : (
                              <>
                                <div className="flex flex-wrap gap-1.5">
                                  {availableInnings.map((key) => {
                                    const count = inningPitchCounts.get(key) ?? 0;
                                    const active = selectedInningKey === key;
                                    return (
                                      <button
                                        key={key}
                                        onClick={() => setSelectedInningKey(key)}
                                        className={cn(
                                          'rounded-lg px-2.5 py-1.5 text-[11px] font-bold transition-all active:scale-95',
                                          active
                                            ? 'bg-accent text-accent-foreground'
                                            : 'bg-muted/50 text-muted-foreground hover:bg-muted',
                                        )}
                                      >
                                        {formatInningLabel(key)}
                                        <span className={cn(
                                          'ml-1 text-[9px] font-medium',
                                          active ? 'text-accent-foreground/70' : 'text-muted-foreground/40',
                                        )}>
                                          {count}
                                        </span>
                                      </button>
                                    );
                                  })}
                                </div>
                                <button
                                  onClick={startGame}
                                  disabled={pitchCount === 0}
                                  className="mt-3 flex h-10 w-full items-center justify-center rounded-xl bg-accent text-[13px] font-bold text-accent-foreground transition-all hover:bg-accent/90 active:scale-[0.97] disabled:opacity-30"
                                >
                                  {formatInningLabel(selectedInningKey)} 시작
                                </button>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  });
                })()}
              </div>
            )}
          </section>
        </div>
      )}

      {/* ── Roulette Phase ── */}
      {phase === 'roulette' && rouletteInfo && (
        <div className="flex flex-1 items-center justify-center">
          <SlotRoulette
            dateLabel={rouletteInfo.dateLabel}
            matchLabel={rouletteInfo.matchLabel}
            awayCode={rouletteInfo.awayCode}
            homeCode={rouletteInfo.homeCode}
            inningLabel={rouletteInfo.inningLabel}
            onComplete={() => startGameRef.current()}
          />
        </div>
      )}

      {/* ── Loading Phase ── */}
      {phase === 'loading' && (
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground/40" />
        </div>
      )}

      {/* ── Playing Phase ── */}
      {phase === 'playing' && currentItem && (
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 pb-6">
          {/* Scoreboard */}
          {selectedGame && (
            <div className="shrink-0 pt-2 pb-1">
              <ScoreboardBar
                game={selectedGame}
                inningKey={selectedInningKey}
                balls={currentItem.balls}
                strikes={currentItem.strikes}
                outs={currentItem.outs}
                pitcherName={currentPitcherName}
                pitchNum={currentIdx + 1}
                batterName={currentItem.batterName}
                seasonAvg={currentItem.seasonAvg}
                batterHitType={currentItem.batterHitType}
                streak={streak}
              />
            </div>
          )}

          {/* Progress dots */}
          <div className="flex shrink-0 items-center justify-center gap-1 py-2">
            {pitchQueue.map((_, i) => {
              const j = judgments[i];
              const isCurrent = i === currentIdx;
              return (
                <span
                  key={i}
                  className={cn(
                    'rounded-full transition-all duration-300',
                    isCurrent ? 'h-2.5 w-2.5' : 'h-1.5 w-1.5',
                  )}
                  style={{
                    backgroundColor: j
                      ? j.correct
                        ? '#4ade80'
                        : '#ef4444'
                      : isCurrent
                        ? 'currentColor'
                        : undefined,
                    opacity: j || isCurrent ? 1 : 0.1,
                    boxShadow: isCurrent ? '0 0 6px rgba(255,255,255,0.3)' : undefined,
                    animation: isCurrent ? 'umpire-dot-ping 1.5s ease-in-out infinite' : undefined,
                  }}
                />
              );
            })}
          </div>

          {/* UmpireView */}
          <div
            className={cn(
              'relative shrink-0 overflow-hidden rounded-2xl border bg-muted/10 transition-[border-color] duration-500',
              streak >= 10
                ? 'border-red-500/50'
                : streak >= 5
                  ? 'border-amber-500/40'
                  : streak >= 3
                    ? 'border-green-500/30'
                    : 'border-border/30',
            )}
            style={shaking ? { animation: 'umpire-shake 0.5s ease-out' } : undefined}
          >
            <UmpireView
              pitches={[currentItem.pitch]}
              currentPitchIndex={0}
              phase={umpirePhase}
              progress={animProgress}
              showZone={playState === 'revealing'}
              cameraOffset={cameraOffset}
            />
            {/* Result flash overlay */}
            {playState === 'revealing' && lastResult && (
              <div
                className="pointer-events-none absolute inset-0 rounded-2xl"
                style={{
                  backgroundColor: lastResult.correct ? '#22c55e' : '#ef4444',
                  animation: 'umpire-flash 0.5s ease-out forwards',
                }}
              />
            )}
          </div>

          {/* Pitch info */}
          <div className="shrink-0 py-2 text-center">
            {(playState === 'judging' || playState === 'revealing') &&
            currentItem.pitch.speed > 0 ? (
              <div className="flex items-center justify-center gap-2">
                <span className="text-[16px] font-black tabular-nums">
                  {currentItem.pitch.speed}
                  <span className="text-[10px] font-medium text-muted-foreground/40">km/h</span>
                </span>
                {currentItem.pitch.type && (
                  <span className="text-[12px] font-medium text-muted-foreground/60">
                    {currentItem.pitch.type}
                  </span>
                )}
              </div>
            ) : (
              <div className="h-[24px]" />
            )}
          </div>

          {/* Reveal banner */}
          {playState === 'revealing' && lastResult && (
            <div className="shrink-0 mb-2">
              <RevealBanner correct={lastResult.correct} answer={lastResult.answer} isCloseCall={lastResult.isCloseCall} />
            </div>
          )}

          {/* Spacer */}
          <div className="flex-1" />

          {/* Timer */}
          {playState === 'judging' && (
            <div className="shrink-0 mb-3 px-2">
              <TimerBar remaining={timer} total={JUDGE_TIME} />
            </div>
          )}

          {/* Judgment buttons */}
          <div className="shrink-0">
            <JudgeButtons
              onJudge={handleJudge}
              disabled={playState !== 'judging'}
            />
          </div>
        </div>
      )}

      {/* ── Result Phase ── */}
      {phase === 'result' && (
        <ResultScreen
          judgments={judgments}
          onRetry={startGame}
          onBack={() => setPhase('select')}
        />
      )}
    </div>
  );
};
