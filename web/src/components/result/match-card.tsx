import type { FC } from 'react';
import type { MatchResult } from '@/types/player';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface MatchCardProps {
  match: MatchResult;
  rank: number;
}

export const MatchCard: FC<MatchCardProps> = ({ match, rank }) => {
  const { player, similarity } = match;
  const percent = Math.round(similarity * 100);

  return (
    <Card className={rank === 1 ? 'border-primary shadow-lg' : ''}>
      <CardContent className="flex items-center gap-4 p-4">
        <div className="relative">
          <div className="bg-muted h-16 w-16 shrink-0 overflow-hidden rounded-full">
            <img
              src={player.imageUrl}
              alt={player.name}
              className="h-full w-full object-cover"
              loading="lazy"
            />
          </div>
          <span className="bg-primary text-primary-foreground absolute -top-1 -left-1 flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold">
            {rank}
          </span>
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-semibold">{player.name}</p>
          <div className="mt-1 flex items-center gap-2">
            <Badge variant="secondary" className="text-xs">
              {player.team}
            </Badge>
            <span className="text-muted-foreground text-xs">{player.position}</span>
          </div>
        </div>

        <div className="shrink-0 text-right">
          <p className="text-primary text-2xl font-bold">{percent}%</p>
          <p className="text-muted-foreground text-xs">유사도</p>
        </div>
      </CardContent>
    </Card>
  );
};
