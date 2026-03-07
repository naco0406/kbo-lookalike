import type { FC } from 'react';
import { useCallback, useState } from 'react';
import { Navigate, useNavigate } from 'react-router';
import { toast } from 'sonner';
import { useAppState, useAppDispatch } from '@/context/app-state-context';
import { MatchCard } from '@/components/result/match-card';
import { PlayerImage } from '@/components/result/player-image';
import { ImageLightbox } from '@/components/result/image-lightbox';
import { FaceMorphDialog } from '@/components/result/face-morph-dialog';
import { BaseballProfile } from '@/components/result/baseball-profile';
import { useAnimatedNumber } from '@/hooks/use-animated-number';
import { generateShareCard } from '@/lib/share-card';
import { RotateCcw, Loader2, Download, Copy } from 'lucide-react';
import type { MatchResult, Classification } from '@/types/player';
import { getTeamDisplayName } from '@/constants/analysis-messages';

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

  const handleReset = useCallback(() => {
    dispatch({ type: 'RESET' });
    navigate('/');
  }, [dispatch, navigate]);

  if (state.phase !== 'result') {
    return <Navigate to="/" replace />;
  }

  const { matches, previewUrl, croppedFaceUrl, alignedFaceUrl, classification } = state;
  const top = matches[0];
  const topPercent = Math.round(top.similarity * 1000) / 10;

  return (
    <ResultContent
      matches={matches}
      previewUrl={previewUrl}
      croppedFaceUrl={croppedFaceUrl}
      alignedFaceUrl={alignedFaceUrl}
      topPercent={topPercent}
      top={top}
      classification={classification}
      onReset={handleReset}
    />
  );
};

interface ResultContentProps {
  matches: MatchResult[];
  previewUrl: string;
  croppedFaceUrl?: string;
  alignedFaceUrl?: string;
  topPercent: number;
  top: MatchResult;
  classification?: Classification;
  onReset: () => void;
}

/** raw cosine이 이 임계치를 초과하면 본인일 가능성 → 선수 프로필 표시 */
const EXACT_MATCH_THRESHOLD = 0.75;

interface MorphTarget {
  imageUrl: string;
  name: string;
}

