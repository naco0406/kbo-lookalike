import type { FC } from 'react';
import { useState } from 'react';
import { Link } from 'react-router';
import { CalendarDays, ChevronRight, Eye, Loader2, ScanFace, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TEAM_COLORS } from '@/constants/analysis-messages';
import { useSchedule } from '@/hooks/use-schedule';
import type { ScheduleGame } from '@/hooks/use-schedule';
import { GameDetailModal } from '@/components/schedule/game-detail-modal';

// ── Types ────────────────────────────────────────────────────────────────────

interface Feature {
  id: string;
  icon: FC<{ className?: string }>;
  title: string;
  description: string;
  href: string | null;
  available: boolean;
  badge?: string;
  fullWidth?: boolean;
}

// ── Data ─────────────────────────────────────────────────────────────────────

const FEATURES: Feature[] = [
  {
    id: 'lookalike',
    icon: ScanFace,
    title: '닮은꼴 찾기',
    description: 'AI로 나와 가장 닮은 KBO 선수를 찾아보세요',
    href: '/lookalike',
    available: true,
  },
  {
    id: 'umpire-game',
    icon: Eye,
    title: '스트라이크 콜',
    description: '심판이 되어 실제 투구를 판정해보세요',
    href: '/umpire-game',
    available: true,
  },
  {
    id: 'schedule',
    icon: CalendarDays,
    title: '경기 일정',
    description: '월별 캘린더로 KBO 전체 일정을 확인하세요',
    href: '/schedule',
    available: true,
  },
  {
    id: 'fortune',
    icon: Sparkles,
    title: '야구 운세',
    description: '오늘 나의 야구 기운과 경기 운세',
    href: null,
    available: false,
    badge: '출시 예정',
  },
];

const STATUS_LABEL: Record<ScheduleGame['status'], string> = {
  upcoming: '예정',
  live: '진행중',
  completed: '종료',
  cancelled: '취소',
  suspended: '중단',
};

// ── Sub-components ────────────────────────────────────────────────────────────

const TeamBadge: FC<{ code: string }> = ({ code }) => {
  const team = TEAM_COLORS[code];
  return (
    <div
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white"
      style={{ backgroundColor: team?.primary ?? '#888' }}
    >
      {team?.shortName ?? code}
    </div>
  );
};

