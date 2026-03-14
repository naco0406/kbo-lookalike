import type { FC } from 'react';
import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Link } from 'react-router';
import { ArrowLeft, Loader2, ChevronRight, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TEAM_COLORS } from '@/constants/analysis-messages';
import { useMonthSchedule } from '@/hooks/use-month-schedule';
import type { ScheduleGame } from '@/hooks/use-schedule';
import type { RawTextRelay, ParsedAtBat, ParsedPitch } from '@/components/game/pitch-utils';
import { parseAtBats } from '@/components/game/pitch-utils';
import { UmpireView } from '@/components/game/umpire-view';

// ── Types ────────────────────────────────────────────────────────────────────

type Phase = 'select' | 'loading' | 'playing' | 'result';
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
}

interface Judgment {
  correct: boolean;
  answer: 'ball' | 'strike';
  guess: 'ball' | 'strike' | 'timeout';
  speed: number;
  type: string;
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

/** KST 기준 "YYYY-MM-DD" 문자열을 반환한다. */
const toKSTDateString = (date: Date): string => {
  return date.toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });
};

const generateDates = (): string[] => {
  const dates: string[] = [];
  const now = new Date();
  for (let i = 0; i <= 6; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    dates.push(toKSTDateString(d));
  }
  return dates;
};

const DATES = generateDates();

const formatDateLabel = (dateStr: string): { day: string; weekday: string } => {
  const d = new Date(dateStr + 'T12:00:00');
  return {
    day: `${d.getMonth() + 1}/${d.getDate()}`,
    weekday: ['일', '월', '화', '수', '목', '금', '토'][d.getDay()],
  };
};

// ── Sub-components: Selection Phase ──────────────────────────────────────────

const DatePill: FC<{
  date: string;
  active: boolean;
  onClick: () => void;
}> = ({ date, active, onClick }) => {
  const { day, weekday } = formatDateLabel(date);
  const isToday = date === DATES[0];
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex shrink-0 flex-col items-center gap-0.5 rounded-xl px-3 py-2 transition-all active:scale-95',
        active
          ? 'bg-primary text-primary-foreground shadow-sm'
          : 'bg-muted/40 text-muted-foreground hover:bg-muted',
      )}
    >
      <span className="text-[11px] font-medium">{isToday ? '오늘' : day}</span>
      <span className={cn('text-[9px]', active ? 'text-primary-foreground/70' : 'text-muted-foreground/50')}>
        {weekday}
      </span>
    </button>
  );
};

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

const RevealBanner: FC<{ correct: boolean; answer: string }> = ({ correct, answer }) => (
  <div
    className={cn(
      'flex items-center justify-center gap-3 rounded-2xl px-5 py-4 font-bold backdrop-blur-sm',
      correct
        ? 'bg-green-500/15 text-green-500 dark:text-green-400'
        : 'bg-red-500/15 text-red-500 dark:text-red-400',
    )}
    style={{ animation: 'umpire-scale-in 0.3s cubic-bezier(0.34,1.56,0.64,1)' }}
  >
    <span className="text-[22px] font-black tracking-tight">
      {correct ? 'CORRECT!' : 'WRONG'}
    </span>
    <span className="text-[12px] font-semibold opacity-50">
      {answer === 'ball' ? 'BALL' : 'STRIKE'}
    </span>
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

const GradeRing: FC<{ pct: number; color: string }> = ({ pct, color }) => {
  const r = 54;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - pct / 100);
  return (
    <svg width={128} height={128} viewBox="0 0 128 128" className="drop-shadow-lg">
      {/* Track */}
      <circle cx={64} cy={64} r={r} fill="none"
        stroke="currentColor" className="text-muted/15" strokeWidth={8} />
      {/* Progress arc */}
      <circle cx={64} cy={64} r={r} fill="none"
        stroke={color} strokeWidth={8} strokeLinecap="round"
        strokeDasharray={circ} strokeDashoffset={offset}
        transform="rotate(-90 64 64)"
        style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(0.4,0,0.2,1)' }} />
      {/* Inner glow */}
      <circle cx={64} cy={64} r={42} fill={color} opacity={0.04} />
    </svg>
  );
};

