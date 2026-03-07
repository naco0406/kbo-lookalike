import type { FC } from 'react';
import { useCallback, useState } from 'react';
import { Navigate, useNavigate } from 'react-router';
import { toast } from 'sonner';
import { useAppState, useAppDispatch } from '@/context/app-state-context';
import { MatchCard } from '@/components/result/match-card';
import { PlayerImage } from '@/components/result/player-image';
import { ImageLightbox } from '@/components/result/image-lightbox';
import { Button } from '@/components/ui/button';
import { useAnimatedNumber } from '@/hooks/use-animated-number';
import { generateShareCard } from '@/lib/share-card';
import { RotateCcw, Loader2, Download, Copy } from 'lucide-react';
import type { MatchResult } from '@/types/player';

interface LightboxState {
  src: string;
  alt: string;
  label?: string;
  sublabel?: string;
}

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

  return (
    <ResultContent
      matches={matches}
      previewUrl={previewUrl}
      topPercent={topPercent}
      top={top}
      onReset={handleReset}
    />
  );
};

interface ResultContentProps {
  matches: MatchResult[];
  previewUrl: string;
  topPercent: number;
  top: MatchResult;
  onReset: () => void;
}

const ResultContent: FC<ResultContentProps> = ({
  matches,
  previewUrl,
  topPercent,
  top,
  onReset,
}) => {
  const animatedPercent = useAnimatedNumber(topPercent, 1200);
  const [isSharing, setIsSharing] = useState(false);
  const [lightbox, setLightbox] = useState<LightboxState | null>(null);

  const openLightbox = useCallback(
    (src: string, alt: string, label?: string, sublabel?: string) => {
      setLightbox({ src, alt, label, sublabel });
    },
    [],
  );

  const handleShare = useCallback(async () => {
    const top3 = matches.slice(0, 3);
    const lines = [
      '⚾ KBO 닮은꼴 결과',
      '',
      ...top3.map((m, i) => {
        const p = Math.round(m.similarity * 100);
        return `${i + 1}위 ${m.player.name} (${p}%) — ${m.player.team}`;
      }),
      '',
      '나도 닮은꼴 찾아보기 👉',
      'https://lookalike.naco.kr/',
    ];
    const text = lines.join('\n');

    try {
      await navigator.clipboard.writeText(text);
      toast.success('결과가 클립보드에 복사되었습니다');
    } catch {
      toast.error('복사에 실패했습니다');
    }
  }, [matches]);

  const handleSave = useCallback(async () => {
    setIsSharing(true);
    try {
      const blob = await generateShareCard({
        userPhotoUrl: previewUrl,
        matches,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'kbo-lookalike.png';
      a.click();
      URL.revokeObjectURL(url);
      toast.success('이미지가 저장되었습니다');
    } catch {
      toast.error('이미지 저장에 실패했습니다');
    } finally {
      setIsSharing(false);
    }
  }, [matches, previewUrl]);

  return (
    <div className="container mx-auto max-w-lg px-4 py-6 sm:py-8">
      {/* Hero comparison */}
      <div className="mb-8 flex flex-col items-center">
        {/* Photos */}
        <div className="mb-5 flex items-center gap-4 sm:gap-6">
          <button
            onClick={() => openLightbox(previewUrl, '내 사진', '내 사진')}
            className="animate-scale-reveal h-[5.5rem] w-[5.5rem] cursor-pointer overflow-hidden rounded-full ring-2 ring-border transition-transform hover:scale-105 active:scale-95 sm:h-28 sm:w-28"
          >
            <img src={previewUrl} alt="내 사진" className="h-full w-full object-cover" />
          </button>

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

          <button
            onClick={() =>
              openLightbox(
                top.player.imageUrl,
                top.player.name,
                top.player.name,
                `${top.player.team} · ${top.player.position}`,
              )
            }
            className="animate-scale-reveal h-[5.5rem] w-[5.5rem] cursor-pointer overflow-hidden rounded-full ring-2 ring-foreground transition-transform hover:scale-105 active:scale-95 sm:h-28 sm:w-28"
            style={{ animationDelay: '150ms' }}
          >
            <PlayerImage
              src={top.player.imageUrl}
              alt={top.player.name}
              className="h-full w-full"
            />
          </button>
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
          onClick={handleShare}
          variant="outline"
          className="flex-1 active:scale-[0.97]"
          size="lg"
        >
          <Copy className="mr-2 h-4 w-4" />
          공유하기
        </Button>
        <Button
          onClick={handleSave}
          disabled={isSharing}
          variant="outline"
          className="flex-1 active:scale-[0.97]"
          size="lg"
        >
          {isSharing ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Download className="mr-2 h-4 w-4" />
          )}
          저장하기
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
              <MatchCard
                match={m}
                rank={i + 1}
                userPhotoUrl={previewUrl}
                onImageClick={() =>
                  openLightbox(
                    m.player.imageUrl,
                    m.player.name,
                    m.player.name,
                    `${m.player.team} · ${m.player.position}`,
                  )
                }
              />
            </div>
          ))}
        </div>
      </div>

      {/* Lightbox */}
      <ImageLightbox
        open={lightbox !== null}
        onOpenChange={(open) => {
          if (!open) setLightbox(null);
        }}
        src={lightbox?.src ?? ''}
        alt={lightbox?.alt ?? ''}
        label={lightbox?.label}
        sublabel={lightbox?.sublabel}
      />
    </div>
  );
};