const GameCard: FC<{ game: ScheduleGame; delay: number; onClick?: () => void }> = ({ game, delay, onClick }) => {
  const isLive = game.status === 'live';
  const isClickable = game.status === 'completed' || game.status === 'live';
  const hasScore = game.awayScore !== undefined && game.homeScore !== undefined;
  const awayWon = hasScore && Number(game.awayScore) > Number(game.homeScore);
  const homeWon = hasScore && Number(game.homeScore) > Number(game.awayScore);

  const Tag = isClickable ? 'button' : 'div';

  return (
    <Tag
      {...(isClickable ? { onClick, type: 'button' as const } : {})}
      className={cn(
        'animate-reveal-up w-full rounded-2xl border bg-card px-4 py-3 text-left',
        isLive && 'border-destructive/20',
        isClickable && 'cursor-pointer transition-colors hover:border-border hover:bg-card/80 active:scale-[0.99]',
      )}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-center gap-2">
        <TeamBadge code={game.awayCode} />

        <div className="flex flex-1 flex-col items-center">
          {hasScore ? (
            <div className="grid w-full max-w-[120px] grid-cols-[1fr_auto_1fr] items-baseline">
              <span className={cn(
                'text-right text-[22px] font-extrabold tabular-nums leading-none',
                hasScore && !awayWon && 'text-muted-foreground/25',
              )}>
                {game.awayScore}
              </span>
              <span className="px-1.5 text-muted-foreground/30 font-light">:</span>
              <span className={cn(
                'text-left text-[22px] font-extrabold tabular-nums leading-none',
                hasScore && !homeWon && 'text-muted-foreground/25',
              )}>
                {game.homeScore}
              </span>
            </div>
          ) : (
            <span className="text-[18px] font-extrabold tabular-nums leading-none tracking-tight">
              {game.time}
            </span>
          )}
          <div className="mt-1 flex items-center gap-1">
            {isLive && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" />}
            <span
              className={cn(
                'text-[10px]',
                isLive ? 'font-semibold text-red-500' : 'text-muted-foreground/60',
              )}
            >
              {game.venue} · {STATUS_LABEL[game.status]}
            </span>
          </div>
        </div>

        <TeamBadge code={game.homeCode} />
      </div>
    </Tag>
  );
};

const FeatureCard: FC<{ feature: Feature; delay: number }> = ({ feature, delay }) => {
  const colSpan = feature.fullWidth ? 'col-span-2' : '';

  const inner = (
    <>
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-foreground/[0.06]">
        <feature.icon className="h-5 w-5" />
      </div>
      <p className="text-[14px] font-semibold leading-snug">{feature.title}</p>
      <p className="text-muted-foreground mt-1 text-[12px] leading-relaxed">
        {feature.description}
      </p>
      {feature.available ? (
        <div className="mt-3 flex items-center gap-0.5 text-[12px] font-medium">
          <span>시작하기</span>
          <ChevronRight className="h-3.5 w-3.5" />
        </div>
      ) : (
        feature.badge && (
          <div className="mt-3">
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
              {feature.badge}
            </span>
          </div>
        )
      )}
    </>
  );

  if (feature.available && feature.href) {
    return (
      <Link
        to={feature.href}
        className={cn('animate-reveal-up rounded-2xl border bg-card p-4 transition-transform active:scale-[0.97]', colSpan)}
        style={{ animationDelay: `${delay}ms` }}
      >
        {inner}
      </Link>
    );
  }

  return (
    <div
      className={cn('animate-reveal-up rounded-2xl border bg-card p-4 opacity-50', colSpan)}
      style={{ animationDelay: `${delay}ms` }}
    >
      {inner}
    </div>
  );
};

const GamesSkeleton: FC = () => (
  <div className="flex flex-col gap-2">
    {Array.from({ length: 3 }).map((_, i) => (
      <div key={i} className="h-[62px] animate-pulse rounded-2xl border bg-muted/30" />
    ))}
  </div>
);

const NoGames: FC = () => (
  <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border bg-card py-10 text-center">
    <CalendarDays className="h-5 w-5 text-muted-foreground/25" />
    <p className="text-muted-foreground text-[13px]">오늘은 경기가 없습니다</p>
    <Link
      to="/schedule"
      className="mt-1 text-[11px] font-medium text-primary hover:underline"
    >
      전체 일정 보기
    </Link>
  </div>
);

// ── Page ──────────────────────────────────────────────────────────────────────

const today = new Date();
const dateLabel = new Intl.DateTimeFormat('ko-KR', {
  month: 'long',
  day: 'numeric',
  weekday: 'short',
}).format(today);

export const LandingPage: FC = () => {
  const { games, loading } = useSchedule();
  const [detailGame, setDetailGame] = useState<ScheduleGame | null>(null);

  return (
    <div className="flex min-h-dvh flex-col">
      {/* ── Header ── */}
      <header className="sticky top-0 z-50 border-b bg-background/90 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-md items-center justify-between px-5">
          <div className="flex items-baseline gap-1.5">
            <span className="text-[20px] font-extrabold tracking-tighter">KBO</span>
            <span className="text-muted-foreground text-[13px] font-medium">프로야구</span>
          </div>
          <span className="text-muted-foreground/50 text-[11px]">kbo.naco.kr</span>
        </div>
      </header>

      <GameDetailModal game={detailGame} onClose={() => setDetailGame(null)} />

      {/* ── Content ── */}
      <div className="mx-auto w-full max-w-md flex-1 px-5 pb-12">
        {/* Today's schedule */}
        <section className="mt-6 mb-8 animate-reveal-up">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[15px] font-bold">
              오늘의 경기
              {loading && <Loader2 className="ml-1.5 inline-block h-3.5 w-3.5 animate-spin text-muted-foreground" />}
            </h2>
            <Link
              to="/schedule"
              className="flex items-center gap-0.5 text-[12px] text-muted-foreground transition-colors hover:text-foreground"
            >
              <span>{dateLabel}</span>
              <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
          {loading ? (
            <GamesSkeleton />
          ) : games.length === 0 ? (
            <NoGames />
          ) : (
            <div className="flex flex-col gap-2">
              {games.map((game, i) => (
                <GameCard
                  key={game.id}
                  game={game}
                  delay={i * 50}
                  onClick={(game.status === 'completed' || game.status === 'live') ? () => setDetailGame(game) : undefined}
                />
              ))}
            </div>
          )}
        </section>

        {/* Features */}
        <section>
          <div className="mb-3">
            <h2 className="text-[15px] font-bold">지금 해보기</h2>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {FEATURES.map((feature, i) => (
              <FeatureCard key={feature.id} feature={feature} delay={300 + i * 60} />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};
