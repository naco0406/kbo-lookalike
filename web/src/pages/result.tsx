import type { FC } from 'react';
import { useCallback, useState } from 'react';
import { Navigate, useNavigate } from 'react-router';
import { toast } from 'sonner';
import { useAppState, useAppDispatch } from '@/context/app-state-context';
import { MatchCard } from '@/components/result/match-card';
import { PlayerImage } from '@/components/result/player-image';
import { ImageLightbox } from '@/components/result/image-lightbox';
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
  const topPercent = Math.round(top.similarity * 1000) / 10;

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
  const animatedPercent = useAnimatedNumber(topPercent, 1200, 1);
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
        const p = (Math.round(m.similarity * 1000) / 10).toFixed(1);
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
    <div className="container mx-auto max-w-lg px-5 pb-12">
      {/* ── Hero 비교 섹션 ── */}
      <div className="mb-8 flex flex-col items-center pt-2">
        {/* 사진 비교 — 3-column grid로 정렬 */}
        <div className="mb-5 grid grid-cols-[1fr_auto_1fr] items-center gap-4 sm:gap-6">
          {/* 유저 사진 */}
          <div className="flex flex-col items-center gap-2 animate-scale-reveal">
            <button
              onClick={() => openLightbox(previewUrl, '내 사진', '내 사진')}
              className="h-24 w-24 cursor-pointer overflow-hidden rounded-2xl ring-2 ring-border transition-transform active:scale-95 sm:h-28 sm:w-28"
            >
              <img src={previewUrl} alt="내 사진" className="h-full w-full object-cover" />
            </button>
            <span className="text-muted-foreground text-[11px]">나</span>
          </div>

          {/* 매칭 퍼센트 — 중앙 */}
          <div
            className="flex flex-col items-center animate-reveal-up"
            style={{ animationDelay: '300ms' }}
          >
            <p className="text-[2.75rem] font-extrabold tabular-nums leading-none tracking-tighter sm:text-[3.25rem]">
              {animatedPercent.toFixed(1)}
              <span className="text-2xl sm:text-3xl">%</span>
            </p>
            <span className="text-muted-foreground mt-1 text-[10px] font-medium tracking-widest">MATCH</span>
          </div>

          {/* 선수 사진 */}
          <div
            className="flex flex-col items-center gap-2 animate-scale-reveal"
            style={{ animationDelay: '150ms' }}
          >
            <button
              onClick={() =>
                openLightbox(
                  top.player.imageUrl,
                  top.player.name,
                  top.player.name,
                  `${top.player.team} · ${top.player.position}`,
                )
              }
              className="h-24 w-24 cursor-pointer overflow-hidden rounded-2xl ring-2 ring-foreground/20 transition-transform active:scale-95 sm:h-28 sm:w-28"
            >
              <PlayerImage
                src={top.player.imageUrl}
                alt={top.player.name}
                className="h-full w-full"
              />
            </button>
            <span className="text-muted-foreground text-[11px]">{top.player.name}</span>
          </div>
        </div>

        {/* 선수 정보 */}
        <div
          className="text-center animate-reveal-up"
          style={{ animationDelay: '450ms' }}
        >
          <p className="text-[17px] font-bold leading-snug">
            <span className="text-foreground">{top.player.name}</span>
            <span className="text-muted-foreground ml-1 text-sm font-normal">
              선수와 닮았어요
            </span>
          </p>
          <p className="text-muted-foreground mt-1 text-[13px]">
            {top.player.team} · {top.player.position}
          </p>
        </div>
      </div>

      {/* ── 액션 버튼 ── */}
      <div
        className="mb-8 animate-reveal-up"
        style={{ animationDelay: '550ms' }}
      >
        <div className="grid grid-cols-3 gap-2">
          {[
            { icon: Copy, label: '공유하기', onClick: handleShare, loading: false },
            { icon: Download, label: '저장하기', onClick: handleSave, loading: isSharing },
            { icon: RotateCcw, label: '다시 하기', onClick: onReset, loading: false },
          ].map(({ icon: Icon, label, onClick, loading }) => (
            <button
              key={label}
              onClick={onClick}
              disabled={loading}
              className="flex h-16 flex-col items-center justify-center gap-1.5 rounded-xl bg-card text-foreground transition-all active:scale-[0.96] disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="h-[18px] w-[18px] animate-spin" />
              ) : (
                <Icon className="h-[18px] w-[18px]" />
              )}
              <span className="text-[11px] font-medium">{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Top 5 리스트 ── */}
      <div
        className="animate-reveal-up"
        style={{ animationDelay: '650ms' }}
      >
        <div className="mb-3 flex items-center gap-3">
          <h2 className="shrink-0 text-[13px] font-semibold tracking-tight">닮은꼴 Top 5</h2>
          <div className="bg-border h-px flex-1" />
        </div>
        <div className="flex flex-col gap-1.5">
          {matches.map((m, i) => (
            <div
              key={m.player.id}
              className="animate-reveal-up"
              style={{ animationDelay: `${750 + i * 60}ms` }}
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
