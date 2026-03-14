import type { FC } from 'react';
import { useMemo, useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router';
import { CalendarX2, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { TEAM_COLORS } from '@/constants/analysis-messages';
import { useMonthSchedule } from '@/hooks/use-month-schedule';
import type { ScheduleGame } from '@/hooks/use-schedule';
import { GameDetailModal } from '@/components/schedule/game-detail-modal';

// ── Helpers ────────────────────────────────────────────────────────────────────

const pad2 = (n: number) => String(n).padStart(2, '0');
const toMonthStr = (y: number, m: number) => `${y}-${pad2(m + 1)}`;
const toDateStr = (y: number, m: number, d: number) => `${toMonthStr(y, m)}-${pad2(d)}`;
const getTodayStr = (): string => {
  const d = new Date();
  return toDateStr(d.getFullYear(), d.getMonth(), d.getDate());
};

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

// gameId 앞 8자리(YYYYMMDD)에서 날짜 파싱
const parseGameDate = (gameId: string) => {
  if (!/^\d{8}/.test(gameId)) return null;
  const year = parseInt(gameId.slice(0, 4), 10);
  const month = parseInt(gameId.slice(4, 6), 10) - 1; // 0-indexed
  const day = parseInt(gameId.slice(6, 8), 10);
  if (isNaN(year + month + day)) return null;
  return { year, month, day };
};

// ── Team Badge ─────────────────────────────────────────────────────────────────

const TeamBadge: FC<{ code: string }> = ({ code }) => {
  const team = TEAM_COLORS[code];
  return (
    <div
      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white"
      style={{ backgroundColor: team?.primary ?? '#888' }}
    >
      {team?.shortName ?? code}
    </div>
  );
};

// ── Status Badge ───────────────────────────────────────────────────────────────

const StatusBadge: FC<{ game: ScheduleGame }> = ({ game }) => {
  if (game.status === 'live') {
    return (
      <div className="flex items-center gap-1">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-destructive" />
        <span className="text-[10px] font-bold tracking-wide text-destructive">
          {game.inning ?? 'LIVE'}
        </span>
      </div>
    );
  }

  const config: Record<
    Exclude<ScheduleGame['status'], 'live'>,
    { label: string; variant: 'secondary' | 'outline'; extra?: string }
  > = {
    completed: { label: '종료', variant: 'secondary' },
    upcoming: { label: '예정', variant: 'outline' },
    cancelled: {
      label: '취소',
      variant: 'outline',
      extra: 'border-amber-400/50 text-amber-600 dark:text-amber-400',
    },
    suspended: {
      label: '중단',
      variant: 'outline',
      extra: 'border-amber-400/50 text-amber-600 dark:text-amber-400',
    },
  };
  const { label, variant, extra } = config[game.status as Exclude<ScheduleGame['status'], 'live'>];

  return (
    <Badge variant={variant} className={cn('h-[18px] rounded-full px-1.5 text-[10px]', extra)}>
      {label}
    </Badge>
  );
};

// ── Game Card ──────────────────────────────────────────────────────────────────

const GameCard: FC<{ game: ScheduleGame; delay: number; onClick?: () => void }> = ({ game, delay, onClick }) => {
  const isLive = game.status === 'live';
  const isCompleted = game.status === 'completed';
  const hasScore = game.awayScore !== undefined && game.homeScore !== undefined;
  const awayWon = hasScore && game.awayScore! > game.homeScore!;
  const homeWon = hasScore && game.homeScore! > game.awayScore!;
  const awayTeam = TEAM_COLORS[game.awayCode];
  const homeTeam = TEAM_COLORS[game.homeCode];

  const isClickable = isCompleted || isLive;
  const Tag = isClickable ? 'button' : 'div';

  return (
    <Tag
      {...(isClickable ? { onClick, type: 'button' as const } : {})}
      className={cn(
        'animate-reveal-up w-full overflow-hidden rounded-2xl border bg-card text-left',
        isLive && 'border-destructive/20',
        isClickable && 'cursor-pointer transition-colors hover:border-border hover:bg-card/80 active:scale-[0.99]',
      )}
      style={{ animationDelay: `${delay}ms` }}
    >
      {/* Live banner */}
      {isLive && (
        <div className="flex items-center gap-1.5 bg-destructive/5 px-4 py-1.5">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-destructive" />
          <span className="text-[10px] font-bold tracking-widest text-destructive">
            {game.inning ? `${game.inning} 진행중` : 'LIVE'}
          </span>
        </div>
      )}

      {/* Teams + score */}
      <div className="flex items-center gap-1 px-4 pt-4 pb-3">
        {/* Away */}
        <div className="flex flex-1 flex-col items-center gap-2">
          <TeamBadge code={game.awayCode} />
          <span
            className={cn(
              'text-center text-[11px] leading-tight',
              awayWon ? 'font-semibold text-foreground' : 'text-muted-foreground',
            )}
          >
            {awayTeam?.shortName ?? game.awayCode}
          </span>
        </div>

        {/* Center: score or time
            점수: grid-cols-[1fr_auto_1fr] → 콜론이 항상 중앙에 고정.
            단순 flex+gap 방식은 "3:12" vs "13:1" 에서 콜론 위치가 달라지는 문제 발생. */}
        <div className="flex min-w-[96px] flex-col items-center gap-2">
          {hasScore ? (
            <div className="grid w-full grid-cols-[1fr_auto_1fr] items-baseline">
              <span
                className={cn(
                  'text-right text-[30px] font-black tabular-nums leading-none',
                  awayWon ? 'text-foreground' : 'text-muted-foreground/25',
                )}
              >
                {game.awayScore}
              </span>
              <span className="px-1.5 pb-0.5 text-[16px] font-light leading-none text-muted-foreground/20">
                :
              </span>
              <span
                className={cn(
                  'text-left text-[30px] font-black tabular-nums leading-none',
                  homeWon ? 'text-foreground' : 'text-muted-foreground/25',
                )}
              >
                {game.homeScore}
              </span>
            </div>
          ) : (
            <span className="text-[24px] font-black tabular-nums leading-none tracking-tight">
              {game.time}
            </span>
          )}
          <StatusBadge game={game} />
        </div>

        {/* Home */}
        <div className="flex flex-1 flex-col items-center gap-2">
          <TeamBadge code={game.homeCode} />
          <span
            className={cn(
              'text-center text-[11px] leading-tight',
              homeWon ? 'font-semibold text-foreground' : 'text-muted-foreground',
            )}
          >
            {homeTeam?.shortName ?? game.homeCode}
          </span>
        </div>
      </div>

      {/* Metadata */}
      <div className="flex items-center justify-between border-t border-border/50 px-4 py-2">
        <span className="text-[10px] text-muted-foreground/50">{game.venue}</span>
        {game.broadcast && (
          <span className="text-[10px] text-muted-foreground/40">{game.broadcast}</span>
        )}
      </div>

    </Tag>
  );
};

// ── Game Card Skeleton ─────────────────────────────────────────────────────────

const GameCardSkeleton: FC = () => (
  <div className="rounded-2xl border bg-card px-4 pt-4 pb-3">
    <div className="flex items-center gap-1">
      <div className="flex flex-1 flex-col items-center gap-2">
        <div className="h-12 w-12 animate-pulse rounded-full bg-muted" />
        <div className="h-2.5 w-8 animate-pulse rounded bg-muted" />
      </div>
      <div className="flex min-w-[96px] flex-col items-center gap-2">
        <div className="h-8 w-20 animate-pulse rounded bg-muted" />
        <div className="h-[18px] w-10 animate-pulse rounded-full bg-muted" />
      </div>
      <div className="flex flex-1 flex-col items-center gap-2">
        <div className="h-12 w-12 animate-pulse rounded-full bg-muted" />
        <div className="h-2.5 w-8 animate-pulse rounded bg-muted" />
      </div>
    </div>
    <div className="mt-3 flex justify-between border-t border-border/50 pt-2">
      <div className="h-2.5 w-10 animate-pulse rounded bg-muted" />
      <div className="h-2.5 w-20 animate-pulse rounded bg-muted" />
    </div>
  </div>
);

// ── Calendar ───────────────────────────────────────────────────────────────────

interface CalendarProps {
  year: number;
  month: number;
  selectedDate: string;
  gamesByDate: Record<string, ScheduleGame[]>;
  today: string;
  loading: boolean;
  onSelectDate: (date: string) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onGoToToday: () => void;
}

const Calendar: FC<CalendarProps> = ({
  year,
  month,
  selectedDate,
  gamesByDate,
  today,
  loading,
  onSelectDate,
  onPrevMonth,
  onNextMonth,
  onGoToToday,
}) => {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();

  const cells = useMemo<(number | null)[]>(() => {
    const arr: (number | null)[] = Array(firstDay).fill(null);
    for (let d = 1; d <= daysInMonth; d++) arr.push(d);
    while (arr.length % 7 !== 0) arr.push(null);
    return arr;
  }, [firstDay, daysInMonth]);

  const isOnToday = selectedDate === today;

  return (
    <div className="rounded-2xl border bg-card">
      {/* Caption — 단일 행: [<] 왼쪽 절대 / [오늘 chip | >] 오른쪽 절대 / 제목 중앙 고정
          "오늘" 칩은 조건부 렌더링 — absolute 그룹 안이라 레이아웃에 영향 없음 */}
      <div className="relative flex items-center justify-center px-2 py-3.5">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onPrevMonth}
          className="absolute left-2 text-muted-foreground"
          aria-label="이전 달"
        >
          <ChevronLeft className="size-4" />
        </Button>

        {/* 고정 너비: 달 이름 바뀌어도 중앙 위치 흔들리지 않음 */}
        <div className="flex min-w-[9rem] items-center justify-center gap-1.5">
          <span className="text-[15px] font-semibold tracking-tight">
            {year}년 {month + 1}월
          </span>
          {loading && (
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-muted-foreground/30" />
          )}
        </div>

        {/* 오른쪽 그룹: [오늘 chip?] + [>] — 절대 위치라 제목에 영향 없음 */}
        <div className="absolute right-2 flex items-center gap-1">
          {!isOnToday && (
            <button
              onClick={onGoToToday}
              className="rounded-md border border-border/70 px-2 py-0.5 text-[11px] font-medium text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground active:scale-95"
            >
              오늘
            </button>
          )}
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onNextMonth}
            className="text-muted-foreground"
            aria-label="다음 달"
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>

      <div className="border-t border-border/60 px-3 pb-4 pt-3">
        {/* Weekday header */}
        <div className="mb-1 grid grid-cols-7 text-center">
          {WEEKDAYS.map((day, i) => (
            <div
              key={day}
              className={cn(
                'py-1 text-[11px] font-medium',
                i === 0
                  ? 'text-destructive/70'
                  : i === 6
                    ? 'text-blue-500/70'
                    : 'text-muted-foreground/60',
              )}
            >
              {day}
            </div>
          ))}
        </div>

        {/* Day grid
            gap-0.5: 셀 사이 여백 → 선택/hover 상태가 서로 붙지 않음
            min-h: 6주(최대 행 수) 기준 고정 → 달 바뀔 때 높이 변동 없음 */}
        <div className="grid grid-cols-7 gap-0.5" style={{ minHeight: '240px' }}>
          {cells.map((day, i) => {
            if (day === null) return <div key={`e-${i}`} />;

            const dateStr = toDateStr(year, month, day);
            const isSelected = dateStr === selectedDate;
            const isToday = dateStr === today;
            const dotGames = (gamesByDate[dateStr] ?? []).slice(0, 3);
            const col = i % 7;

            return (
              <button
                key={dateStr}
                onClick={() => onSelectDate(dateStr)}
                className={cn(
                  'flex h-10 w-full flex-col items-center justify-center gap-[3px] rounded-xl transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
                  isSelected
                    ? 'bg-primary text-primary-foreground'
                    : isToday
                      ? 'bg-accent text-accent-foreground'
                      : 'hover:bg-accent hover:text-accent-foreground',
                )}
              >
                <span
                  className={cn(
                    'text-[13px] font-medium leading-none',
                    !isSelected && col === 0 && 'text-destructive',
                    !isSelected && col === 6 && 'text-blue-500',
                  )}
                >
                  {day}
                </span>

                {/* 홈팀 팀 컬러 dot — 선택 시 white/45로 전환 */}
                <div className="flex h-[4px] items-center gap-[2px]">
                  {dotGames.map((g) => (
                    <span
                      key={g.id}
                      className="h-[3px] w-[3px] rounded-full"
                      style={{
                        backgroundColor: isSelected
                          ? 'rgba(255,255,255,0.45)'
                          : (TEAM_COLORS[g.homeCode]?.primary ?? '#aaa'),
                      }}
                    />
                  ))}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// ── Games Panel ────────────────────────────────────────────────────────────────

const GamesPanel: FC<{
  date: string;
  games: ScheduleGame[];
  loading: boolean;
  onGameClick: (game: ScheduleGame) => void;
}> = ({ date, games, loading, onGameClick }) => {
  const label = new Intl.DateTimeFormat('ko-KR', {
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  }).format(new Date(`${date}T00:00:00`));

  return (
    <section className="mt-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-[14px] font-semibold">{label}</h2>
        {!loading && games.length > 0 && (
          <span className="text-[12px] text-muted-foreground">{games.length}경기</span>
        )}
      </div>

      {loading ? (
        <div className="flex flex-col gap-2.5">
          {[0, 1, 2].map((i) => (
            <GameCardSkeleton key={i} />
          ))}
        </div>
      ) : games.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border bg-card py-12">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
            <CalendarX2 className="h-5 w-5 text-muted-foreground/50" />
          </div>
          <p className="text-[13px] text-muted-foreground">이 날은 경기가 없습니다</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {games.map((game, i) => (
            <GameCard
              key={game.id}
              game={game}
              delay={i * 40}
              onClick={game.status === 'completed' || game.status === 'live' ? () => onGameClick(game) : undefined}
            />
          ))}
        </div>
      )}
    </section>
  );
};

// ── Page ───────────────────────────────────────────────────────────────────────

export const SchedulePage: FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  // URL에 ?game=이 있으면 해당 날짜로 캘린더 초기화
  const initialFromUrl = useMemo(() => {
    const gameId = searchParams.get('game');
    return gameId ? parseGameDate(gameId) : null;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // 최초 마운트 시 한 번만 계산

  const now = new Date();
  const [year, setYear] = useState(initialFromUrl?.year ?? now.getFullYear());
  const [month, setMonth] = useState(initialFromUrl?.month ?? now.getMonth());
  const [selectedDate, setSelectedDate] = useState(() =>
    initialFromUrl
      ? toDateStr(initialFromUrl.year, initialFromUrl.month, initialFromUrl.day)
      : getTodayStr(),
  );
  const [detailGame, setDetailGame] = useState<ScheduleGame | null>(null);

  const monthStr = toMonthStr(year, month);
  const { gamesByDate, loading } = useMonthSchedule(monthStr);
  const selectedGames = gamesByDate[selectedDate] ?? [];

  // URL ↔ 모달 상태 동기화
  // - searchParams 또는 gamesByDate가 바뀔 때마다 실행
  // - 브라우저 뒤로가기로 ?game= 파라미터가 사라지면 모달 닫힘
  // - ?game=을 포함한 URL로 직접 접근 시 데이터 로드 후 모달 자동 오픈
  useEffect(() => {
    const gameId = searchParams.get('game');

    if (!gameId) {
      setDetailGame((prev) => (prev !== null ? null : prev));
      return;
    }

    setDetailGame((prev) => {
      if (prev?.id === gameId) return prev; // 이미 열려 있음
      for (const games of Object.values(gamesByDate)) {
        const found = games.find((g) => g.id === gameId);
        if (found) return found;
      }
      return prev; // 아직 데이터 로드 전 — 유지
    });
  }, [searchParams, gamesByDate]);

  const handleGameClick = (game: ScheduleGame) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('game', game.id);
      return next;
    });
  };

  const handleClose = () => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete('game');
      return next;
    });
  };

  const goToMonth = (y: number, m: number) => {
    setYear(y);
    setMonth(m);
    setSelectedDate(toDateStr(y, m, 1));
  };

  const goToToday = () => {
    const today = new Date();
    setYear(today.getFullYear());
    setMonth(today.getMonth());
    setSelectedDate(getTodayStr());
  };

  return (
    <div className="flex min-h-dvh flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-background/90 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-md items-center px-5">
          <Link
            to="/"
            className="flex items-center gap-1 text-[13px] text-muted-foreground transition-colors hover:text-foreground"
          >
            <ChevronLeft className="h-4 w-4" />
            <span>홈</span>
          </Link>
          <span className="absolute left-1/2 -translate-x-1/2 text-[15px] font-semibold">
            경기 일정
          </span>
        </div>
      </header>

      <GameDetailModal game={detailGame} onClose={handleClose} />

      {/* Content */}
      <div className="mx-auto w-full max-w-md flex-1 px-5 pb-16">
        <div className="mt-5 animate-reveal-up">
          <Calendar
            year={year}
            month={month}
            selectedDate={selectedDate}
            gamesByDate={gamesByDate}
            today={getTodayStr()}
            loading={loading}
            onSelectDate={setSelectedDate}
            onPrevMonth={() =>
              month === 0 ? goToMonth(year - 1, 11) : goToMonth(year, month - 1)
            }
            onNextMonth={() =>
              month === 11 ? goToMonth(year + 1, 0) : goToMonth(year, month + 1)
            }
            onGoToToday={goToToday}
          />
          <GamesPanel
            date={selectedDate}
            games={selectedGames}
            loading={loading}
            onGameClick={handleGameClick}
          />
        </div>
      </div>
    </div>
  );
};
