import type { FC } from 'react';
import { Link } from 'react-router';
import { ChevronRight, TrendingUp } from 'lucide-react';
import { TEAM_COLORS } from '@/constants/analysis-messages';
import { formatGamesBehind, formatWinRate } from '@/lib/standings';
import { cn } from '@/lib/utils';
import type { RecentGameResult, TeamStanding } from '@/types/standings';

const resultConfig: Record<RecentGameResult, { label: string; className: string; aria: string }> = {
  W: {
    label: 'W',
    aria: '승',
    className: 'bg-accent text-accent-foreground',
  },
  L: {
    label: 'L',
    aria: '패',
    className: 'bg-muted text-muted-foreground',
  },
  D: {
    label: 'D',
    aria: '무',
    className: 'border bg-background text-muted-foreground',
  },
};

const formatRecent10 = (value: string): string => value.replace(/(\d+)(승|무|패)/g, '$1$2 ').trim();

export const RecentForm: FC<{ form?: RecentGameResult[]; recent10: string; compact?: boolean }> = ({
  form,
  recent10,
  compact,
}) => {
  if (form && form.length > 0) {
    return (
      <div className="flex items-center gap-1" aria-label={`최근 ${form.length}경기`}>
        {form.slice(0, 5).map((result, index) => {
          const config = resultConfig[result];
          return (
            <span
              key={`${result}-${index}`}
              aria-label={config.aria}
              className={cn(
                'flex items-center justify-center rounded-full text-[9px] leading-none font-black',
                compact ? 'h-4.5 w-4.5' : 'h-5 w-5',
                config.className,
              )}
            >
              {config.label}
            </span>
          );
        })}
      </div>
    );
  }

  return (
    <span className="text-muted-foreground text-[10px] font-semibold whitespace-nowrap">
      최근10 {formatRecent10(recent10)}
    </span>
  );
};

export const TeamMark: FC<{ code: string; label: string; size?: 'sm' | 'md' | 'lg' }> = ({
  code,
  label,
  size = 'md',
}) => {
  const team = TEAM_COLORS[code];

  return (
    <span
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full font-black text-white',
        size === 'sm' && 'h-7 w-7 text-[9px]',
        size === 'md' && 'h-9 w-9 text-[10px]',
        size === 'lg' && 'h-12 w-12 text-[11px]',
      )}
      style={{ backgroundColor: team?.primary ?? '#777' }}
    >
      {label}
    </span>
  );
};

export const StandingRow: FC<{
  team: TeamStanding;
  isMyTeam?: boolean;
  density?: 'compact' | 'full';
  metric?: 'rank' | 'form';
}> = ({ team, isMyTeam, density = 'full', metric = 'rank' }) => (
  <div
    className={cn(
      'relative grid min-h-[54px] items-center rounded-2xl px-3 py-2.5',
      metric === 'rank'
        ? 'grid-cols-[22px_1fr_44px_42px] gap-2'
        : 'grid-cols-[22px_1fr_92px] gap-2',
      isMyTeam ? 'bg-accent/[0.06]' : 'bg-card',
    )}
  >
    <span className="text-muted-foreground text-center text-[12px] font-black tabular-nums">
      {team.rank}
    </span>
    <div className="flex min-w-0 items-center gap-2">
      <TeamMark code={team.teamCode} label={team.shortName} size="sm" />
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="truncate text-[13px] font-bold">{team.shortName}</p>
          {isMyTeam && (
            <span className="bg-accent/15 text-accent rounded-full px-1.5 py-px text-[9px] font-bold">
              MY
            </span>
          )}
        </div>
        {density === 'full' && (
          <p className="text-muted-foreground mt-0.5 text-[10px]">
            {team.wins}승 {team.draws}무 {team.losses}패
          </p>
        )}
      </div>
    </div>
    {metric === 'rank' ? (
      <>
        <span className="text-right text-[12px] font-bold tabular-nums">
          {formatWinRate(team.winRate)}
        </span>
        <span className="text-muted-foreground text-right text-[12px] font-medium tabular-nums">
          {formatGamesBehind(team.gamesBehind)}
        </span>
      </>
    ) : (
      <div className="justify-self-end">
        <RecentForm
          form={team.recentForm}
          recent10={team.recent10}
          compact={density === 'compact'}
        />
      </div>
    )}
  </div>
);

export const LeagueSnapshot: FC<{
  standings: TeamStanding[];
  favoriteTeamCode?: string | null;
  loading?: boolean;
}> = ({ standings, favoriteTeamCode, loading }) => {
  const leader = standings[0];
  const chaser = standings[1];
  const favoriteTeam = favoriteTeamCode
    ? standings.find((team) => team.teamCode === favoriteTeamCode)
    : undefined;
  const gapTarget = favoriteTeam ?? chaser;

  return (
    <section className="mb-10">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-[17px] font-extrabold tracking-tight">리그 현황</h2>
          <p className="text-muted-foreground mt-0.5 text-[11px]">순위와 최근 흐름</p>
        </div>
        <Link
          to="/standings"
          viewTransition
          className="bg-muted/60 text-muted-foreground hover:bg-muted flex items-center gap-0.5 rounded-full px-2.5 py-1 text-[11px] font-medium transition-all active:scale-95"
        >
          전체 보기
          <ChevronRight className="h-3 w-3" />
        </Link>
      </div>

      <div className="bg-card overflow-hidden rounded-3xl">
        {loading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 10 }).map((_, index) => (
              <div key={index} className="bg-muted/60 h-[54px] animate-pulse rounded-2xl" />
            ))}
          </div>
        ) : standings.length === 0 || !leader ? (
          <div className="text-muted-foreground px-4 py-10 text-center text-[12px]">
            순위 정보를 불러오지 못했어요
          </div>
        ) : (
          <>
            <div className="bg-foreground text-background relative overflow-hidden px-4 py-3">
              <div className="bg-accent/25 pointer-events-none absolute -top-10 -right-8 h-28 w-28 rounded-full" />
              <div className="relative flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  <TrendingUp className="text-accent h-4 w-4 shrink-0" />
                  <span className="truncate text-[12px] font-bold">
                    {leader.shortName} 1위
                    {gapTarget &&
                      ` · ${gapTarget.shortName} ${formatGamesBehind(gapTarget.gamesBehind)}경기 차`}
                  </span>
                </div>
                <span className="shrink-0 text-[12px] font-black tabular-nums">
                  {formatWinRate(leader.winRate)}
                </span>
              </div>
            </div>

            <div className="space-y-1 p-2">
              {standings.map((team) => (
                <StandingRow
                  key={team.teamCode}
                  team={team}
                  density="compact"
                  isMyTeam={team.teamCode === favoriteTeamCode}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
};