const StatBar: FC<{ label: string; correct: number; total: number; color: string; bg: string }> = ({
  label, correct, total, color, bg,
}) => {
  const pct = total > 0 ? (correct / total) * 100 : 0;
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold" style={{ color }}>{label}</span>
        <span className="text-[11px] font-bold tabular-nums" style={{ color }}>
          {correct}/{total}
        </span>
      </div>
      <div className="relative h-2 w-full overflow-hidden rounded-full" style={{ backgroundColor: bg }}>
        <div
          className="h-full rounded-full"
          style={{
            width: `${pct}%`,
            backgroundColor: color,
            transition: 'width 0.8s cubic-bezier(0.4,0,0.2,1) 0.3s',
          }}
        />
      </div>
    </div>
  );
};

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

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col px-5 pb-8 pt-4">
      {/* Grade card */}
      <div
        className="relative flex flex-col items-center rounded-3xl border border-border/40 bg-gradient-to-b from-card to-background px-6 pb-6 pt-8 shadow-sm"
        style={stagger(0.05)}
      >
        {/* Ring + Score */}
        <div className="relative flex items-center justify-center">
          <GradeRing pct={mounted ? pct : 0} color={gradeColor} />
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-[36px] font-black tabular-nums leading-none tracking-tight"
              style={{ color: gradeColor }}>
              {pct}
            </span>
            <span className="mt-0.5 text-[10px] font-medium text-muted-foreground/40">/ 100</span>
          </div>
        </div>

        {/* Grade label */}
        <div className="mt-4 text-center" style={stagger(0.25)}>
          <p className="text-[18px] font-black tracking-widest" style={{ color: gradeColor }}>
            {grade.label}
          </p>
          <p className="mt-0.5 text-[12px] font-medium text-muted-foreground/50">{grade.sub}</p>
        </div>

        {/* Quick stats row */}
        <div className="mt-5 flex w-full items-center justify-center gap-6" style={stagger(0.4)}>
          <div className="flex flex-col items-center">
            <span className="text-[20px] font-black tabular-nums leading-none">{correct}</span>
            <span className="mt-1 text-[9px] font-medium text-muted-foreground/40">정답</span>
          </div>
          <div className="h-6 w-px bg-border/40" />
          <div className="flex flex-col items-center">
            <span className="text-[20px] font-black tabular-nums leading-none">{total - correct}</span>
            <span className="mt-1 text-[9px] font-medium text-muted-foreground/40">오답</span>
          </div>
          <div className="h-6 w-px bg-border/40" />
          <div className="flex flex-col items-center">
            <span className="text-[20px] font-black tabular-nums leading-none">{maxStreak}</span>
            <span className="mt-1 text-[9px] font-medium text-muted-foreground/40">최대 연속</span>
          </div>
        </div>
      </div>

      {/* Detailed breakdown */}
      <div
        className="mt-4 flex flex-col gap-3 rounded-2xl border border-border/30 bg-card/50 px-5 py-4"
        style={stagger(0.55)}
      >
        <StatBar label="BALL" correct={mounted ? ballCorrect : 0} total={balls.length}
          color="#3b82f6" bg="rgba(59,130,246,0.08)" />
        <StatBar label="STRIKE" correct={mounted ? strikeCorrect : 0} total={strikes.length}
          color="#ef4444" bg="rgba(239,68,68,0.08)" />
      </div>

      {/* Extra stats chips */}
      <div className="mt-3 flex gap-2" style={stagger(0.65)}>
        {timeouts > 0 && (
          <div className="flex flex-1 items-center justify-between rounded-xl border border-border/30 bg-card/50 px-3.5 py-2.5">
            <span className="text-[10px] font-medium text-muted-foreground/50">타임아웃</span>
            <span className="text-[12px] font-bold tabular-nums text-amber-500">{timeouts}</span>
          </div>
        )}
        <div className="flex flex-1 items-center justify-between rounded-xl border border-border/30 bg-card/50 px-3.5 py-2.5">
          <span className="text-[10px] font-medium text-muted-foreground/50">판정 투구</span>
          <span className="text-[12px] font-bold tabular-nums">{total}</span>
        </div>
      </div>

      {/* Pitch-by-pitch strip */}
      <div className="mt-4 flex flex-wrap items-center justify-center gap-1" style={stagger(0.75)}>
        {judgments.map((j, i) => (
          <div
            key={i}
            className={cn(
              'flex h-6 w-6 items-center justify-center rounded-md text-[8px] font-bold',
              j.correct
                ? 'bg-green-500/12 text-green-500'
                : j.guess === 'timeout'
                  ? 'bg-amber-500/12 text-amber-500'
                  : 'bg-red-500/12 text-red-500',
            )}
            title={`${i + 1}구: ${j.type} ${j.speed}km/h — ${j.answer === 'ball' ? 'B' : 'S'}`}
          >
            {j.correct ? 'O' : j.guess === 'timeout' ? 'T' : 'X'}
          </div>
        ))}
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Actions */}
      <div className="mt-6 flex flex-col gap-2.5" style={stagger(0.85)}>
        <button
          onClick={onRetry}
          className="flex h-[52px] items-center justify-center gap-2 rounded-2xl bg-primary text-[14px] font-bold text-primary-foreground shadow-sm transition-all hover:bg-primary/90 active:scale-[0.97]"
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
  const [selectedDate, setSelectedDate] = useState(DATES[1] ?? DATES[0]);
  const month = selectedDate.slice(0, 7);
  const { gamesByDate, loading: scheduleLoading } = useMonthSchedule(month);
  const completedGames = useMemo(
    () => (gamesByDate[selectedDate] ?? []).filter(g => g.status === 'completed'),
    [gamesByDate, selectedDate],
  );

  const [selectedGameId, setSelectedGameId] = useState<string | null>(null);
  const [selectedInningKey, setSelectedInningKey] = useState<string>('1T');

  const selectedGame = useMemo(
    () => completedGames.find(g => g.id === selectedGameId) ?? null,
    [completedGames, selectedGameId],
  );

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

  // ── Playing state ──
  const [pitchQueue, setPitchQueue] = useState<QueueItem[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [playState, setPlayState] = useState<PlayState>('intro');
  const [animProgress, setAnimProgress] = useState(0);
  const [timer, setTimer] = useState(JUDGE_TIME);
  const [judgments, setJudgments] = useState<Judgment[]>([]);
  const [lastResult, setLastResult] = useState<{ correct: boolean; answer: string } | null>(null);
  const [shaking, setShaking] = useState(false);

  const animRef = useRef(0);
  const startRef = useRef(0);
  const timerRef = useRef(0);
  const revealRef = useRef<ReturnType<typeof setTimeout>>(undefined);

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

  useEffect(() => {
    setSelectedGameId(null);
    setAllAtBats([]);
  }, [selectedDate]);

  // ── Animation: intro → flying (judgable) ──
  useEffect(() => {
    if (playState !== 'intro') return;
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

    setJudgments(prev => [
      ...prev,
      {
        correct,
        answer: currentItem.answer,
        guess,
        speed: currentItem.pitch.speed,
        type: currentItem.pitch.type,
      },
    ]);

    setLastResult({ correct, answer: currentItem.answer });
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

  // ── Start game ──
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
                <span className="text-[13px] font-bold">스트라이크 콜</span>
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
              <span className="text-[15px] font-bold">스트라이크 콜</span>
            </>
          )}
        </div>
      </header>

      {/* ── Select Phase ── */}
      {phase === 'select' && (
        <div className="mx-auto w-full max-w-md flex-1 px-5 pb-12">
          <div className="mt-6 mb-6 text-center">
            <p className="text-[13px] text-muted-foreground/60 leading-relaxed">
              실제 투구 궤적으로 볼과 스트라이크를 판정하세요
            </p>
          </div>

          <div className="mb-5 flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {DATES.map(d => (
              <DatePill
                key={d}
                date={d}
                active={selectedDate === d}
                onClick={() => setSelectedDate(d)}
              />
            ))}
          </div>

          {scheduleLoading ? (
            <div className="flex h-32 items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground/40" />
            </div>
          ) : completedGames.length === 0 ? (
            <div className="flex h-32 flex-col items-center justify-center gap-1.5 rounded-2xl border bg-card">
              <p className="text-[13px] text-muted-foreground/50">종료된 경기가 없습니다</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {completedGames.map(g => (
                <MiniGameCard
                  key={g.id}
                  game={g}
                  selected={selectedGameId === g.id}
                  onClick={() => setSelectedGameId(prev => prev === g.id ? null : g.id)}
                />
              ))}
            </div>
          )}

          {selectedGameId && (
            <div className="mt-6">
              {relayLoading ? (
                <div className="flex h-20 items-center justify-center gap-2 text-muted-foreground/40">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-[12px]">투구 데이터 불러오는 중...</span>
                </div>
              ) : availableInnings.length === 0 ? (
                <div className="rounded-2xl border bg-card px-4 py-6 text-center">
                  <p className="text-[13px] text-muted-foreground/50">
                    판정 가능한 투구 데이터가 없습니다
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground/30">
                    PTS 궤적 데이터가 포함된 경기를 선택하세요
                  </p>
                </div>
              ) : (
                <>
                  <h3 className="mb-2.5 text-[13px] font-semibold">이닝 선택</h3>
                  <div className="grid grid-cols-4 gap-2">
                    {availableInnings.map(key => {
                      const count = inningPitchCounts.get(key) ?? 0;
                      const active = selectedInningKey === key;
                      return (
                        <button
                          key={key}
                          onClick={() => setSelectedInningKey(key)}
                          className={cn(
                            'flex flex-col items-center rounded-xl py-2.5 transition-all active:scale-95',
                            active
                              ? 'bg-primary text-primary-foreground shadow-sm'
                              : 'bg-muted/40 text-muted-foreground hover:bg-muted',
                          )}
                        >
                          <span className="text-[12px] font-bold">{formatInningLabel(key)}</span>
                          <span
                            className={cn(
                              'text-[9px] tabular-nums',
                              active ? 'text-primary-foreground/70' : 'text-muted-foreground/40',
                            )}
                          >
                            {count}투구
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  <button
                    onClick={startGame}
                    disabled={pitchCount === 0}
                    className={cn(
                      'mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-2xl text-[14px] font-bold shadow-sm transition-all active:scale-[0.97]',
                      pitchCount > 0
                        ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                        : 'bg-muted text-muted-foreground/40',
                    )}
                  >
                    시작하기
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </>
              )}
            </div>
          )}
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
            className="relative shrink-0 overflow-hidden rounded-2xl border border-border/30 bg-muted/10"
            style={shaking ? { animation: 'umpire-shake 0.5s ease-out' } : undefined}
          >
            <UmpireView
              pitches={[currentItem.pitch]}
              currentPitchIndex={0}
              phase={umpirePhase}
              progress={animProgress}
              showZone={playState === 'revealing'}
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
              <RevealBanner correct={lastResult.correct} answer={lastResult.answer} />
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
