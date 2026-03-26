import type { FC } from 'react';
import type { MatchResult } from '@/types/player';
import { PlayerImage } from '@/components/result/player-image';
import { getTeamDisplayName } from '@/constants/analysis-messages';
import { cn } from '@/lib/utils';

interface MatchCardProps {
  match: MatchResult;
  rank: number;
  onImageClick?: () => void;
}

export const MatchCard: FC<MatchCardProps> = ({ match, rank, onImageClick }) => {
  const { player, similarity } = match;
  const percent = (Math.round(similarity * 1000) / 10).toFixed(1);

  return (
    <button
      type="button"
      onClick={onImageClick}
      className={cn(
        'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors active:bg-muted/30',
        rank === 1 && 'bg-card shadow-sm ring-1 ring-border',
      )}
    >
      {/* Rank + Photo */}
      <div className="relative shrink-0">
        <PlayerImage
          src={player.imageUrl}
          alt={player.name}
          className={cn('rounded-xl', rank === 1 ? 'h-12 w-12' : 'h-10 w-10')}
        />
        <span
          className={cn(
            'absolute -top-1.5 -left-1.5 flex items-center justify-center rounded-md text-[10px] font-bold leading-none',
            rank === 1
              ? 'h-5 w-5 bg-foreground text-background shadow-sm'
              : 'h-4.5 w-4.5 bg-muted-foreground/60 text-background',
          )}
        >
          {rank}
        </span>
      </div>

      {/* Name + Team */}
      <div className="min-w-0 flex-1">
        <p className={cn('truncate font-semibold', rank === 1 ? 'text-[15px]' : 'text-[13px]')}>
          {player.name}
        </p>
        <p className="text-muted-foreground truncate text-[11px]">
          {getTeamDisplayName(player.teamCode)} · {player.position}
        </p>
      </div>

      {/* Percentage */}
      <span
        className={cn(
          'shrink-0 tabular-nums',
          rank === 1 ? 'text-[15px] font-bold' : 'text-[13px] font-medium text-muted-foreground',
        )}
      >
        {percent}%
      </span>
    </button>
  );
};
