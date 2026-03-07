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
  const percentNum = Math.round(similarity * 1000) / 10;
  const percent = percentNum.toFixed(1);
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className={cn(
        'overflow-hidden rounded-2xl transition-all duration-200',
        rank === 1 ? 'bg-card ring-1 ring-border' : 'bg-card/50',
      )}
    >
      {/* 메인 행 — 모든 rank에서 동일한 높이 */}
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors active:bg-muted/30"
      >
        {/* Rank + Photo — 통일된 크기 */}
        <div
          className="relative shrink-0 cursor-pointer transition-transform active:scale-95"
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
            className="h-12 w-12 rounded-xl"
          />
          <span
            className={cn(
              'absolute -top-1 -left-1 flex h-[18px] w-[18px] items-center justify-center rounded-md text-[10px] font-bold',
              rank === 1
                ? 'bg-foreground text-background'
                : 'bg-muted-foreground/50 text-background',
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
              'tabular-nums',
              rank === 1 ? 'text-lg font-bold' : 'text-base font-semibold text-muted-foreground',
            )}
          >
            {percent}%
          </p>
          <div className="bg-muted mt-1 h-1 w-12 overflow-hidden rounded-full">
            <div
              className={cn(
                'h-full rounded-full animate-width-grow',
                rank === 1 ? 'bg-foreground' : 'bg-muted-foreground/40',
              )}
              style={{ width: `${percentNum}%` }}
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
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 border-t border-border/30 px-4 py-4">
            <div className="flex flex-col items-center gap-1.5">
              <div className="h-16 w-16 overflow-hidden rounded-xl ring-1 ring-border">
                <img src={userPhotoUrl} alt="나" className="h-full w-full object-cover" />
              </div>
              <span className="text-muted-foreground text-[11px]">나</span>
            </div>

            <div className="flex flex-col items-center">
              <span className="text-xl font-bold tabular-nums leading-none">{percent}%</span>
              <span className="text-muted-foreground mt-1 text-[10px] font-medium tracking-widest">MATCH</span>
            </div>

            <div className="flex flex-col items-center gap-1.5">
              <div className="h-16 w-16 overflow-hidden rounded-xl ring-1 ring-foreground/15">
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
