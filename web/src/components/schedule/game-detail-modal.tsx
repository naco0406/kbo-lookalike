import type { FC } from 'react';
import { useState, useEffect, useCallback } from 'react';
import { X, Loader2, AlertCircle } from 'lucide-react';
import { Dialog as DialogPrimitive } from 'radix-ui';
import { cn } from '@/lib/utils';
import { TEAM_COLORS } from '@/constants/analysis-messages';
import type { ScheduleGame } from '@/hooks/use-schedule';

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

interface RelayApiResponse {
  textRelayData: RelayData;
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

const PITCH_LABEL: Record<string, string> = {
  B: '볼', S: '헛스윙', T: '스트라이크', F: '파울', H: '타격',
};
const PITCH_COLOR: Record<string, string> = {
  B: 'text-blue-500',
  S: 'text-destructive',
  T: 'text-amber-500 dark:text-amber-400',
  F: 'text-muted-foreground',
  H: 'text-green-600 dark:text-green-400',
};

// ── Tab Bar ───────────────────────────────────────────────────────────────────

const TABS = ['스코어보드', '득점', '박스스코어', '투구 중계'] as const;
type Tab = (typeof TABS)[number];

const TabBar: FC<{ active: Tab; onChange: (t: Tab) => void }> = ({ active, onChange }) => (
  <div className="flex shrink-0 overflow-x-auto border-b border-border/60 scrollbar-none">
    {TABS.map((t) => (
      <button
        key={t}
        onClick={() => onChange(t)}
        className={cn(
          'shrink-0 px-4 py-3 text-[13px] font-medium transition-colors',
          active === t
            ? 'border-b-2 border-primary text-foreground'
            : 'text-muted-foreground hover:text-foreground',
        )}
      >
        {t}
      </button>
    ))}
  </div>
);

// ── Scoreboard Tab ────────────────────────────────────────────────────────────

const ScoreboardTab: FC<{
  game: ScheduleGame;
  inningScore: InningScore | undefined;
  gs: GameState | undefined;
}> = ({ game, inningScore, gs }) => {
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
                {b.todayHra !== undefined ? b.todayHra.toFixed(3) : '-'}
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
                {p.todayEra !== undefined ? p.todayEra.toFixed(2) : '-'}
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

// ── Relay Tab ─────────────────────────────────────────────────────────────────

const RelayTab: FC<{ relays: TextRelay[] }> = ({ relays }) => {
  const inningKeys = Array.from(
    new Set(relays.filter((r) => r.inn !== undefined).map((r) => `${r.inn}-${r.homeOrAway ?? 0}`)),
  ).sort((a, b) => {
    const [ai, at] = a.split('-').map(Number);
    const [bi, bt] = b.split('-').map(Number);
    return ai !== bi ? ai - bi : at - bt;
  });

  const [selected, setSelected] = useState(inningKeys[0] ?? '');

  useEffect(() => {
    if (inningKeys.length > 0 && !inningKeys.includes(selected)) setSelected(inningKeys[0]);
  }, [inningKeys, selected]);

  // Sort ascending by `no` for chronological display (API returns descending)
  const filtered = relays
    .filter((r) => `${r.inn}-${r.homeOrAway ?? 0}` === selected)
    .sort((a, b) => (a.no ?? 0) - (b.no ?? 0));

  const inningLabel = (key: string) => {
    const [inn, tb] = key.split('-').map(Number);
    return `${inn}회${tb === 1 ? '말' : '초'}`;
  };

  if (relays.length === 0) {
    return <div className="flex h-48 items-center justify-center"><p className="text-[13px] text-muted-foreground">중계 데이터가 없습니다</p></div>;
  }

  return (
    <div className="flex h-full flex-col">
      {/* Inning pills */}
      <div className="shrink-0 overflow-x-auto border-b border-border/60 px-4 py-2.5 scrollbar-none">
        <div className="flex gap-1.5">
          {inningKeys.map((key) => (
            <button key={key} onClick={() => setSelected(key)}
              className={cn(
                'shrink-0 rounded-full px-3 py-1 text-[12px] font-medium transition-colors',
                selected === key ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground',
              )}>
              {inningLabel(key)}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 space-y-2.5 overflow-y-auto p-4 md:p-5">
        {filtered.map((relay, ri) => {
          if (relay.titleStyle === '99') return null;
          const opts = relay.textOptions ?? [];
          const pitches = opts.filter((o) => o.type === 1);
          const events = opts.filter((o) => o.type !== 1 && o.type !== 8 && o.text);
          const header = opts.find((o) => o.type === 8);

          return (
            <div key={ri} className="overflow-hidden rounded-2xl border border-border/50 bg-card">
              <div className="border-b border-border/40 bg-muted/20 px-3.5 py-2.5">
                <span className="text-[12px] font-semibold">{header?.text ?? relay.title ?? ''}</span>
              </div>

              {pitches.length > 0 && (
                <div className="divide-y divide-border/30">
                  {pitches.map((p, pi) => (
                    <div key={pi} className="flex items-center gap-3 px-3.5 py-2">
                      <span className="w-4 text-right text-[11px] tabular-nums text-muted-foreground/30">{p.pitchNum ?? pi + 1}</span>
                      <span className={cn('w-16 text-[11px] font-semibold', PITCH_COLOR[p.pitchResult ?? ''] ?? 'text-muted-foreground')}>
                        {PITCH_LABEL[p.pitchResult ?? ''] ?? p.pitchResult ?? '-'}
                      </span>
                      <span className="w-14 text-[11px] text-muted-foreground/70">{p.stuff ?? ''}</span>
                      <span className="text-[11px] tabular-nums text-muted-foreground/60">{p.speed ? `${p.speed}km/h` : ''}</span>
                      {p.text && <span className="flex-1 truncate text-[11px] text-muted-foreground/50">{p.text}</span>}
                    </div>
                  ))}
                </div>
              )}

              {events.map((e, ei) => (
                <div key={`ev-${ei}`} className="border-t border-border/30 bg-muted/10 px-3.5 py-2">
                  <span className="text-[12px] text-muted-foreground">{e.text}</span>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ── Modal Shell ───────────────────────────────────────────────────────────────

interface GameDetailModalProps {
  game: ScheduleGame | null;
  onClose: () => void;
}

export const GameDetailModal: FC<GameDetailModalProps> = ({ game, onClose }) => {
  const [tab, setTab] = useState<Tab>('스코어보드');
  const [data, setData] = useState<RelayData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRelay = useCallback(async (gameId: string) => {
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const resp = await fetch(`/api/relay/${gameId}`);
      if (!resp.ok) throw new Error(`${resp.status}`);
      const json = await resp.json() as RelayApiResponse;
      setData(json.textRelayData);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (game) {
      setTab('스코어보드');
      fetchRelay(game.id);
    }
  }, [game, fetchRelay]);

  const scoringPlays = data?.textRelays ? extractScoringPlays(data.textRelays) : [];

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
            <div className="flex shrink-0 items-center justify-between px-5 py-3">
              <div className="flex items-center gap-2.5">
                <span className="rounded-full px-2.5 py-1 text-[12px] font-bold text-white"
                  style={{ backgroundColor: TEAM_COLORS[game.awayCode]?.primary ?? '#888' }}>
                  {TEAM_COLORS[game.awayCode]?.shortName ?? game.awayCode}
                </span>
                <span className="text-[22px] font-black tabular-nums leading-none">{game.awayScore ?? '-'}</span>
                <span className="text-[13px] font-light text-muted-foreground/25">:</span>
                <span className="text-[22px] font-black tabular-nums leading-none">{game.homeScore ?? '-'}</span>
                <span className="rounded-full px-2.5 py-1 text-[12px] font-bold text-white"
                  style={{ backgroundColor: TEAM_COLORS[game.homeCode]?.primary ?? '#888' }}>
                  {TEAM_COLORS[game.homeCode]?.shortName ?? game.homeCode}
                </span>
              </div>

              <div className="flex items-center gap-2.5">
                <span className="hidden text-[11px] text-muted-foreground/50 sm:block">{game.venue}</span>
                <DialogPrimitive.Close className="flex h-8 w-8 items-center justify-center rounded-full bg-muted/60 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
                  <X className="h-4 w-4" />
                </DialogPrimitive.Close>
              </div>
            </div>
          )}

          {/* Tabs */}
          <TabBar active={tab} onChange={setTab} />

          {/* Body */}
          <div className="min-h-0 flex-1 overflow-y-auto">
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
                {tab === '스코어보드' && <ScoreboardTab game={game} inningScore={data.inningScore} gs={data.currentGameState} />}
                {tab === '득점' && <ScoringTab game={game} plays={scoringPlays} />}
                {tab === '박스스코어' && <BoxScoreTab game={game} data={data} />}
                {tab === '투구 중계' && <RelayTab relays={data.textRelays ?? []} />}
              </>
            )}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
};
