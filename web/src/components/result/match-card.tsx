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
        'flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors active:bg-muted/30',
        rank === 1 && 'bg-card ring-1 ring-border',
      )}
    >
      {/* Rank + Photo */}
      <div className="relative shrink-0">
        <PlayerImage
          src={player.imageUrl}
          alt={player.name}
          className="h-10 w-10 rounded-lg"
        />
        <span
          className={cn(
            'absolute -top-1 -left-1 flex h-4 w-4 items-center justify-center rounded text-[9px] font-bold',
            rank === 1
              ? 'bg-foreground text-background'
              : 'bg-muted-foreground/50 text-background',
          )}
        >
          {rank}
        </span>
      </div>

      {/* Name + Team */}
      <div className="min-w-0 flex-1">
        <p className={cn('truncate font-semibold', rank === 1 ? 'text-sm' : 'text-[13px]')}>
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
          rank === 1 ? 'text-sm font-bold' : 'text-[13px] font-semibold text-muted-foreground',
        )}
      >
        {percent}%
      </span>
    </button>
  );
};
