import type { FC } from 'react';
import { useCallback, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { ChevronRight, Loader2, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TEAM_COLORS } from '@/constants/analysis-messages';
import { useSchedule } from '@/hooks/use-schedule';
import type { ScheduleGame } from '@/hooks/use-schedule';
import { GameDetailModal } from '@/components/schedule/game-detail-modal';
import { useProfile } from '@/hooks/use-profile';
import { usePullToRefresh } from '@/hooks/use-pull-to-refresh';
import { useStandings } from '@/hooks/use-standings';
import { PullToRefreshIndicator } from '@/components/pull-to-refresh';
import { AdContainer } from '@/components/ad/ad-container';
import { AD_SLOTS } from '@/components/ad/ad-slots';
import { LeagueSnapshot } from '@/components/standings/standings-widgets';

// ── Game components ──────────────────────────────────────────────────────────

const TeamLogo: FC<{ code: string; size?: 'sm' | 'md' }> = ({ code, size = 'md' }) => {
  const team = TEAM_COLORS[code];
  const dim = size === 'sm' ? 'h-8 w-8 text-[10px]' : 'h-11 w-11 text-[11px]';
  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full font-extrabold text-white',
        dim,
      )}
      style={{ backgroundColor: team?.primary ?? '#555' }}
    >
      {team?.shortName ?? code}
    </div>
  );
};

const GameCard: FC<{
  game: ScheduleGame;
  delay: number;
  isMyTeam?: boolean;
  onClick?: () => void;
}> = ({ game, delay, isMyTeam, onClick }) => {
  const isLive = game.status === 'live';
  const isDone = game.status === 'completed';
  const isClickable = isDone || isLive;
  const hasScore = game.awayScore !== undefined && game.homeScore !== undefined;
  const awayWon = hasScore && Number(game.awayScore) > Number(game.homeScore);
  const homeWon = hasScore && Number(game.homeScore) > Number(game.awayScore);

  const Tag = isClickable ? 'button' : 'div';

  return (
    <Tag
      {...(isClickable ? { onClick, type: 'button' as const } : {})}
      className={cn(
        'animate-reveal-up group relative w-full overflow-hidden rounded-2xl px-5 py-3.5 text-left',
        'bg-card transition-all duration-200',
        isMyTeam && !isLive && 'ring-accent/40 ring-1',
        isClickable && 'cursor-pointer active:scale-[0.98]',
      )}
      style={{ animationDelay: `${delay}ms` }}
    >
      {/* Live accent line */}
      {isLive && (
        <div className="via-destructive/60 pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent to-transparent" />
      )}

      <div className="flex items-center gap-3">
        {/* Away */}
        <div className="flex flex-col items-center gap-1">
          <TeamLogo code={game.awayCode} />
          <span className="text-muted-foreground text-[10px] font-medium">
            {TEAM_COLORS[game.awayCode]?.shortName ?? game.awayCode}
          </span>
        </div>

        {/* Score / Time */}
        <div className="flex flex-1 flex-col items-center">
          {hasScore ? (
            <div className="flex items-baseline gap-3">
              <span
                className={cn(
                  'font-score text-[36px] leading-none',
                  !awayWon && isDone && 'text-muted-foreground',
                )}
              >
                {game.awayScore}
              </span>
              <span className="text-muted-foreground text-[14px] font-light">-</span>
              <span
                className={cn(
                  'font-score text-[36px] leading-none',
                  !homeWon && isDone && 'text-muted-foreground',
                )}
              >
                {game.homeScore}
              </span>
            </div>
          ) : (
            <span className="font-score text-muted-foreground text-[28px] leading-none tracking-wider">
              {game.time}
            </span>
          )}

          <div className="mt-1.5 flex items-center gap-1">
            {isLive ? (
              <>
                <span className="relative flex h-1.5 w-1.5">
                  <span className="bg-destructive absolute inline-flex h-full w-full animate-ping rounded-full opacity-50" />
                  <span className="bg-destructive relative inline-flex h-1.5 w-1.5 rounded-full" />
                </span>
                <span className="text-destructive text-[10px] font-semibold">
                  {game.inning ?? '진행중'}
                </span>
                <span className="text-muted-foreground/40 text-[10px]">·</span>
                <span className="text-muted-foreground text-[10px]">{game.venue}</span>
              </>
            ) : (
              <span className="text-muted-foreground text-[10px]">{game.venue}</span>
            )}
          </div>
        </div>

        {/* Home */}
        <div className="flex flex-col items-center gap-1">
          <TeamLogo code={game.homeCode} />
          <span className="text-muted-foreground text-[10px] font-medium">
            {TEAM_COLORS[game.homeCode]?.shortName ?? game.homeCode}
          </span>
        </div>
      </div>
    </Tag>
  );
};

