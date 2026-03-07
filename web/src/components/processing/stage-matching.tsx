import type { FC } from 'react';
import { useMemo, useState, useEffect, useRef } from 'react';
import type { MatchResult } from '@/types/player';
import { getSamplePlayerImageUrls } from '@/ml/similarity';
import { STAGE_MESSAGES, getTeamDisplayName, pickRandom } from '@/constants/analysis-messages';
import { cn } from '@/lib/utils';

const GRID_COUNT = 30; // 6×5 grid
const PHASE1_DURATION = 1400; // tiles appear
const PHASE2_DURATION = 1200; // shuffle + eliminate
const PHASE3_DELAY = PHASE1_DURATION + PHASE2_DURATION; // hero reveal starts

type Phase = 'appear' | 'eliminate' | 'reveal';

interface StageMatchingProps {
  pendingMatches?: MatchResult[];
}

export const StageMatching: FC<StageMatchingProps> = ({ pendingMatches }) => {
  const message = useMemo(() => pickRandom(STAGE_MESSAGES.matching), []);
  const topMatch = pendingMatches?.[0];

  // 랜덤 선수 이미지 + top match 이미지를 포함
  const tileUrls = useMemo(() => {
    const samples = getSamplePlayerImageUrls(GRID_COUNT);
    // top match 이미지를 중앙(index 14)에 배치
    if (topMatch) {
      const centerIdx = 14;
      // 이미 포함되어 있으면 제거 후 중앙에 삽입
      const filtered = samples.filter((url) => url !== topMatch.player.imageUrl);
      const result = filtered.slice(0, GRID_COUNT - 1);
      result.splice(centerIdx, 0, topMatch.player.imageUrl);
      return result;
    }
    return samples;
  }, [topMatch]);

  const [phase, setPhase] = useState<Phase>('appear');
  const [eliminatedSet, setEliminatedSet] = useState<Set<number>>(new Set());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Phase 1→2: 타일 등장 → 소거 시작
    timerRef.current = setTimeout(() => {
      setPhase('eliminate');

      // 중앙(14)을 제외한 인덱스를 랜덤 순서로 소거
      const indices = Array.from({ length: GRID_COUNT }, (_, i) => i).filter((i) => i !== 14);
      const shuffled = indices.sort(() => Math.random() - 0.5);
      const eliminateInterval = PHASE2_DURATION / shuffled.length;

      shuffled.forEach((idx, order) => {
        setTimeout(() => {
          setEliminatedSet((prev) => new Set(prev).add(idx));
        }, order * eliminateInterval);
      });
    }, PHASE1_DURATION);

    // Phase 2→3: 모두 소거 → 리빌
    const revealTimer = setTimeout(() => {
      setPhase('reveal');
    }, PHASE3_DELAY);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      clearTimeout(revealTimer);
    };
  }, []);

  const isRevealed = phase === 'reveal';

  return (
    <div className="flex flex-col items-center gap-5">
      {/* 상단 텍스트 */}
      <p className="text-muted-foreground text-center text-[13px] font-medium">
        {isRevealed && topMatch
          ? `${topMatch.player.name} 선수를 찾았어요!`
          : message}
      </p>

      {/* 타일 그리드 */}
      <div className="relative">
        <div
          className={cn(
            'grid grid-cols-6 gap-1.5 transition-all duration-700',
            isRevealed && 'opacity-0 scale-90',
          )}
        >
          {tileUrls.map((url, i) => {
            const isEliminated = eliminatedSet.has(i);
            const isCenter = i === 14;

            return (
              <div
                key={i}
                className={cn(
                  'h-11 w-11 overflow-hidden rounded-lg sm:h-12 sm:w-12',
                  isEliminated && 'animate-tile-disappear',
                  !isEliminated && phase === 'appear' && 'animate-tile-appear',
                  !isEliminated && phase === 'eliminate' && !isCenter && 'animate-tile-pulse',
                )}
                style={{
                  animationDelay: phase === 'appear' ? `${i * 30}ms` : undefined,
                }}
              >
                {url && (
                  <img
                    src={url}
                    alt=""
                    className="h-full w-full object-cover"
                    loading="eager"
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Hero reveal — 중앙에서 확대 */}
        {isRevealed && topMatch && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex flex-col items-center gap-3 animate-scale-reveal">
              <div className="h-28 w-28 overflow-hidden rounded-2xl shadow-xl ring-2 ring-border sm:h-32 sm:w-32">
                <img
                  src={topMatch.player.imageUrl}
                  alt={topMatch.player.name}
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="animate-reveal-up text-center" style={{ animationDelay: '200ms' }}>
                <p className="text-base font-bold">{topMatch.player.name}</p>
                <p className="text-muted-foreground text-xs">{getTeamDisplayName(topMatch.player.teamCode)}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
