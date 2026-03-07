import type { FC } from 'react';
import { useMemo } from 'react';
import type { PositionClassification } from '@/types/player';
import { STAGE_MESSAGES, pickRandom } from '@/constants/analysis-messages';
import { cn } from '@/lib/utils';

interface StagePositionProps {
  croppedFaceUrl?: string;
  previewUrl: string;
  positionResult?: PositionClassification;
}

export const StagePosition: FC<StagePositionProps> = ({
  croppedFaceUrl,
  previewUrl,
  positionResult,
}) => {
  const message = useMemo(() => pickRandom(STAGE_MESSAGES.positionClassify), []);
  const imageUrl = croppedFaceUrl ?? previewUrl;
  const decided = !!positionResult;
  const isPitcher = positionResult?.position === '투수';

  return (
    <div className="flex flex-col items-center gap-6">
      {/* 투수 vs 타자 비교 레이아웃 */}
      <div className="flex items-center gap-3 sm:gap-5">
        {/* 투수 */}
        <div
          className={cn(
            'flex flex-col items-center gap-1.5 rounded-2xl px-5 py-4 transition-all duration-500',
            decided
              ? isPitcher
                ? 'scale-105 bg-foreground/5 ring-1 ring-foreground/10'
                : 'scale-90 opacity-25'
              : 'animate-position-alt',
          )}
        >
          <span className={cn(
            'text-2xl font-bold transition-all duration-500 sm:text-3xl',
            decided && isPitcher ? 'text-foreground' : decided ? 'text-muted-foreground' : 'text-foreground',
          )}>
            투수
          </span>
          <span className="text-[10px] font-medium tracking-wider text-muted-foreground">
            Pitcher
          </span>
          {decided && isPitcher && positionResult && (
            <span className="mt-1 text-xs font-semibold text-foreground animate-scale-reveal">
              {(positionResult.confidence * 100).toFixed(0)}%
            </span>
          )}
        </div>

        {/* 얼굴 (중앙) */}
        <div className="relative h-24 w-24 overflow-hidden rounded-2xl shadow-lg sm:h-28 sm:w-28">
          <img
            src={imageUrl}
            alt="분석 중"
            className="h-full w-full object-cover"
          />
          {!decided && (
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-foreground/[0.03] via-transparent to-foreground/[0.03]" />
          )}
        </div>

        {/* 타자 */}
        <div
          className={cn(
            'flex flex-col items-center gap-1.5 rounded-2xl px-5 py-4 transition-all duration-500',
            decided
              ? !isPitcher
                ? 'scale-105 bg-foreground/5 ring-1 ring-foreground/10'
                : 'scale-90 opacity-25'
              : 'animate-position-alt-reverse',
          )}
        >
          <span className={cn(
            'text-2xl font-bold transition-all duration-500 sm:text-3xl',
            decided && !isPitcher ? 'text-foreground' : decided ? 'text-muted-foreground' : 'text-foreground',
          )}>
            타자
          </span>
          <span className="text-[10px] font-medium tracking-wider text-muted-foreground">
            Batter
          </span>
          {decided && !isPitcher && positionResult && (
            <span className="mt-1 text-xs font-semibold text-foreground animate-scale-reveal">
              {(positionResult.confidence * 100).toFixed(0)}%
            </span>
          )}
        </div>
      </div>

      {/* Confidence 바 (결과 나온 후) */}
      {decided && positionResult && (
        <div className="flex w-48 items-center gap-2 animate-reveal-up">
          <span className="text-[10px] font-medium text-muted-foreground w-5 text-right">투</span>
          <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-foreground/50 transition-all duration-700"
              style={{ width: `${(positionResult.scores['투수'] ?? 0.5) * 100}%` }}
            />
          </div>
          <span className="text-[10px] font-medium text-muted-foreground w-5">타</span>
        </div>
      )}

      {/* 메시지 */}
      <p className="text-muted-foreground text-center text-sm font-medium">
        {message}
      </p>
    </div>
  );
};
