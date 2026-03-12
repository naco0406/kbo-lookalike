import type { FC } from 'react';
import { Link } from 'react-router';
import { ChevronRight, Loader2, ScanFace, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TEAM_COLORS } from '@/constants/analysis-messages';
import { useSchedule } from '@/hooks/use-schedule';
import type { ScheduleGame } from '@/hooks/use-schedule';

// ── Types ────────────────────────────────────────────────────────────────────

interface Feature {
  id: string;
  icon: FC<{ className?: string }>;
  title: string;
  description: string;
  href: string | null;
  available: boolean;
  badge?: string;
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

const GameCard: FC<{ game: ScheduleGame; delay: number }> = ({ game, delay }) => {
  const isLive = game.status === 'live';
  const hasScore = game.awayScore !== undefined && game.homeScore !== undefined;

  return (
    <div
      className="animate-reveal-up rounded-2xl border bg-card px-4 py-3"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-center gap-2">
        <TeamBadge code={game.awayCode} />

        <div className="flex flex-1 flex-col items-center">
          {hasScore ? (
            <div className="flex items-center gap-3">
              <span className="text-[22px] font-extrabold tabular-nums leading-none">
                {game.awayScore}
              </span>
              <span className="text-muted-foreground/40 font-light">:</span>
              <span className="text-[22px] font-extrabold tabular-nums leading-none">
                {game.homeScore}
              </span>
            </div>
          ) : (
            <span className="text-[18px] font-extrabold tabular-nums leading-none tracking-tight">
              {game.time}
            </span>
          )}
          <div className="mt-0.5 flex items-center gap-1">
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
    </div>
  );
};

const FeatureCard: FC<{ feature: Feature; delay: number }> = ({ feature, delay }) => {
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
        className="animate-reveal-up rounded-2xl border bg-card p-4 transition-transform active:scale-[0.97]"
        style={{ animationDelay: `${delay}ms` }}
      >
        {inner}
      </Link>
    );
  }

  return (
    <div
      className="animate-reveal-up rounded-2xl border bg-card p-4 opacity-50"
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
  <div className="flex flex-col items-center justify-center rounded-2xl border bg-card py-8 text-center">
    <p className="text-muted-foreground text-[13px]">오늘은 경기가 없습니다</p>
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

  return (
    <div className="flex min-h-dvh flex-col">
      {/* ── Header ── */}
      <header className="sticky top-0 z-50 border-b bg-background/90 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-md items-center px-5">
          <span className="text-[20px] font-extrabold tracking-tighter">KBO</span>
          <span className="text-muted-foreground ml-1.5 text-[13px] font-medium">프로야구</span>
        </div>
      </header>

      {/* ── Content ── */}
      <div className="mx-auto w-full max-w-md flex-1 px-5 pb-12">
        {/* Today's schedule */}
        <section className="mt-6 mb-8 animate-reveal-up">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[15px] font-bold">
              오늘의 경기
              {loading && <Loader2 className="ml-1.5 inline-block h-3.5 w-3.5 animate-spin text-muted-foreground" />}
            </h2>
            <span className="text-muted-foreground text-[12px]">{dateLabel}</span>
          </div>
          {loading ? (
            <GamesSkeleton />
          ) : games.length === 0 ? (
            <NoGames />
          ) : (
            <div className="flex flex-col gap-2">
              {games.map((game, i) => (
                <GameCard key={game.id} game={game} delay={i * 50} />
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
