import type { FC } from 'react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { ChevronRight, Loader2, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TEAM_COLORS } from '@/constants/analysis-messages';
import { useSchedule } from '@/hooks/use-schedule';
import type { ScheduleGame } from '@/hooks/use-schedule';
import { GameDetailModal } from '@/components/schedule/game-detail-modal';
import { useProfile } from '@/hooks/use-profile';
import { AdContainer } from '@/components/ad/ad-container';
import { AD_SLOTS } from '@/components/ad/ad-slots';

// ── Game components ──────────────────────────────────────────────────────────

const TeamLogo: FC<{ code: string; size?: 'sm' | 'md' }> = ({ code, size = 'md' }) => {
  const team = TEAM_COLORS[code];
  const dim = size === 'sm' ? 'h-8 w-8 text-[10px]' : 'h-11 w-11 text-[11px]';
  return (
    <div
      className={cn('flex shrink-0 items-center justify-center rounded-full font-extrabold text-white', dim)}
      style={{ backgroundColor: team?.primary ?? '#555' }}
    >
      {team?.shortName ?? code}
    </div>
  );
};

const GameCard: FC<{ game: ScheduleGame; delay: number; isMyTeam?: boolean; onClick?: () => void }> = ({ game, delay, isMyTeam, onClick }) => {
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
        isLive && 'ring-1 ring-destructive/25',
        isMyTeam && !isLive && 'ring-1 ring-accent/40',
        isClickable && 'cursor-pointer active:scale-[0.98]',
      )}
      style={{ animationDelay: `${delay}ms` }}
    >
      {/* Live accent line */}
      {isLive && (
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-destructive/60 to-transparent" />
      )}

      <div className="flex items-center gap-3">
        {/* Away */}
        <div className="flex flex-col items-center gap-1">
          <TeamLogo code={game.awayCode} />
          <span className="text-[10px] font-medium text-muted-foreground">
            {TEAM_COLORS[game.awayCode]?.shortName ?? game.awayCode}
          </span>
        </div>

        {/* Score / Time */}
        <div className="flex flex-1 flex-col items-center">
          {hasScore ? (
            <div className="flex items-baseline gap-3">
              <span className={cn(
                'font-score text-[36px] leading-none',
                !awayWon && isDone && 'text-muted-foreground',
              )}>
                {game.awayScore}
              </span>
              <span className="text-[14px] font-light text-muted-foreground">-</span>
              <span className={cn(
                'font-score text-[36px] leading-none',
                !homeWon && isDone && 'text-muted-foreground',
              )}>
                {game.homeScore}
              </span>
            </div>
          ) : (
            <span className="font-score text-[28px] leading-none tracking-wider text-muted-foreground">
              {game.time}
            </span>
          )}

          <div className="mt-1.5 flex items-center gap-1">
            {isLive ? (
              <>
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-destructive opacity-50" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-destructive" />
                </span>
                <span className="text-[10px] font-semibold text-destructive">
                  {game.inning ?? '진행중'}
                </span>
                <span className="text-[10px] text-muted-foreground/40">·</span>
                <span className="text-[10px] text-muted-foreground">{game.venue}</span>
              </>
            ) : (
              <span className="text-[10px] text-muted-foreground">
                {game.venue}
              </span>
            )}
          </div>
        </div>

        {/* Home */}
        <div className="flex flex-col items-center gap-1">
          <TeamLogo code={game.homeCode} />
          <span className="text-[10px] font-medium text-muted-foreground">
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
      <div key={i} className="h-[72px] animate-pulse rounded-2xl bg-muted/50" />
    ))}
  </div>
);

const NoGames: FC = () => (
  <div className="flex flex-col items-center gap-1.5 rounded-2xl bg-card py-10 text-center">
    <p className="text-[20px]">⚾️</p>
    <p className="text-[13px] text-muted-foreground">오늘은 경기가 없는 날이에요</p>
    <Link
      to="/schedule"
      className="mt-2 text-[12px] font-medium text-accent transition-colors hover:text-accent/80"
    >
      전체 일정 보기 →
    </Link>
  </div>
);

// ── Hero cards (Toss-style: vertical, bold, spacious) ───────────────────────

interface HeroItem {
  id: string;
  emoji: string;
  title: string;
  sub: string;
  cta: string;
  href: string;
}

const HEROES: HeroItem[] = [
  {
    id: 'lookalike',
    emoji: '⚾',
    title: '혹시 선수세요?',
    sub: '사진 한 장이면\n닮은 선수 Top 5를 찾아드려요',
    cta: '닮은꼴 찾기',
    href: '/lookalike',
  },
  {
    id: 'umpire',
    emoji: '🧤',
    title: '공을 네모 안에 넣어',
    sub: '볼인지 스트라이크인지\n당신이 판정해보세요',
    cta: '판정하러 가기',
    href: '/umpire-game',
  },
];

