import type { FC } from 'react';
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { X, Loader2, AlertCircle } from 'lucide-react';
import { Dialog as DialogPrimitive } from 'radix-ui';
import { cn } from '@/lib/utils';
import { TEAM_COLORS } from '@/constants/analysis-messages';
import type { ScheduleGame } from '@/hooks/use-schedule';
import type { RawTextRelay, ParsedAtBat } from '@/components/game/pitch-utils';
import { parseAtBats } from '@/components/game/pitch-utils';
import { AtBatCard } from '@/components/game/at-bat-card';
import { PitchPlayer } from '@/components/game/pitch-player';
import { WinProbabilityChart } from '@/components/game/win-probability-chart';
import { BaseDiamond } from '@/components/game/base-diamond';

// ── API Types ─────────────────────────────────────────────────────────────────

interface InningScore {
  home: Record<string, string>;
  away: Record<string, string>;
}

interface LineupBatter {
  pcode?: string;
  name?: string;
  batOrder?: number;
  posName?: string;
  ab?: number;
  hit?: number;
  rbi?: number;
  run?: number;
  bb?: number;
  so?: number;
  todayHra?: number;
}

interface LineupPitcher {
  pcode?: string;
  name?: string;
  inn?: string;
  hit?: number;
  bb?: number;
  kk?: number;
  run?: number;
  er?: number;
  ballCount?: number;
  todayEra?: number;
}

interface GameState {
  homeScore?: string | number;
  awayScore?: string | number;
  homeHit?: string | number;
  awayHit?: string | number;
  homeBallFour?: string | number;
  awayBallFour?: string | number;
  homeError?: string | number;
  awayError?: string | number;
}

interface TextOption {
  type?: number;
  text?: string;
  pitchResult?: string;
  speed?: string | number;
  stuff?: string;
  pitchNum?: number;
  currentGameState?: {
    homeScore?: string | number;
    awayScore?: string | number;
  };
}

interface TextRelay {
  no?: number;
  title?: string;
  titleStyle?: string;
  inn?: number;
  homeOrAway?: number | string;
  textOptions?: TextOption[];
}

interface RelayData {
  gameId?: string;
  inningScore?: InningScore;
  currentGameState?: GameState;
  homeLineup?: { batter?: LineupBatter[]; pitcher?: LineupPitcher[] };
  awayLineup?: { batter?: LineupBatter[]; pitcher?: LineupPitcher[] };
  textRelays?: TextRelay[];
}

interface LiveState {
  statusCode: string;
  currentInning: string;
  ball: number;
  strike: number;
  out: number;
  bases: [boolean, boolean, boolean];
  relayNo: number;
}

interface RelayApiResponse {
  textRelayData: RelayData;
  live?: LiveState;
}

// ── Scoring Play (득점 이벤트) 추출 ──────────────────────────────────────────

export interface ScoringPlay {
  inn: number;
  isHome: boolean;         // false=초(원정공격), true=말(홈공격)
  scoreBefore: [number, number]; // [away, home]
  scoreAfter: [number, number];
  title: string;           // 타자 이름
  desc: string;            // 득점 상황 텍스트
}

