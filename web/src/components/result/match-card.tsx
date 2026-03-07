import type { FC } from 'react';
import { useState } from 'react';
import type { MatchResult } from '@/types/player';
import { PlayerImage } from '@/components/result/player-image';
import { cn } from '@/lib/utils';

interface MatchCardProps {
  match: MatchResult;
  rank: number;
  userPhotoUrl: string;
  onImageClick?: () => void;
}

export const MatchCard: FC<MatchCardProps> = ({ match, rank, userPhotoUrl, onImageClick }) => {
  const { player, similarity } = match;
  const percent = Math.round(similarity * 100);
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className={cn(
        'rounded-2xl border transition-all duration-200',
        rank === 1 ? 'border-foreground/15 bg-card shadow-sm' : 'border-transparent bg-card/50',
      )}
    >
      {/* 메인 행 */}
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className="flex w-full items-center gap-3.5 p-3 text-left"
      >
        {/* Rank + Photo */}
        <div
          className="relative shrink-0 cursor-pointer transition-transform hover:scale-105 active:scale-95"
          onClick={(e) => {
            e.stopPropagation();
            onImageClick?.();
          }}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onImageClick?.();
          }}
        >
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
      </button>

      {/* 확장형 비교 뷰 */}
      <div
        className={cn(
          'grid transition-[grid-template-rows] duration-300 ease-out',
          expanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
        )}
      >
        <div className="overflow-hidden">
          <div className="flex items-center justify-center gap-4 border-t border-border/50 px-3 pt-3 pb-3">
            <div className="flex flex-col items-center gap-1">
              <div className="h-16 w-16 overflow-hidden rounded-full ring-1 ring-border">
                <img src={userPhotoUrl} alt="나" className="h-full w-full object-cover" />
              </div>
              <span className="text-muted-foreground text-[11px]">나</span>
            </div>

            <div className="flex flex-col items-center">
              <span className="text-lg font-bold tabular-nums">{percent}%</span>
              <span className="text-muted-foreground text-[10px] tracking-wider">MATCH</span>
            </div>

            <div className="flex flex-col items-center gap-1">
              <div className="h-16 w-16 overflow-hidden rounded-full ring-1 ring-foreground/30">
                <PlayerImage src={player.imageUrl} alt={player.name} className="h-full w-full" />
              </div>
              <span className="text-muted-foreground text-[11px]">{player.name}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
