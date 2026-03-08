import type { FC } from 'react';
import { useMemo, useState, useEffect, useRef } from 'react';
import type { MatchResult } from '@/types/player';
import { getMatchTileUrls } from '@/ml/similarity';
import { getTeamDisplayName, pickRandom } from '@/constants/analysis-messages';
import { cn } from '@/lib/utils';

const GRID_COUNT = 30; // 6×5 grid
const PHASE1_DURATION = 1400; // tiles appear
const PHASE2_DURATION = 1200; // shuffle + eliminate
const PHASE3_DELAY = PHASE1_DURATION + PHASE2_DURATION; // hero reveal starts

// 페이즈별 스토리텔링 메시지
const PHASE_MESSAGES = {
  appear: [
    '후보 선수들을 불러모으는 중...',
    '이 선수들 중 닮은꼴이 있을까?',
    '최종 후보군을 소집했어요',
    '닮은 선수가 꽤 있는데요...?',
  ],
  eliminate: [
    '한 명씩 대조하는 중...',
    '후보를 좁혀가고 있어요...',
    '점점 가까워지고 있어요...',
    '거의 찾은 것 같아요!',
  ],
} as const;

type Phase = 'appear' | 'eliminate' | 'reveal';

interface StageMatchingProps {
  pendingMatches?: MatchResult[];
}

export const StageMatching: FC<StageMatchingProps> = ({ pendingMatches }) => {
  const topMatch = pendingMatches?.[0];

  const appearMessage = useMemo(() => pickRandom(PHASE_MESSAGES.appear), []);
  const eliminateMessage = useMemo(() => pickRandom(PHASE_MESSAGES.eliminate), []);

  // 매치 결과 기반 타일 URL — 캐시에서 프리로드 때와 동일한 URL 반환 (새 네트워크 요청 없음)
  const tileUrls = useMemo(() => {
    if (!pendingMatches || pendingMatches.length === 0) return [];
    return getMatchTileUrls(pendingMatches, GRID_COUNT);
  }, [pendingMatches]);

  const [phase, setPhase] = useState<Phase>('appear');
  const [eliminatedSet, setEliminatedSet] = useState<Set<number>>(new Set());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 애니메이션 — 프리로드가 ~7초 전에 완료했으므로 즉시 시작
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

  // 페이즈별 메시지
  const message = (() => {
    if (isRevealed && topMatch) return `${topMatch.player.name} 선수를 찾았어요!`;
    if (phase === 'eliminate') return eliminateMessage;
    return appearMessage;
  })();

  return (
    <div className="flex flex-col items-center gap-5">
      {/* 상단 텍스트 */}
      <p className="text-muted-foreground text-center text-[13px] font-medium">
        {message}
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
