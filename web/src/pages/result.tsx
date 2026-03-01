import type { FC } from 'react';
import { useLocation, useNavigate, Navigate } from 'react-router';
import { MatchCard } from '@/components/result/match-card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import type { MatchResult } from '@/types/player';

interface ResultState {
  matches: MatchResult[];
  previewUrl: string;
}

export const ResultPage: FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as ResultState | null;

  if (!state?.matches) {
    return <Navigate to="/" replace />;
  }

  const { matches, previewUrl } = state;
  const top = matches[0];

  return (
    <div className="container mx-auto max-w-lg px-4 py-8">
      {/* Hero: user vs top match */}
      <div className="mb-6 flex items-center justify-center gap-4">
        <div className="border-muted h-24 w-24 shrink-0 overflow-hidden rounded-full border-2">
          <img src={previewUrl} alt="내 사진" className="h-full w-full object-cover" />
        </div>
        <div className="text-center">
          <p className="text-primary text-3xl font-bold">{Math.round(top.similarity * 100)}%</p>
          <p className="text-muted-foreground text-xs">일치</p>
        </div>
        <div className="border-primary h-24 w-24 shrink-0 overflow-hidden rounded-full border-2">
          <img
            src={top.player.imageUrl}
            alt={top.player.name}
            className="h-full w-full object-cover"
          />
        </div>
      </div>

      <p className="mb-1 text-center text-lg font-semibold">
        당신은 <span className="text-primary">{top.player.name}</span> 선수를 닮았습니다!
      </p>
      <p className="text-muted-foreground mb-6 text-center text-sm">
        {top.player.team} · {top.player.position}
      </p>

      <Separator className="mb-6" />

      {/* Top 5 list */}
      <h2 className="text-muted-foreground mb-3 text-sm font-medium">닮은꼴 TOP 5</h2>
      <div className="mb-8 flex flex-col gap-3">
        {matches.map((m, i) => (
          <MatchCard key={m.player.id} match={m} rank={i + 1} />
        ))}
      </div>

      <Button onClick={() => navigate('/')} className="w-full" size="lg">
        다시 하기
      </Button>
    </div>
  );
};