const HeroCard: FC<{ hero: HeroItem; delay: number; primary?: boolean }> = ({ hero, delay, primary }) => (
  <Link
    to={hero.href}
    viewTransition
    className={cn(
      'animate-reveal-up group relative block overflow-hidden rounded-3xl transition-all duration-200 active:scale-[0.98]',
      primary ? 'bg-accent' : 'bg-card',
    )}
    style={{ animationDelay: `${delay}ms` }}
  >
    <div className="px-6 pt-6 pb-5">
      <span className="text-[36px] leading-none">{hero.emoji}</span>
      <p className={cn(
        'mt-3 text-[22px] font-extrabold leading-tight tracking-tight',
        primary ? 'text-accent-foreground' : 'text-foreground',
      )}>
        {hero.title}
      </p>
      <p className={cn(
        'mt-2 whitespace-pre-line text-[14px] leading-relaxed',
        primary ? 'text-accent-foreground/70' : 'text-muted-foreground',
      )}>
        {hero.sub}
      </p>
      <div className={cn(
        'mt-5 inline-flex items-center rounded-full px-5 py-2.5 text-[14px] font-bold transition-colors',
        primary
          ? 'bg-accent-foreground/20 text-accent-foreground group-hover:bg-accent-foreground/30'
          : 'bg-accent text-accent-foreground group-hover:bg-accent/90',
      )}>
        {hero.cta}
      </div>
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
        <p className="text-[14px] font-bold leading-tight">{item.title}</p>
        <p className="mt-0.5 text-[11px] text-muted-foreground">{item.sub}</p>
      </div>
      {item.available ? (
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/50" />
      ) : (
        <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
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
        className="animate-reveal-up block rounded-2xl bg-card transition-all duration-200 hover:bg-card/80 active:scale-[0.98]"
        style={{ animationDelay: `${delay}ms` }}
      >
        {inner}
      </Link>
    );
  }

  return (
    <div
      className="animate-reveal-up rounded-2xl bg-card/50 opacity-45"
      style={{ animationDelay: `${delay}ms` }}
    >
      {inner}
    </div>
  );
};

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
  const { games, loading } = useSchedule();
  const { profile } = useProfile();
  const [detailGame, setDetailGame] = useState<ScheduleGame | null>(null);
  const teamCode = profile.favoriteTeam;
  const teamInfo = teamCode ? TEAM_COLORS[teamCode] : null;

  const sortedGames = useMemo(
    () => sortGamesByTeam(games, teamCode),
    [games, teamCode],
  );

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
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-md items-center justify-between px-5">
          <span className="font-score text-[28px] leading-none tracking-widest opacity-80">643</span>
          <Link
            to="/profile"
            viewTransition
            className="flex h-11 w-11 items-center justify-center rounded-full transition-all active:scale-90"
          >
            {profile.avatarUrl ? (
              <img
                src={profile.avatarUrl}
                alt="프로필"
                className="h-8 w-8 rounded-full object-cover ring-2 ring-border"
              />
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                <User className="h-4 w-4 text-muted-foreground/60" />
              </div>
            )}
          </Link>
        </div>
      </header>

      <GameDetailModal game={detailGame} onClose={() => setDetailGame(null)} />

      {/* ── Content ── */}
      <main className="mx-auto w-full max-w-md flex-1 px-5 pb-16">

        {/* ── Context line ── */}
        <div className="mt-4 mb-6 animate-reveal-up">
          {contextMessage && !loading ? (
            <p className="text-[15px] font-medium text-muted-foreground">{contextMessage}</p>
          ) : !teamCode ? (
            <Link
              to="/profile"
              viewTransition
              className="inline-flex items-center gap-1 text-[14px] font-semibold text-accent transition-colors hover:text-accent/80"
            >
              응원하는 팀을 설정해보세요
              <ChevronRight className="h-4 w-4" />
            </Link>
          ) : null}
        </div>

        {/* ── Hero: 메인 콘텐츠 ── */}
        <section className="mb-10 flex flex-col gap-3">
          {HEROES.map((hero, i) => (
            <HeroCard key={hero.id} hero={hero} delay={i * 80} primary={i === 0} />
          ))}
        </section>

        {/* ── Today's Games ── */}
        <section className="mb-10">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-[17px] font-extrabold tracking-tight">오늘의 경기</h2>
              {loading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
            </div>
            <Link
              to="/schedule"
              className="flex items-center gap-0.5 rounded-full bg-muted/60 px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition-all hover:bg-muted active:scale-95"
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
                    (game.status === 'completed' || game.status === 'live')
                      ? () => setDetailGame(game)
                      : undefined
                  }
                />
              ))}
            </div>
          )}
        </section>

        {/* ── Ad ── */}
        <AdContainer
          type={AD_SLOTS.home.type}
          unitId={AD_SLOTS.home.unitId}
        />

        {/* ── 더 즐기기 ── */}
        <section className="mt-4">
          <h2 className="mb-4 text-[17px] font-extrabold tracking-tight">더 즐기기</h2>
          <div className="flex flex-col gap-2">
            {MORE_FEATURES.map((f, i) => (
              <MoreCard key={f.id} item={f} delay={i * 50} />
            ))}
          </div>
        </section>
      </main>
    </div>
  );
};