const extractScoringPlays = (relays: TextRelay[]): ScoringPlay[] => {
  // API returns relays in descending `no` order — sort ascending for chronological processing
  const sorted = relays.slice().sort((a, b) => (a.no ?? 0) - (b.no ?? 0));
  const plays: ScoringPlay[] = [];
  let maxAway = 0;
  let maxHome = 0;

  for (const relay of sorted) {
    const inn = relay.inn ?? 0;
    const isHome = String(relay.homeOrAway) === '1';

    for (const opt of relay.textOptions ?? []) {
      const cgs = opt.currentGameState;
      if (!cgs) continue;
      const aws = Number(cgs.awayScore ?? 0);
      const hs = Number(cgs.homeScore ?? 0);

      // 단조 증가만 인정 (노이즈 제거)
      if (aws < maxAway || hs < maxHome) continue;
      if (aws === maxAway && hs === maxHome) continue;

      plays.push({
        inn,
        isHome,
        scoreBefore: [maxAway, maxHome],
        scoreAfter: [aws, hs],
        title: relay.title ?? '',
        desc: opt.text ?? '',
      });

      maxAway = aws;
      maxHome = hs;
    }
  }
  return plays;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const dash = (v: string | number | undefined | null) =>
  v !== undefined && v !== null && v !== '' ? String(v) : '-';


// ── Tab Bar ───────────────────────────────────────────────────────────────────

const TABS = ['스코어보드', '득점', '박스스코어', '투구 중계', '투구 재생'] as const;
type Tab = (typeof TABS)[number];

const TabBar: FC<{ active: Tab; onChange: (t: Tab) => void }> = ({ active, onChange }) => (
  <div className="relative shrink-0 border-b border-border/60">
    <div className="flex overflow-x-auto scrollbar-none">
      {TABS.map((t) => (
        <button
          key={t}
          onClick={() => onChange(t)}
          className={cn(
            'relative shrink-0 px-3.5 py-3 text-[12px] font-medium transition-colors',
            active === t
              ? 'text-foreground'
              : 'text-muted-foreground/60 hover:text-foreground',
          )}
        >
          {t}
          {active === t && (
            <span className="absolute inset-x-1.5 bottom-0 h-[2px] rounded-full bg-primary" />
          )}
        </button>
      ))}
    </div>
    {/* Right fade hint for scrollable tabs */}
    <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-6 bg-gradient-to-l from-background to-transparent md:hidden" />
  </div>
);

// ── Scoreboard Tab ────────────────────────────────────────────────────────────

const ScoreboardTab: FC<{
  game: ScheduleGame;
  inningScore: InningScore | undefined;
  gs: GameState | undefined;
  atBats: ParsedAtBat[];
}> = ({ game, inningScore, gs, atBats }) => {
  const awayTeam = TEAM_COLORS[game.awayCode];
  const homeTeam = TEAM_COLORS[game.homeCode];

  const awayTotal = Number(gs?.awayScore ?? game.awayScore ?? 0);
  const homeTotal = Number(gs?.homeScore ?? game.homeScore ?? 0);
  const awayWon = awayTotal > homeTotal;
  const homeWon = homeTotal > awayTotal;

  const awayMap = inningScore?.away ?? {};
  const homeMap = inningScore?.home ?? {};
  const maxInn = Math.max(9, ...Object.keys(awayMap).map(Number), ...Object.keys(homeMap).map(Number));
  const innings = Array.from({ length: maxInn }, (_, i) => i + 1);

  return (
    <div className="p-5 md:p-8">
      {/* Hero */}
      <div className="mb-8 flex items-center justify-center gap-8">
        <div className="flex flex-col items-center gap-2">
          <div className="flex h-16 w-16 items-center justify-center rounded-full text-[14px] font-bold text-white shadow-sm"
            style={{ backgroundColor: awayTeam?.primary ?? '#888' }}>
            {awayTeam?.shortName ?? game.awayCode}
          </div>
          <span className="text-[11px] text-muted-foreground/60">원정</span>
        </div>

        <div className="flex items-baseline gap-4">
          <span className={cn('text-[56px] font-black tabular-nums leading-none tracking-tight',
            !awayWon && 'text-muted-foreground/20')}>
            {awayTotal}
          </span>
          <span className="pb-1 text-[18px] font-light text-muted-foreground/20">:</span>
          <span className={cn('text-[56px] font-black tabular-nums leading-none tracking-tight',
            !homeWon && 'text-muted-foreground/20')}>
            {homeTotal}
          </span>
        </div>

        <div className="flex flex-col items-center gap-2">
          <div className="flex h-16 w-16 items-center justify-center rounded-full text-[14px] font-bold text-white shadow-sm"
            style={{ backgroundColor: homeTeam?.primary ?? '#888' }}>
            {homeTeam?.shortName ?? game.homeCode}
          </div>
          <span className="text-[11px] text-muted-foreground/60">홈</span>
        </div>
      </div>

      {/* Inning table — sticky team column */}
      <div className="overflow-x-auto rounded-2xl border border-border/60">
        <table className="w-full text-center text-[12px]">
          <thead>
            <tr className="border-b border-border/60 bg-muted/30">
              <th className="sticky left-0 z-10 bg-muted/30 w-14 px-3 py-2.5 text-left text-[11px] font-medium text-muted-foreground/60 border-r border-border/30">팀</th>
              {innings.map((i) => (
                <th key={i} className="min-w-[28px] px-1 py-2.5 text-[11px] font-medium text-muted-foreground/60">{i}</th>
              ))}
              <th className="px-2 py-2.5 text-[12px] font-bold text-foreground border-l border-border/30">R</th>
              <th className="px-2 py-2.5 text-[11px] font-medium text-muted-foreground/60">H</th>
              <th className="px-2 py-2.5 text-[11px] font-medium text-muted-foreground/60">E</th>
              <th className="px-2 py-2.5 text-[11px] font-medium text-muted-foreground/60">B</th>
            </tr>
          </thead>
          <tbody>
            {([
              { label: awayTeam?.shortName ?? game.awayCode, map: awayMap, total: awayTotal, hit: gs?.awayHit, err: gs?.awayError, bb: gs?.awayBallFour, won: awayWon },
              { label: homeTeam?.shortName ?? game.homeCode, map: homeMap, total: homeTotal, hit: gs?.homeHit, err: gs?.homeError, bb: gs?.homeBallFour, won: homeWon },
            ] as const).map((row) => (
              <tr key={row.label} className="border-t border-border/40">
                <td className="sticky left-0 z-10 bg-background px-3 py-3 text-left text-[12px] font-semibold border-r border-border/30">{row.label}</td>
                {innings.map((i) => {
                  const v = row.map[String(i)];
                  const scored = v && v !== '-' && v !== '0';
                  return (
                    <td key={i} className={cn('px-1 py-3 tabular-nums', scored ? 'font-semibold text-foreground' : 'text-muted-foreground/40')}>
                      {v !== undefined ? v : ''}
                    </td>
                  );
                })}
                <td className={cn('px-2 py-3 text-[13px] font-black tabular-nums border-l border-border/30', !row.won && 'text-muted-foreground/25')}>
                  {row.total}
                </td>
                <td className="px-2 py-3 tabular-nums text-muted-foreground/60">{dash(row.hit)}</td>
                <td className="px-2 py-3 tabular-nums text-muted-foreground/60">{dash(row.err)}</td>
                <td className="px-2 py-3 tabular-nums text-muted-foreground/60">{dash(row.bb)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Win Probability Chart */}
      {atBats.some(ab => ab.homeWinRate !== null) && (
        <div className="mt-6">
          <h3 className="mb-2 text-[12px] font-semibold text-muted-foreground/60">승리 확률 그래프</h3>
          <div className="overflow-hidden rounded-2xl border border-border/60 bg-card/50 p-2">
            <WinProbabilityChart
              atBats={atBats}
              homeTeamName={homeTeam?.shortName ?? game.homeCode}
              awayTeamName={awayTeam?.shortName ?? game.awayCode}
              homeColor={homeTeam?.primary ?? '#4ade80'}
              awayColor={awayTeam?.primary ?? '#60a5fa'}
            />
          </div>
        </div>
      )}
    </div>
  );
};

// ── Scoring Plays Tab ─────────────────────────────────────────────────────────

const ScoringTab: FC<{ game: ScheduleGame; plays: ScoringPlay[] }> = ({ game, plays }) => {
  const awayTeam = TEAM_COLORS[game.awayCode];
  const homeTeam = TEAM_COLORS[game.homeCode];

  if (plays.length === 0) {
    return (
      <div className="flex h-48 flex-col items-center justify-center gap-2">
        <p className="text-[13px] text-muted-foreground">득점 데이터가 없습니다</p>
      </div>
    );
  }

  return (
    <div className="p-5 md:p-8">
      <div className="space-y-2.5">
        {plays.map((play, i) => {
          const [prevAway, prevHome] = play.scoreBefore;
          const [curAway, curHome] = play.scoreAfter;
          const scoringTeamIsHome = curHome > prevHome;
          const scoringTeam = scoringTeamIsHome ? homeTeam : awayTeam;
          const scoringCode = scoringTeamIsHome ? game.homeCode : game.awayCode;
          const runsDiff = scoringTeamIsHome ? curHome - prevHome : curAway - prevAway;

          return (
            <div key={i} className="flex items-start gap-3 rounded-2xl border border-border/50 bg-card p-4">
              {/* Inning badge */}
              <div className="mt-0.5 shrink-0 text-center">
                <div className="rounded-lg bg-muted px-2 py-1">
                  <p className="text-[10px] font-medium text-muted-foreground/60">
                    {play.inn}회{play.isHome ? '말' : '초'}
                  </p>
                </div>
              </div>

              {/* Score change */}
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <div className="flex items-center gap-2">
                  {/* Team dot */}
                  <span className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: scoringTeam?.primary ?? '#888' }} />
                  <span className="text-[13px] font-semibold">
                    {scoringTeam?.shortName ?? scoringCode}
                  </span>
                  <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[11px] font-bold text-primary">
                    +{runsDiff}점
                  </span>
                  {/* Running score */}
                  <span className="ml-auto shrink-0 text-[13px] font-black tabular-nums">
                    <span className={cn(curAway >= curHome ? 'text-foreground' : 'text-muted-foreground/30')}>{curAway}</span>
                    <span className="text-muted-foreground/20"> : </span>
                    <span className={cn(curHome >= curAway ? 'text-foreground' : 'text-muted-foreground/30')}>{curHome}</span>
                  </span>
                </div>

                {/* Play description */}
                {play.desc && (
                  <p className="text-[12px] text-muted-foreground leading-snug">{play.desc}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ── Box Score Tab ─────────────────────────────────────────────────────────────

const BatterTable: FC<{ label: string; color: string; batters: LineupBatter[] }> = ({ label, color, batters }) => (
  <div className="mb-6">
    <div className="mb-2.5 flex items-center gap-2">
      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
      <span className="text-[13px] font-semibold">{label}</span>
    </div>
    <div className="overflow-x-auto rounded-2xl border border-border/60">
      <table className="w-full text-[12px]">
        <thead>
          <tr className="border-b border-border/60 bg-muted/30 text-center">
            <th className="sticky left-0 z-10 bg-muted/30 px-3 py-2.5 text-left text-[11px] font-medium text-muted-foreground/60 border-r border-border/30">선수</th>
            {['타수','안타','타점','득점','볼넷','삼진','타율'].map((h) => (
              <th key={h} className="px-2 py-2.5 text-[11px] font-medium text-muted-foreground/60 whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {batters.map((b, i) => (
            <tr key={i} className="border-t border-border/40">
              <td className="sticky left-0 z-10 bg-background px-3 py-2.5 text-left border-r border-border/30">
                <div className="flex items-baseline gap-1">
                  <span className="text-[10px] text-muted-foreground/30 tabular-nums w-3">{b.batOrder ?? ''}</span>
                  <span className="font-medium whitespace-nowrap">{b.name ?? '-'}</span>
                  {b.posName && <span className="text-[10px] text-muted-foreground/40 whitespace-nowrap">{b.posName}</span>}
                </div>
              </td>
              {[b.ab, b.hit, b.rbi, b.run, b.bb, b.so].map((v, vi) => (
                <td key={vi} className="px-2 py-2.5 text-center tabular-nums whitespace-nowrap">{dash(v)}</td>
              ))}
              <td className="px-2 py-2.5 text-center tabular-nums text-muted-foreground/60 whitespace-nowrap">
                {b.todayHra != null ? Number(b.todayHra).toFixed(3) : '-'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

const PitcherTable: FC<{ label: string; color: string; pitchers: LineupPitcher[] }> = ({ label, color, pitchers }) => (
  <div className="mb-6">
    <div className="mb-2.5 flex items-center gap-2">
      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
      <span className="text-[13px] font-semibold">{label} 투수진</span>
    </div>
    <div className="overflow-x-auto rounded-2xl border border-border/60">
      <table className="w-full text-[12px]">
        <thead>
          <tr className="border-b border-border/60 bg-muted/30 text-center">
            <th className="sticky left-0 z-10 bg-muted/30 px-3 py-2.5 text-left text-[11px] font-medium text-muted-foreground/60 border-r border-border/30">선수</th>
            {['이닝','피안타','볼넷','탈삼진','실점','자책','구수','ERA'].map((h) => (
              <th key={h} className="px-2 py-2.5 text-[11px] font-medium text-muted-foreground/60 whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {pitchers.map((p, i) => (
            <tr key={i} className="border-t border-border/40">
              <td className="sticky left-0 z-10 bg-background px-3 py-2.5 text-left font-medium whitespace-nowrap border-r border-border/30">{p.name ?? '-'}</td>
              {[p.inn, p.hit, p.bb, p.kk, p.run, p.er, p.ballCount].map((v, vi) => (
                <td key={vi} className="px-2 py-2.5 text-center tabular-nums whitespace-nowrap">{dash(v)}</td>
              ))}
              <td className="px-2 py-2.5 text-center tabular-nums text-muted-foreground/60 whitespace-nowrap">
                {p.todayEra != null ? Number(p.todayEra).toFixed(2) : '-'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

const BoxScoreTab: FC<{ game: ScheduleGame; data: RelayData }> = ({ game, data }) => {
  const awayColor = TEAM_COLORS[game.awayCode]?.primary ?? '#888';
  const homeColor = TEAM_COLORS[game.homeCode]?.primary ?? '#888';
  const awayName = TEAM_COLORS[game.awayCode]?.shortName ?? game.awayCode;
  const homeName = TEAM_COLORS[game.homeCode]?.shortName ?? game.homeCode;

  return (
    <div className="p-5 md:p-8">
      <BatterTable label={`${awayName} 타선`} color={awayColor} batters={data.awayLineup?.batter ?? []} />
      <BatterTable label={`${homeName} 타선`} color={homeColor} batters={data.homeLineup?.batter ?? []} />
      <PitcherTable label={awayName} color={awayColor} pitchers={data.awayLineup?.pitcher ?? []} />
      <PitcherTable label={homeName} color={homeColor} pitchers={data.homeLineup?.pitcher ?? []} />
    </div>
  );
};

// ── Relay Tab (Enhanced with Strike Zone + AtBat Cards) ──────────────────────

const RelayTab: FC<{ relays: TextRelay[] }> = ({ relays }) => {
  const inningKeys = Array.from(
    new Set(relays.filter((r) => r.inn !== undefined).map((r) => `${r.inn}-${r.homeOrAway ?? 0}`)),
  ).sort((a, b) => {
    const [ai, at] = a.split('-').map(Number);
    const [bi, bt] = b.split('-').map(Number);
    return ai !== bi ? ai - bi : at - bt;
  });

  const inningNums = Array.from(
    new Set(inningKeys.map((k) => Number(k.split('-')[0])))
  ).sort((a, b) => a - b);

  const [selInn, setSelInn] = useState<number>(inningNums[0] ?? 1);
  const [selHalf, setSelHalf] = useState<number>(Number(inningKeys[0]?.split('-')[1] ?? 0));

  useEffect(() => {
    if (inningKeys.length === 0) return;
    setSelInn(Number(inningKeys[0].split('-')[0]));
    setSelHalf(Number(inningKeys[0].split('-')[1]));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [relays]);

  const halvesForInn = inningKeys
    .filter((k) => Number(k.split('-')[0]) === selInn)
    .map((k) => Number(k.split('-')[1]));

  const handleInnChange = (inn: number) => {
    setSelInn(inn);
    const halves = inningKeys
      .filter((k) => Number(k.split('-')[0]) === inn)
      .map((k) => Number(k.split('-')[1]));
    if (halves.length > 0) setSelHalf(halves[0]);
  };

  const selected = `${selInn}-${selHalf}`;

  // 선택된 이닝의 relay를 시간순 정렬 후 AtBat 파싱
  const filtered = relays
    .filter((r) => `${r.inn}-${r.homeOrAway ?? 0}` === selected)
    .sort((a, b) => (a.no ?? 0) - (b.no ?? 0));

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const atBats = useMemo(
    () => parseAtBats(filtered as unknown as RawTextRelay[]),
    [selected, relays],
  );

  // 타석이 아닌 이벤트 (이닝 시작, 선수 교체 등)
  const nonBatEvents = filtered
    .filter(r => !r.textOptions?.some(to => to.type === 8))
    .flatMap(r => (r.textOptions ?? []).filter(to => to.text && [0, 2, 7].includes(to.type ?? -1)));

  if (relays.length === 0) {
    return <div className="flex h-48 items-center justify-center"><p className="text-[13px] text-muted-foreground">중계 데이터가 없습니다</p></div>;
  }

  return (
    <div className="flex h-full flex-col">
      {/* Inning navigation */}
      <div className="shrink-0 border-b border-border/60 bg-background/80 backdrop-blur-sm">
        {/* 이닝 번호 */}
        <div className="flex gap-0.5 overflow-x-auto px-3 pt-2.5 pb-1 scrollbar-none">
          {inningNums.map((inn) => (
            <button
              key={inn}
              onClick={() => handleInnChange(inn)}
              className={cn(
                'flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-[13px] font-semibold transition-all active:scale-95',
                selInn === inn
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              {inn}
            </button>
          ))}
        </div>

        {/* 초/말 선택 */}
        <div className="flex gap-1 px-3 pb-2">
          {halvesForInn.map((h) => (
            <button
              key={h}
              onClick={() => setSelHalf(h)}
              className={cn(
                'rounded-full px-3.5 py-1 text-[12px] font-medium transition-all active:scale-95',
                selHalf === h
                  ? 'bg-foreground/[0.07] text-foreground'
                  : 'text-muted-foreground/60 hover:text-foreground',
              )}
            >
              {h === 1 ? '말' : '초'}
            </button>
          ))}
        </div>
      </div>

      {/* AtBat Cards */}
      <div className="flex-1 space-y-2.5 overflow-y-auto p-3 md:p-4">
        {/* 이닝 시작 이벤트 */}
        {nonBatEvents.filter(e => e.type === 0).map((e, i) => (
          <div key={`start-${i}`} className="py-1 text-center text-[11px] font-medium text-muted-foreground/35">
            {e.text}
          </div>
        ))}

        {atBats.length > 0 ? (
          atBats.map((ab, i) => (
            <AtBatCard key={i} atBat={ab} defaultExpanded={atBats.length <= 3 || i === atBats.length - 1} />
          ))
        ) : (
          /* 타석 데이터 없음 → 텍스트 뷰 fallback */
          filtered.map((relay, ri) => {
            if (relay.titleStyle === '99') return null;
            const opts = relay.textOptions ?? [];
            const events = opts.filter((o) => o.text);
            return (
              <div key={ri} className="overflow-hidden rounded-xl border border-border/50 bg-card">
                {events.map((e, ei) => (
                  <div key={ei} className="border-t border-border/30 px-3.5 py-2 first:border-t-0">
                    <span className="text-[12px] text-muted-foreground">{e.text}</span>
                  </div>
                ))}
              </div>
            );
          })
        )}

        {/* 교체 이벤트 */}
        {nonBatEvents.filter(e => e.type === 2).map((e, i) => (
          <div key={`sub-${i}`} className="flex items-center gap-2 rounded-lg bg-muted/25 px-3 py-1.5">
            <span className="rounded-sm bg-muted/60 px-1.5 py-0.5 text-[9px] font-semibold text-muted-foreground/50">교체</span>
            <span className="text-[11px] text-muted-foreground/60">{e.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// ── Modal Shell ───────────────────────────────────────────────────────────────

interface GameDetailModalProps {
  game: ScheduleGame | null;
  onClose: () => void;
}

const LIVE_POLL_INTERVAL = 30_000;

export const GameDetailModal: FC<GameDetailModalProps> = ({ game, onClose }) => {
  const [tab, setTab] = useState<Tab>('스코어보드');
  const [data, setData] = useState<RelayData | null>(null);
  const [liveState, setLiveState] = useState<LiveState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inningRef = useRef(1);
  const timerRef = useRef<ReturnType<typeof setInterval>>(undefined);

  const isLive = game?.status === 'live';

  const fetchRelay = useCallback(async (gameId: string, live: boolean, showLoader = true) => {
    if (showLoader) {
      setLoading(true);
      setError(null);
      setData(null);
    }
    try {
      const url = live
        ? `/api/relay/live/${gameId}?inning=${inningRef.current}`
        : `/api/relay/${gameId}`;
      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`${resp.status}`);
      const json = await resp.json() as RelayApiResponse;
      setData(json.textRelayData);

      if (json.live) {
        setLiveState(json.live);
        // 이닝 자동 추적
        const match = json.live.currentInning.match(/(\d+)/);
        if (match) {
          const newInn = Number(match[1]);
          if (newInn > inningRef.current) inningRef.current = newInn;
        }
      }
    } catch (e) {
      if (showLoader) setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      if (showLoader) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!game) return;

    setTab('스코어보드');
    setLiveState(null);
    inningRef.current = 1;

    fetchRelay(game.id, game.status === 'live');

    // 라이브 경기: 30초 폴링
    if (game.status === 'live') {
      timerRef.current = setInterval(() => {
        fetchRelay(game.id, true, false);
      }, LIVE_POLL_INTERVAL);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [game, fetchRelay]);

  // 경기 종료 감지 → 폴링 중단
  useEffect(() => {
    if (liveState?.statusCode === 'RESULT' || liveState?.statusCode === 'CANCEL') {
      if (timerRef.current) clearInterval(timerRef.current);
    }
  }, [liveState?.statusCode]);

  const scoringPlays = data?.textRelays ? extractScoringPlays(data.textRelays) : [];

  const allAtBats = useMemo(
    () => data?.textRelays
      ? parseAtBats(
          data.textRelays
            .slice()
            .sort((a, b) => (a.no ?? 0) - (b.no ?? 0)) as unknown as RawTextRelay[],
        )
      : [],
    [data?.textRelays],
  );

  return (
    <DialogPrimitive.Root open={!!game} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogPrimitive.Portal>
        {/* Backdrop */}
        <DialogPrimitive.Overlay className={cn(
          'fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px]',
          'data-[state=open]:animate-in data-[state=open]:fade-in-0',
          'data-[state=closed]:animate-out data-[state=closed]:fade-out-0',
          'duration-300 ease-out',
        )} />

        {/* Sheet / Modal */}
        <DialogPrimitive.Content className={cn(
          'fixed z-50 flex flex-col bg-background shadow-2xl outline-none',
          // ── 모바일: 하단 전체 시트 ──
          'inset-x-0 bottom-0 h-[92dvh] rounded-t-3xl border border-b-0 border-border/60',
          // open: 아래에서 올라옴
          'data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom-full',
          // close: 아래로 완전히 사라짐
          'data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom-full',
          'duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]',
          // ── 데스크톱: 중앙 모달 ──
          'md:inset-auto md:left-1/2 md:top-1/2 md:h-[88dvh] md:w-[min(95vw,900px)]',
          'md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-2xl md:border-border/60',
          'md:data-[state=open]:slide-in-from-bottom-0 md:data-[state=open]:zoom-in-[0.98]',
          'md:data-[state=closed]:slide-out-to-bottom-0 md:data-[state=closed]:zoom-out-[0.98]',
        )}>
          <DialogPrimitive.Title className="sr-only">경기 상세</DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">경기 스코어, 박스스코어, 투구 중계</DialogPrimitive.Description>

          {/* Drag handle (모바일) */}
          <div className="flex shrink-0 justify-center pt-3 pb-1 md:hidden">
            <div className="h-1 w-10 rounded-full bg-border" />
          </div>

          {/* Header */}
          {game && (
            <div className="shrink-0 px-5 py-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="rounded-full px-2.5 py-1 text-[12px] font-bold text-white"
                    style={{ backgroundColor: TEAM_COLORS[game.awayCode]?.primary ?? '#888' }}>
                    {TEAM_COLORS[game.awayCode]?.shortName ?? game.awayCode}
                  </span>
                  <span className="text-[22px] font-black tabular-nums leading-none">
                    {liveState ? Number(data?.currentGameState?.awayScore ?? game.awayScore ?? 0) : (game.awayScore ?? '-')}
                  </span>
                  <span className="text-[13px] font-light text-muted-foreground/25">:</span>
                  <span className="text-[22px] font-black tabular-nums leading-none">
                    {liveState ? Number(data?.currentGameState?.homeScore ?? game.homeScore ?? 0) : (game.homeScore ?? '-')}
                  </span>
                  <span className="rounded-full px-2.5 py-1 text-[12px] font-bold text-white"
                    style={{ backgroundColor: TEAM_COLORS[game.homeCode]?.primary ?? '#888' }}>
                    {TEAM_COLORS[game.homeCode]?.shortName ?? game.homeCode}
                  </span>
                </div>

                <div className="flex items-center gap-2.5">
                  {isLive && liveState && (
                    <div className="flex items-center gap-1">
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-destructive" />
                      <span className="text-[10px] font-bold tracking-wide text-destructive">
                        {liveState.currentInning || 'LIVE'}
                      </span>
                    </div>
                  )}
                  <span className="hidden text-[11px] text-muted-foreground/50 sm:block">{game.venue}</span>
                  <DialogPrimitive.Close className="flex h-8 w-8 items-center justify-center rounded-full bg-muted/60 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
                    <X className="h-4 w-4" />
                  </DialogPrimitive.Close>
                </div>
              </div>

              {/* BSO + 베이스 다이아몬드 (라이브만) */}
              {isLive && liveState && (
                <div className="mt-2 flex justify-center">
                  <BaseDiamond
                    bases={liveState.bases}
                    ball={liveState.ball}
                    strike={liveState.strike}
                    out={liveState.out}
                  />
                </div>
              )}
            </div>
          )}

          {/* Tabs */}
          <TabBar active={tab} onChange={setTab} />

          {/* Body */}
          <div className={cn(
            'min-h-0 flex-1',
            tab === '투구 재생' ? 'flex flex-col overflow-hidden' : 'overflow-y-auto',
          )}>
            {loading && (
              <div className="flex h-48 items-center justify-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-[13px]">불러오는 중...</span>
              </div>
            )}
            {!loading && error && (
              <div className="flex h-48 flex-col items-center justify-center gap-2">
                <AlertCircle className="h-5 w-5 text-muted-foreground/30" />
                <p className="text-[13px] text-muted-foreground">데이터를 불러올 수 없습니다</p>
                <p className="text-[11px] text-muted-foreground/40">{error}</p>
              </div>
            )}
            {!loading && !error && data && game && (
              <>
                {tab === '스코어보드' && <ScoreboardTab game={game} inningScore={data.inningScore} gs={data.currentGameState} atBats={allAtBats} />}
                {tab === '득점' && <ScoringTab game={game} plays={scoringPlays} />}
                {tab === '박스스코어' && <BoxScoreTab game={game} data={data} />}
                {tab === '투구 중계' && <RelayTab relays={data.textRelays ?? []} />}
                {tab === '투구 재생' && <PitchPlayer atBats={allAtBats} />}
              </>
            )}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
};
