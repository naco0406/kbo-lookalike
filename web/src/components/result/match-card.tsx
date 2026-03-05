import type { FC } from 'react';
import type { MatchResult } from '@/types/player';
import { PlayerImage } from '@/components/result/player-image';
import { cn } from '@/lib/utils';

interface MatchCardProps {
  match: MatchResult;
  rank: number;
}

export const MatchCard: FC<MatchCardProps> = ({ match, rank }) => {
  const { player, similarity } = match;
  const percent = Math.round(similarity * 100);

  return (
    <div
      className={cn(
        'flex items-center gap-3.5 rounded-2xl border p-3 transition-shadow',
        rank === 1 ? 'border-foreground/15 bg-card shadow-sm' : 'border-transparent bg-card/50',
      )}
    >
      {/* Rank + Photo */}
      <div className="relative shrink-0">
        <PlayerImage
          src={player.imageUrl}
          alt={player.name}
          className={cn('rounded-full', rank === 1 ? 'h-14 w-14' : 'h-12 w-12')}
        />
        <span
          className={cn(
            'absolute -top-0.5 -left-0.5 flex items-center justify-center rounded-full text-[10px] font-bold',
            rank === 1
              ? 'bg-foreground text-background h-5 w-5'
              : 'bg-muted-foreground/70 text-background h-4.5 w-4.5',
          )}
        >
          {rank}
        </span>
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <p className={cn('truncate font-semibold', rank === 1 ? 'text-[15px]' : 'text-sm')}>
          {player.name}
        </p>
        <p className="text-muted-foreground mt-0.5 truncate text-xs">
          {player.team} · {player.position}
        </p>
      </div>

      {/* Percentage + bar */}
      <div className="shrink-0 text-right">
        <p
          className={cn(
            'font-bold tabular-nums',
            rank === 1 ? 'text-xl' : 'text-lg text-muted-foreground',
          )}
        >
          {percent}%
        </p>
        <div className="bg-muted mt-1 h-1 w-14 overflow-hidden rounded-full">
          <div
            className={cn(
              'h-full rounded-full animate-width-grow',
              rank === 1 ? 'bg-foreground' : 'bg-muted-foreground/40',
            )}
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>
    </div>
  );
};
