import type { FC } from 'react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { ChevronLeft, Loader2 } from 'lucide-react';
import { useProfile } from '@/hooks/use-profile';
import { useStandings } from '@/hooks/use-standings';
import { formatGamesBehind, formatWinRate } from '@/lib/standings';
import { cn } from '@/lib/utils';
import { RecentForm, StandingRow, TeamMark } from '@/components/standings/standings-widgets';

type ViewMode = 'rank' | 'form';

const UpdatedLabel: FC<{ updatedAt: string | null }> = ({ updatedAt }) => {
  if (!updatedAt) return null;

  const label = new Intl.DateTimeFormat('ko-KR', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(updatedAt));

  return <span>{label} 기준</span>;
};

export const StandingsPage: FC = () => {
  const { standings, updatedAt, loading } = useStandings();
  const { profile } = useProfile();
  const [mode, setMode] = useState<ViewMode>('rank');
  const favoriteTeamCode = profile.favoriteTeam;

  const leader = standings[0];
  const favoriteTeam = useMemo(
    () => standings.find((team) => team.teamCode === favoriteTeamCode),
    [standings, favoriteTeamCode],
  );
  const runnerUp = standings[1];

  return (
    <div className="bg-background text-foreground flex min-h-dvh flex-col">
      <header className="bg-background/80 sticky top-0 z-50 backdrop-blur-xl">
        <div className="mx-auto flex h-12 max-w-md items-center justify-between px-5">
          <Link
            to="/"
            viewTransition
            className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-[13px] transition-all active:opacity-60"
          >
            <ChevronLeft className="h-4 w-4" />
            <span>홈</span>
          </Link>
          <span className="absolute left-1/2 -translate-x-1/2 text-sm font-bold tracking-tight opacity-60">
            순위표
          </span>
          <div className="w-10" />
        </div>
      </header>

      <main className="mx-auto w-full max-w-md flex-1 px-5 pb-16">
        <section className="pt-6 pb-7">
          <div className="animate-reveal-up">
            <p className="text-muted-foreground mb-3 text-[11px] font-medium tracking-[0.2em] uppercase">
              KBO League
            </p>
            <h1 className="text-[32px] leading-[1.14] font-extrabold tracking-tight">
              지금 리그는
              <br />
              이렇게 흐르고 있어요
            </h1>
            <p className="text-muted-foreground mt-3 text-[13px]">
              {loading ? (
                <span className="inline-flex items-center gap-1.5">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  순위 불러오는 중
                </span>
              ) : leader ? (
                <>
                  {leader.shortName} 1위
                  {standings[1] &&
                    ` · ${standings[1].shortName} ${standings[1].gamesBehind}경기 차`}
                </>
              ) : (
                '순위 정보를 불러오지 못했어요'
              )}
            </p>
          </div>

          {!loading && leader && (
            <div className="animate-reveal-up bg-card mt-6 overflow-hidden rounded-3xl">
              <div className="bg-foreground text-background relative px-4 pt-4 pb-3">
                <div className="bg-accent/20 pointer-events-none absolute -top-10 -right-8 h-32 w-32 rounded-full" />
                <div className="relative flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-background/55 mb-3 text-[10px] font-bold tracking-[0.18em] uppercase">
                      1위 레이스
                    </p>
                    <div className="flex items-center gap-3">
                      <TeamMark code={leader.teamCode} label={leader.shortName} size="lg" />
                      <div className="min-w-0">
                        <p className="truncate text-[18px] leading-tight font-extrabold">
                          {leader.teamName}
                        </p>
                        <p className="text-background/55 mt-1 text-[11px]">
                          {leader.wins}승 {leader.draws}무 {leader.losses}패
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-[30px] leading-none font-black tabular-nums">
                      {formatWinRate(leader.winRate)}
                    </p>
                    <p className="text-background/50 mt-1 text-[10px] font-medium">승률</p>
                  </div>
                </div>
                {runnerUp && (
                  <div className="bg-background/10 relative mt-4 flex items-center justify-between rounded-2xl px-3 py-2">
                    <span className="text-background/65 text-[11px]">
                      {runnerUp.shortName} {formatGamesBehind(runnerUp.gamesBehind)}경기 차 추격
                    </span>
                    <RecentForm form={leader.recentForm} recent10={leader.recent10} compact />
                  </div>
                )}
              </div>

              {favoriteTeam && (
                <div className="p-3">
                  <div className="bg-accent/[0.06] flex items-center justify-between rounded-2xl px-3 py-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <TeamMark
                        code={favoriteTeam.teamCode}
                        label={favoriteTeam.shortName}
                        size="sm"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="truncate text-[13px] font-bold">
                            {favoriteTeam.shortName}는 {favoriteTeam.rank}위
                          </p>
                          <span className="bg-accent/15 text-accent rounded-full px-1.5 py-px text-[9px] font-bold">
                            MY
                          </span>
                        </div>
                        <p className="text-muted-foreground mt-0.5 text-[10px]">
                          {favoriteTeam.streak} · {formatGamesBehind(favoriteTeam.gamesBehind)}경기
                          차
                        </p>
                      </div>
                    </div>
                    <RecentForm form={favoriteTeam.recentForm} recent10={favoriteTeam.recent10} />
                  </div>
                </div>
              )}
            </div>
          )}
        </section>

        <div className="bg-muted mb-4 grid grid-cols-2 rounded-full p-1">
          {[
            { id: 'rank' as const, label: '순위' },
            { id: 'form' as const, label: '최근 흐름' },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setMode(item.id)}
              className={cn(
                'h-9 rounded-full text-[13px] font-bold transition-all',
                mode === item.id
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground',
              )}
            >
              {item.label}
            </button>
          ))}
        </div>

        <section className="animate-reveal-up">
          <div
            className={cn(
              'text-muted-foreground/60 mb-2 grid gap-2 px-3 text-[10px] font-semibold',
              mode === 'rank' ? 'grid-cols-[22px_1fr_44px_42px]' : 'grid-cols-[22px_1fr_92px]',
            )}
          >
            <span />
            <span>팀</span>
            {mode === 'rank' ? (
              <>
                <span className="text-right">승률</span>
                <span className="text-right">게임차</span>
              </>
            ) : (
              <span className="text-right">최근</span>
            )}
          </div>
          <div className="space-y-1.5">
            {loading ? (
              Array.from({ length: 10 }).map((_, index) => (
                <div key={index} className="bg-muted/60 h-[54px] animate-pulse rounded-2xl" />
              ))
            ) : standings.length === 0 ? (
              <div className="bg-card text-muted-foreground rounded-2xl px-4 py-10 text-center text-[13px]">
                {mode === 'rank'
                  ? '순위 정보를 불러오지 못했어요'
                  : '최근 흐름을 불러오지 못했어요'}
              </div>
            ) : (
              standings.map((team) => (
                <StandingRow
                  key={team.teamCode}
                  team={team}
                  isMyTeam={team.teamCode === favoriteTeamCode}
                  metric={mode === 'rank' ? 'rank' : 'form'}
                />
              ))
            )}
          </div>
        </section>

        <p className="text-muted-foreground/50 mt-5 text-center text-[10px]">
          <UpdatedLabel updatedAt={updatedAt} />
        </p>
      </main>
    </div>
  );
};
