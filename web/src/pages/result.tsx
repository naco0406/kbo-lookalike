import type { FC } from 'react';
import { useCallback } from 'react';
import { Navigate, useNavigate } from 'react-router';
import { useAppState, useAppDispatch } from '@/context/app-state-context';
import { MatchCard } from '@/components/result/match-card';
import { PlayerImage } from '@/components/result/player-image';
import { Button } from '@/components/ui/button';
import { useAnimatedNumber } from '@/hooks/use-animated-number';
import { RotateCcw, Share2 } from 'lucide-react';
import type { MatchResult } from '@/types/player';

export const ResultPage: FC = () => {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  if (state.phase !== 'result') {
    return <Navigate to="/" replace />;
  }

  const { matches, previewUrl } = state;
  const top = matches[0];
  const topPercent = Math.round(top.similarity * 100);

  const handleReset = useCallback(() => {
    dispatch({ type: 'RESET' });
    navigate('/');
  }, [dispatch, navigate]);

  const handleShare = useCallback(async () => {
    const text = `나는 ${top.player.name} 선수와 ${topPercent}% 닮았대요! KBO 닮은꼴 찾기`;
    if (navigator.share) {
      try {
        await navigator.share({ title: 'KBO 닮은꼴', text });
      } catch {
        // user cancelled
      }
    } else {
      await navigator.clipboard.writeText(text);
    }
  }, [top.player.name, topPercent]);

  return (
    <ResultContent
      matches={matches}
      previewUrl={previewUrl}
      topPercent={topPercent}
      onReset={handleReset}
      onShare={handleShare}
    />
  );
};

interface ResultContentProps {
  matches: MatchResult[];
  previewUrl: string;
  topPercent: number;
  onReset: () => void;
  onShare: () => void;
}

const ResultContent: FC<ResultContentProps> = ({
  matches,
  previewUrl,
  topPercent,
  onReset,
  onShare,
}) => {
  const animatedPercent = useAnimatedNumber(topPercent, 1200);
  const top = matches[0];

  return (
    <div className="container mx-auto max-w-lg px-4 py-6 sm:py-8">
      {/* Hero comparison */}
      <div className="mb-8 flex flex-col items-center">
        {/* Photos */}
        <div className="mb-5 flex items-center gap-4 sm:gap-6">
          <div className="animate-scale-reveal h-[5.5rem] w-[5.5rem] overflow-hidden rounded-full ring-2 ring-border sm:h-28 sm:w-28">
            <img src={previewUrl} alt="내 사진" className="h-full w-full object-cover" />
          </div>

          {/* Percentage */}
          <div
            className="flex flex-col items-center animate-reveal-up"
            style={{ animationDelay: '300ms' }}
          >
            <p className="text-4xl font-bold tabular-nums tracking-tight sm:text-5xl">
              {animatedPercent}
              <span className="text-2xl sm:text-3xl">%</span>
            </p>
            <p className="text-muted-foreground text-[11px] tracking-wider">MATCH</p>
          </div>

          <div
            className="animate-scale-reveal h-[5.5rem] w-[5.5rem] overflow-hidden rounded-full ring-2 ring-foreground sm:h-28 sm:w-28"
            style={{ animationDelay: '150ms' }}
          >
            <PlayerImage
              src={top.player.imageUrl}
              alt={top.player.name}
              className="h-full w-full"
            />
          </div>
        </div>

        {/* Name & info */}
        <div
          className="text-center animate-reveal-up"
          style={{ animationDelay: '500ms' }}
        >
          <p className="text-xl font-bold">
            {top.player.name}
          </p>
          <p className="text-muted-foreground mt-1 text-sm">
            {top.player.team} · {top.player.position}
          </p>
        </div>
      </div>

      {/* Actions */}
      <div
        className="mb-8 flex gap-3 animate-reveal-up"
        style={{ animationDelay: '600ms' }}
      >
        <Button
          onClick={onShare}
          variant="outline"
          className="flex-1 active:scale-[0.97]"
          size="lg"
        >
          <Share2 className="mr-2 h-4 w-4" />
          공유하기
        </Button>
        <Button onClick={onReset} className="flex-1 active:scale-[0.97]" size="lg">
          <RotateCcw className="mr-2 h-4 w-4" />
          다시 하기
        </Button>
      </div>

      {/* Top 5 */}
      <div
        className="animate-reveal-up"
        style={{ animationDelay: '700ms' }}
      >
        <h2 className="text-muted-foreground mb-3 text-xs font-medium uppercase tracking-wider">
          Top 5
        </h2>
        <div className="flex flex-col gap-2.5">
          {matches.map((m, i) => (
            <div
              key={m.player.id}
              className="animate-reveal-up"
              style={{ animationDelay: `${800 + i * 80}ms` }}
            >
              <MatchCard match={m} rank={i + 1} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