const GamesSkeleton: FC = () => (
  <div className="flex flex-col gap-2">
    {Array.from({ length: 3 }).map((_, i) => (
      <div key={i} className="bg-muted/50 h-[72px] animate-pulse rounded-2xl" />
    ))}
  </div>
);

const NoGames: FC = () => (
  <div className="bg-card flex flex-col items-center gap-1.5 rounded-2xl py-10 text-center">
    <p className="text-[20px]">⚾️</p>
    <p className="text-muted-foreground text-[13px]">오늘은 경기가 없는 날이에요</p>
    <Link
      to="/schedule"
      className="text-accent hover:text-accent/80 mt-2 text-[12px] font-medium transition-colors"
    >
      전체 일정 보기 →
    </Link>
  </div>
);

// ── Hero cards (Toss-style: vertical, bold, spacious) ───────────────────────

// ── Hero: Primary (full-width) ───────────────────────────────────────────────

const PrimaryHero: FC = () => (
  <Link
    to="/lookalike"
    viewTransition
    className="animate-reveal-up group bg-accent relative block overflow-hidden rounded-3xl transition-all duration-200 active:scale-[0.98]"
  >
    <div className="px-6 pt-6 pb-5">
      <span className="text-[36px] leading-none">⚾</span>
      <p className="text-accent-foreground mt-3 text-[22px] leading-tight font-extrabold tracking-tight">
        혹시 선수세요?
      </p>
      <p className="text-accent-foreground/70 mt-2 text-[14px] leading-relaxed whitespace-pre-line">
        {'사진 한 장이면\n닮은 선수 Top 5를 찾아드려요'}
      </p>
      <div className="bg-accent-foreground/20 text-accent-foreground group-hover:bg-accent-foreground/30 mt-5 inline-flex items-center rounded-full px-5 py-2.5 text-[14px] font-bold transition-colors">
        닮은꼴 찾기
      </div>
    </div>
  </Link>
);

// ── Hero: Secondary (half-width, compact) ────────────────────────────────────

interface SecondaryHero {
  id: string;
  emoji: string;
  title: string;
  sub: string;
  href: string;
}

const SECONDARY_HEROES: SecondaryHero[] = [
  {
    id: 'umpire',
    emoji: '🧤',
    title: '심판 게임',
    sub: '볼인지 스트라이크인지\n당신이 판정해보세요',
    href: '/umpire-game',
  },
  { id: 'mbti', emoji: '🧬', title: '야구 MBTI', sub: '나는 어떤\n야구팬일까?', href: '/mbti' },
];

const SecondaryCard: FC<{ item: SecondaryHero; delay: number }> = ({ item, delay }) => (
  <Link
    to={item.href}
    viewTransition
    className="animate-reveal-up group bg-card block overflow-hidden rounded-2xl transition-all duration-200 active:scale-[0.97]"
    style={{ animationDelay: `${delay}ms` }}
  >
    <div className="px-4 pt-4 pb-4">
      <span className="text-[24px] leading-none">{item.emoji}</span>
      <p className="mt-2 text-[15px] leading-tight font-extrabold tracking-tight">{item.title}</p>
      <p className="text-muted-foreground mt-1 text-[11px] leading-relaxed whitespace-pre-line">
        {item.sub}
      </p>
    </div>
  </Link>
);

// ── More features ────────────────────────────────────────────────────────────

interface MoreItem {
  id: string;
  icon: string;
  title: string;
  sub: string;
  href: string | null;
  available: boolean;
  badge?: string;
}

const MORE_FEATURES: MoreItem[] = [
  {
    id: 'schedule',
    icon: '📋',
    title: '몇 대 몇이야?',
    sub: 'KBO 전체 일정·스코어',
    href: '/schedule',
    available: true,
  },
  {
    id: 'standings',
    icon: '🏆',
    title: '지금 몇 등이야?',
    sub: 'KBO 순위·최근 흐름',
    href: '/standings',
    available: true,
  },
  {
    id: 'fortune',
    icon: '🔮',
    title: '감독님 선발은요?',
    sub: '야구 운세',
    href: null,
    available: false,
    badge: '준비 중',
  },
];

