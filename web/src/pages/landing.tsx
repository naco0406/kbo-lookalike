import type { FC, ReactNode } from 'react';
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
      className="mt-2 text-[12px] font-medium text-stadium-blue transition-colors hover:text-stadium-blue/80"
    >
      전체 일정 보기 →
    </Link>
  </div>
);

// ── Feature cards ────────────────────────────────────────────────────────────

interface FeatureItem {
  id: string;
  title: string;
  sub: string;
  cta: string;
  href: string | null;
  available: boolean;
  badge?: string;
  accentVar: string; // Tailwind class referencing CSS var
  icon: ReactNode;
}

const FEATURES: FeatureItem[] = [
  {
    id: 'lookalike',
    title: '혹시 선수세요?',
    sub: 'AI가 닮은 선수를 찾아줘요',
    cta: '사진 올리기',
    href: '/lookalike',
    available: true,
    accentVar: 'stadium-green',
    icon: <span className="text-[24px]">🧑‍🤝‍🧑</span>,
  },
  {
    id: 'umpire',
    title: '공을 네모 안에 넣어',
    sub: '볼/스트라이크 판정 게임',
    cta: '판정하러 가기',
    href: '/umpire-game',
    available: true,
    accentVar: 'stadium-blue',
    icon: <span className="text-[24px]">🧤</span>,
  },
  {
    id: 'schedule',
    title: '몇 대 몇이야?',
    sub: 'KBO 전체 일정·스코어',
    cta: '일정 보기',
    href: '/schedule',
    available: true,
    accentVar: 'stadium-brown',
    icon: <span className="text-[24px]">📋</span>,
  },
  {
    id: 'fortune',
    title: '감독님 선발은요?',
    sub: '야구 운세',
    cta: '',
    href: null,
    available: false,
    badge: '준비 중',
    accentVar: 'muted-foreground',
    icon: <span className="text-[24px]">🔮</span>,
  },
];

const FeatureCard: FC<{ feature: FeatureItem; delay: number }> = ({ feature, delay }) => {
  const inner = (
    <div className="relative flex h-full flex-col justify-between p-4">
      {/* Background accent circle */}
      <div
        className="pointer-events-none absolute -top-6 -right-6 h-24 w-24 rounded-full bg-current opacity-[0.06]"
        style={{ color: `var(--${feature.accentVar})` }}
      />

      <div>
        <div className="mb-2.5">{feature.icon}</div>
        <p className="text-[15px] font-bold leading-tight">{feature.title}</p>
        <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{feature.sub}</p>
      </div>

      <div className="mt-4">
        {feature.available ? (
          <span
            className="text-[11px] font-semibold"
            style={{ color: `var(--${feature.accentVar})` }}
          >
            {feature.cta} →
          </span>
        ) : (
          <span className="inline-block rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
            {feature.badge}
          </span>
        )}
      </div>
    </div>
  );

  if (feature.available && feature.href) {
    return (
      <Link
        to={feature.href}
        viewTransition
        className={cn(
          'animate-reveal-up overflow-hidden rounded-2xl bg-card transition-all duration-200',
          'hover:-translate-y-0.5 hover:bg-card/80 active:scale-[0.97]',
        )}
        style={{ animationDelay: `${delay}ms` }}
      >
        {inner}
      </Link>
    );
  }

  return (
    <div
      className="animate-reveal-up overflow-hidden rounded-2xl bg-card/50 opacity-45"
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

  // 환영 메시지: 응원팀이 있으면 오늘 경기 여부에 따라 메시지 생성
  const welcomeMessage = useMemo(() => {
    if (!teamInfo || !teamCode) return null;
    const nickname = profile.nickname || null;
    const myGame = games.find((g) => isMyTeamGame(g, teamCode));
    const greeting = nickname ? `${nickname}님,` : '';

    if (myGame) {
      const isLive = myGame.status === 'live';
      const isDone = myGame.status === 'completed';
      if (isLive) return `${greeting} ${teamInfo.shortName} 경기 진행 중이에요`.trim();
      if (isDone) return `${greeting} 오늘 ${teamInfo.shortName} 경기 끝났어요`.trim();
      return `${greeting} 오늘 ${teamInfo.shortName} ${myGame.time} 경기 있어요`.trim();
    }
    return `${greeting} 오늘은 ${teamInfo.shortName} 쉬는 날이에요`.trim();
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

        {/* ── Welcome message ── */}
        {welcomeMessage && !loading && (
          <div className="mt-3 mb-1 animate-reveal-up">
            <p className="text-[13px] text-muted-foreground">{welcomeMessage}</p>
          </div>
        )}

        {/* ── Today's Games ── */}
        <section className={cn('mb-10', welcomeMessage && !loading ? 'mt-2' : 'mt-4')}>
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-[15px] font-bold tracking-tight">오늘의 경기</h2>
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

        {/* ── Features ── */}
        <section>
          <h2 className="mb-3 text-[15px] font-bold tracking-tight">더 즐기기</h2>
          <div className="grid grid-cols-2 gap-2.5">
            {FEATURES.map((f, i) => (
              <FeatureCard key={f.id} feature={f} delay={200 + i * 50} />
            ))}
          </div>
        </section>

        {/* ── Ad — 기능 카드 하단, 페이지 최하단 직전 ── */}
        <AdContainer
          type={AD_SLOTS.home.type}
          unitId={AD_SLOTS.home.unitId}
        />
      </main>
    </div>
  );
};