const ResultContent: FC<ResultContentProps> = ({
  matches,
  previewUrl,
  croppedFaceUrl,
  alignedFaceUrl,
  topPercent,
  top,
  classification,
  onReset,
}) => {
  const animatedPercent = useAnimatedNumber(topPercent, 1200, 1);
  const [isSharing, setIsSharing] = useState(false);
  const [lightbox, setLightbox] = useState<LightboxState | null>(null);
  const [morphTarget, setMorphTarget] = useState<MorphTarget | null>(null);

  const userDisplayUrl = croppedFaceUrl ?? previewUrl;
  const isExactMatch = (top.bonusBreakdown?.cosine ?? 0) >= EXACT_MATCH_THRESHOLD;

  const openLightbox = useCallback(
    (src: string, alt: string, label?: string, sublabel?: string) => {
      setLightbox({ src, alt, label, sublabel });
    },
    [],
  );

  const openMorph = useCallback(
    (imageUrl: string, name: string) => {
      setMorphTarget({ imageUrl, name });
    },
    [],
  );

  const handleShare = useCallback(async () => {
    const top3 = matches.slice(0, 3);
    const lines = [
      'KBO 닮은꼴 결과',
      '',
      ...top3.map((m, i) => {
        const p = (Math.round(m.similarity * 1000) / 10).toFixed(1);
        return `${i + 1}위 ${m.player.name} (${p}%) — ${getTeamDisplayName(m.player.teamCode)}`;
      }),
      '',
      ...(classification
        ? [`추정 포지션: ${classification.position.position}`,
           `추정 구단: ${classification.team.topTeams[0]?.name ?? ''}`,
           '']
        : []),
      '나도 닮은꼴 찾아보기',
      'https://lookalike.naco.kr/',
    ];
    const text = lines.join('\n');

    try {
      await navigator.clipboard.writeText(text);
      toast.success('결과가 클립보드에 복사되었습니다');
    } catch {
      toast.error('복사에 실패했습니다');
    }
  }, [matches, classification]);

  const handleSave = useCallback(async () => {
    setIsSharing(true);
    try {
      const blob = await generateShareCard({
        userPhotoUrl: userDisplayUrl,
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
  }, [matches, userDisplayUrl, classification]);

  return (
    <div className="container mx-auto max-w-md px-5 pb-12">
      {/* ── Hero: 선수 중심 ── */}
      <div className="flex flex-col items-center pt-4 pb-6">
        {/* 선수 사진 (메인) — 클릭 시 이미지 뷰어 */}
        <button
          onClick={() =>
            openLightbox(
              top.player.imageUrl,
              top.player.name,
              top.player.name,
              `${getTeamDisplayName(top.player.teamCode)} · ${top.player.position}`,
            )
          }
          className="relative mb-4 animate-scale-reveal"
        >
          <div className="h-32 w-32 overflow-hidden rounded-3xl shadow-lg ring-2 ring-border sm:h-36 sm:w-36">
            <PlayerImage
              src={top.player.imageUrl}
              alt={top.player.name}
              className="h-full w-full"
            />
          </div>
          {/* 유저 사진 오버레이 (좌하단) */}
          <div
            onClick={(e) => {
              e.stopPropagation();
              openLightbox(previewUrl, '내 사진', '내 사진');
            }}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter') openLightbox(previewUrl, '내 사진', '내 사진'); }}
            className="absolute -bottom-2 -left-2 h-10 w-10 cursor-pointer overflow-hidden rounded-xl ring-2 ring-background shadow-md transition-transform active:scale-95"
          >
            <img src={userDisplayUrl} alt="나" className="h-full w-full object-cover" />
          </div>
        </button>

        {/* 퍼센트 */}
        <div
          className="mb-2 animate-reveal-up"
          style={{ animationDelay: '200ms' }}
        >
          <p className="text-center text-[3rem] font-extrabold tabular-nums leading-none tracking-tighter sm:text-[3.5rem]">
            {animatedPercent.toFixed(1)}
            <span className="text-2xl sm:text-3xl">%</span>
          </p>
        </div>

        {/* 선수 이름 + 정보 */}
        <div
          className="animate-reveal-up text-center"
          style={{ animationDelay: '350ms' }}
        >
          {isExactMatch ? (
            <p className="text-[15px] font-bold">
              {top.player.name}
              <span className="text-muted-foreground ml-1 text-sm font-normal">선수, 본인이신가요?</span>
            </p>
          ) : (
            <p className="text-[15px] font-bold">
              {top.player.name}
              <span className="text-muted-foreground ml-1 text-sm font-normal">선수와 닮았어요</span>
            </p>
          )}
          <p className="text-muted-foreground mt-0.5 text-[13px]">
            {getTeamDisplayName(top.player.teamCode)} · {top.player.position}
          </p>
        </div>
      </div>

      {/* ── 야구 프로필 (컴팩트) ── */}
      {classification && !isExactMatch && (
        <div
          className="mb-4 animate-reveal-up"
          style={{ animationDelay: '450ms' }}
        >
          <BaseballProfile classification={classification} />
        </div>
      )}

      {/* ── 본인 선수 배너 ── */}
      {isExactMatch && (
        <div
          className="mb-4 animate-reveal-up rounded-xl border border-foreground/10 bg-card/60 px-4 py-3 text-center"
          style={{ animationDelay: '450ms' }}
        >
          <p className="text-[13px] font-semibold">{top.player.name} 선수 프로필</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {getTeamDisplayName(top.player.teamCode)} · {top.player.position}
          </p>
        </div>
      )}

      {/* ── 액션 버튼 ── */}
      <div
        className="mb-6 animate-reveal-up"
        style={{ animationDelay: '500ms' }}
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
              className="flex h-14 flex-col items-center justify-center gap-1 rounded-xl bg-card text-foreground transition-all active:scale-[0.96] disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Icon className="h-4 w-4" />
              )}
              <span className="text-[10px] font-medium">{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Top 5 리스트 ── */}
      <div
        className="animate-reveal-up"
        style={{ animationDelay: '580ms' }}
      >
        <div className="mb-2.5 flex items-center gap-3">
          <h2 className="shrink-0 text-[13px] font-semibold tracking-tight">닮은꼴 Top 5</h2>
          <div className="bg-border h-px flex-1" />
        </div>
        <div className="flex flex-col gap-0.5">
          {matches.map((m, i) => (
            <div
              key={m.player.id}
              className="animate-reveal-up"
              style={{ animationDelay: `${650 + i * 50}ms` }}
            >
              <MatchCard
                match={m}
                rank={i + 1}
                onImageClick={() =>
                  alignedFaceUrl
                    ? openMorph(m.player.imageUrl, m.player.name)
                    : openLightbox(
                        m.player.imageUrl,
                        m.player.name,
                        m.player.name,
                        `${getTeamDisplayName(m.player.teamCode)} · ${m.player.position}`,
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

      {/* 얼굴 겹치기 비교 */}
      {alignedFaceUrl && (
        <FaceMorphDialog
          open={morphTarget !== null}
          onOpenChange={(open) => {
            if (!open) setMorphTarget(null);
          }}
          userAlignedUrl={alignedFaceUrl}
          playerImageUrl={morphTarget?.imageUrl ?? ''}
          playerName={morphTarget?.name ?? ''}
        />
      )}
    </div>
  );
};