const MoreCard: FC<{ item: MoreItem; delay: number }> = ({ item, delay }) => {
  const inner = (
    <div className="flex items-center gap-3 p-3.5">
      <span className="text-[20px]">{item.icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-[14px] leading-tight font-bold">{item.title}</p>
        <p className="text-muted-foreground mt-0.5 text-[11px]">{item.sub}</p>
      </div>
      {item.available ? (
        <ChevronRight className="text-muted-foreground/50 h-4 w-4 shrink-0" />
      ) : (
        <span className="bg-muted text-muted-foreground shrink-0 rounded-full px-2 py-0.5 text-[10px]">
          {item.badge}
        </span>
      )}
    </div>
  );

  if (item.available && item.href) {
    return (
      <Link
        to={item.href}
        viewTransition
        className="animate-reveal-up bg-card hover:bg-card/80 block rounded-2xl transition-all duration-200 active:scale-[0.98]"
        style={{ animationDelay: `${delay}ms` }}
      >
        {inner}
      </Link>
    );
  }

  return (
    <div
      className="animate-reveal-up bg-card/50 rounded-2xl opacity-45"
      style={{ animationDelay: `${delay}ms` }}
    >
      {inner}
    </div>
  );
};

const FooterLinks: FC = () => (
  <footer className="text-muted-foreground/45 mt-12 flex items-center justify-center gap-2 pb-2 text-[10px]">
    <span>
      made by{' '}
      <a
        href="https://github.com/naco0406"
        target="_blank"
        rel="noreferrer"
        className="hover:text-muted-foreground underline-offset-4 transition-colors hover:underline"
      >
        naco
      </a>
    </span>
    <span aria-hidden="true">·</span>
    <Link
      to="/design-system"
      viewTransition
      className="hover:text-muted-foreground underline-offset-4 transition-colors hover:underline"
    >
      design system
    </Link>
  </footer>
);

// ── Page ─────────────────────────────────────────────────────────────────────

const today = new Date();
const dateLabel = new Intl.DateTimeFormat('ko-KR', {
  month: 'long',
  day: 'numeric',
  weekday: 'short',
}).format(today);

/** 응원팀 경기를 최상단으로 정렬 */
const sortGamesByTeam = (games: ScheduleGame[], teamCode: string | null): ScheduleGame[] => {
  if (!teamCode) return games;
  return [...games].sort((a, b) => {
    const aIsMyTeam = a.awayCode === teamCode || a.homeCode === teamCode;
    const bIsMyTeam = b.awayCode === teamCode || b.homeCode === teamCode;
    if (aIsMyTeam && !bIsMyTeam) return -1;
    if (!aIsMyTeam && bIsMyTeam) return 1;
    return 0;
  });
};

/** 응원팀 경기 여부 체크 */
const isMyTeamGame = (game: ScheduleGame, teamCode: string | null): boolean =>
  !!teamCode && (game.awayCode === teamCode || game.homeCode === teamCode);

export const LandingPage: FC = () => {
  const { games, loading, refresh } = useSchedule();
  const { standings, loading: standingsLoading } = useStandings();
  const { profile } = useProfile();
  const [detailGame, setDetailGame] = useState<ScheduleGame | null>(null);
  const teamCode = profile.favoriteTeam;
  const teamInfo = teamCode ? TEAM_COLORS[teamCode] : null;

  // Pull-to-refresh
  const handleRefresh = useCallback(async () => {
    await refresh();
  }, [refresh]);
  const { phase, pullDistance, progress } = usePullToRefresh({
    onRefresh: handleRefresh,
  });

  const sortedGames = useMemo(() => sortGamesByTeam(games, teamCode), [games, teamCode]);

  // 컨텍스트 라인: 팀 있으면 경기 한 줄, 없으면 null (CTA로 대체)
  const contextMessage = useMemo(() => {
    if (!teamInfo || !teamCode) return null;
    const nickname = profile.nickname || null;
    const myGame = games.find((g) => isMyTeamGame(g, teamCode));
    const prefix = nickname ? `${nickname}님, ` : '';

    if (myGame) {
      const isLive = myGame.status === 'live';
      const isDone = myGame.status === 'completed';
      if (isLive) return `${prefix}${teamInfo.shortName} 경기 진행 중이에요`;
      if (isDone) return `${prefix}오늘 ${teamInfo.shortName} 경기 끝났어요`;
      return `${prefix}오늘 ${teamInfo.shortName} ${myGame.time} 경기 있어요`;
    }
    return `${prefix}오늘은 ${teamInfo.shortName} 쉬는 날이에요`;
  }, [teamInfo, teamCode, profile.nickname, games]);

  return (
    <div className="flex min-h-dvh flex-col">
      {/* ── Header ── */}
      <header className="bg-background/80 sticky top-0 z-50 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-md items-center justify-between px-5">
          <span className="font-score text-[28px] leading-none tracking-widest opacity-80">
            643
          </span>
          <Link
            to="/profile"
            viewTransition
            className="flex h-11 w-11 items-center justify-center rounded-full transition-all active:scale-90"
          >
            {profile.avatarUrl ? (
              <img
                src={profile.avatarUrl}
                alt="프로필"
                className="ring-border h-8 w-8 rounded-full object-cover ring-2"
              />
            ) : (
              <div className="bg-muted flex h-8 w-8 items-center justify-center rounded-full">
                <User className="text-muted-foreground/60 h-4 w-4" />
              </div>
            )}
          </Link>
        </div>
      </header>

      <GameDetailModal game={detailGame} onClose={() => setDetailGame(null)} />

      {/* ── Content ── */}
      <main className="mx-auto w-full max-w-md flex-1 px-5 pb-16">
        {/* ── Pull-to-refresh ── */}
        <PullToRefreshIndicator
          phase={phase}
          pullDistance={pullDistance}
          progress={progress}
          teamCode={teamCode}
        />

        {/* ── Context line ── */}
        <div className="animate-reveal-up mt-4 mb-6">
          {contextMessage && !loading ? (
            <p className="text-muted-foreground text-[15px] font-medium">{contextMessage}</p>
          ) : !teamCode ? (
            <Link
              to="/profile"
              viewTransition
              className="text-accent hover:text-accent/80 inline-flex items-center gap-1 text-[14px] font-semibold transition-colors"
            >
              응원하는 팀을 설정해보세요
              <ChevronRight className="h-4 w-4" />
            </Link>
          ) : null}
        </div>

        {/* ── Hero: 1 + 2 레이아웃 ── */}
        <section className="mb-10 flex flex-col gap-3">
          <PrimaryHero />
          <div className="grid grid-cols-2 gap-3">
            {SECONDARY_HEROES.map((item, i) => (
              <SecondaryCard key={item.id} item={item} delay={(i + 1) * 80} />
            ))}
          </div>
        </section>

        {/* ── Today's Games ── */}
        <section className="mb-10">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-[17px] font-extrabold tracking-tight">오늘의 경기</h2>
              {loading && <Loader2 className="text-muted-foreground h-3 w-3 animate-spin" />}
            </div>
            <Link
              to="/schedule"
              className="bg-muted/60 text-muted-foreground hover:bg-muted flex items-center gap-0.5 rounded-full px-2.5 py-1 text-[11px] font-medium transition-all active:scale-95"
            >
              {dateLabel}
              <ChevronRight className="h-3 w-3" />
            </Link>
          </div>

          {loading ? (
            <GamesSkeleton />
          ) : games.length === 0 ? (
            <NoGames />
          ) : (
            <div className="flex flex-col gap-2">
              {sortedGames.map((game, i) => (
                <GameCard
                  key={game.id}
                  game={game}
                  delay={i * 40}
                  isMyTeam={isMyTeamGame(game, teamCode)}
                  onClick={
                    game.status === 'completed' || game.status === 'live'
                      ? () => setDetailGame(game)
                      : undefined
                  }
                />
              ))}
            </div>
          )}
        </section>

        <LeagueSnapshot
          standings={standings}
          favoriteTeamCode={teamCode}
          loading={standingsLoading}
        />

        {/* ── Ad ── */}
        <AdContainer type={AD_SLOTS.home.type} unitId={AD_SLOTS.home.unitId} />

        {/* ── 더 즐기기 ── */}
        <section className="mt-4">
          <h2 className="mb-4 text-[17px] font-extrabold tracking-tight">더 즐기기</h2>
          <div className="flex flex-col gap-2">
            {MORE_FEATURES.map((f, i) => (
              <MoreCard key={f.id} item={f} delay={i * 50} />
            ))}
          </div>
        </section>

        <FooterLinks />
      </main>
    </div>
  );
};
