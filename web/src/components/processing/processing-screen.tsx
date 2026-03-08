import type { FC } from 'react';
import { useState, useEffect, useRef } from 'react';
import type { PipelineStep } from '@/ml/pipeline';
import type { PositionClassification, TeamClassification, MatchResult } from '@/types/player';
import { StageFaceDetection } from './stage-face-detection';
import { StageAiAnalysis } from './stage-ai-analysis';
import { StagePosition } from './stage-position';
import { StageTeam } from './stage-team';
import { StageMatching } from './stage-matching';
import { preloadMatchTileImages } from '@/ml/similarity';
import { cn } from '@/lib/utils';

type Stage = 'loading' | 'face-detection' | 'ai-analysis' | 'position' | 'team' | 'matching';

const stepToStage = (step: PipelineStep): Stage => {
  switch (step) {
    case 'loading-models':
    case 'loading-data':
      return 'loading';
    case 'detecting-face':
    case 'cropping-face':
      return 'face-detection';
    case 'aligning-face':
    case 'extracting-embedding':
      return 'ai-analysis';
    case 'classifying-position':
      return 'position';
    case 'classifying-team':
    case 'checking-baseball-face':
      return 'team';
    case 'searching':
      return 'matching';
    default:
      return 'loading';
  }
};

const STAGE_ORDER: Stage[] = ['loading', 'face-detection', 'ai-analysis', 'position', 'team', 'matching'];

interface ProcessingScreenProps {
  step: PipelineStep;
  previewUrl: string;
  faceRect?: { x: number; y: number; width: number; height: number };
  croppedFaceUrl?: string;
  positionResult?: PositionClassification;
  teamResult?: TeamClassification;
  isBaseballFace?: boolean;
  pendingMatches?: MatchResult[];
}

export const ProcessingScreen: FC<ProcessingScreenProps> = ({
  step,
  previewUrl,
  faceRect,
  croppedFaceUrl,
  positionResult,
  teamResult,
  isBaseballFace,
  pendingMatches,
}) => {
  const currentStage = stepToStage(step);
  const [displayedStage, setDisplayedStage] = useState<Stage>(currentStage);
  const [transitioning, setTransitioning] = useState(false);
  const prevStageRef = useRef<Stage>(currentStage);

  // Stage 전환 애니메이션
  useEffect(() => {
    if (currentStage === prevStageRef.current) return;

    const currentIdx = STAGE_ORDER.indexOf(currentStage);
    const prevIdx = STAGE_ORDER.indexOf(prevStageRef.current);

    // 진행 방향 전환만 허용 (backward skip 방지)
    if (currentIdx <= prevIdx) {
      prevStageRef.current = currentStage;
      setDisplayedStage(currentStage);
      return;
    }

    prevStageRef.current = currentStage;

    // loading에서 face-detection으로 전환 시 즉시 전환
    if (currentStage === 'face-detection' && displayedStage === 'loading') {
      setDisplayedStage(currentStage);
      return;
    }

    // fade-out → fade-in (450ms for smoother transition)
    setTransitioning(true);
    const timer = setTimeout(() => {
      setDisplayedStage(currentStage);
      setTransitioning(false);
    }, 450);

    return () => clearTimeout(timer);
  }, [currentStage, displayedStage]);

  // 매칭 결과 도착 즉시 타일 이미지 프리로드 (position/team 스테이지 연출 중 로딩)
  const preloadTriggered = useRef(false);
  useEffect(() => {
    if (pendingMatches && pendingMatches.length > 0 && !preloadTriggered.current) {
      preloadTriggered.current = true;
      preloadMatchTileImages(pendingMatches);
    }
  }, [pendingMatches]);

  // Loading 단계: 간단한 로딩 표시
  if (displayedStage === 'loading') {
    return (
      <div className="mx-auto flex w-full max-w-xs flex-col items-center gap-5 animate-in fade-in duration-300">
        <div className="animate-processing-breathe h-28 w-28 overflow-hidden rounded-full shadow-lg sm:h-36 sm:w-36">
          <img src={previewUrl} alt="준비 중" className="h-full w-full object-cover" />
        </div>
        <p className="text-muted-foreground text-sm">AI 모델을 준비하고 있어요...</p>
      </div>
    );
  }

  // 스테이지 진행률 (5개 가시 스테이지)
  const visibleStages = STAGE_ORDER.slice(1); // loading 제외
  const currentVisibleIdx = visibleStages.indexOf(displayedStage);
  const progress = ((currentVisibleIdx + 1) / visibleStages.length) * 100;

  return (
    <div className="mx-auto flex w-full max-w-sm flex-col items-center gap-5">
      {/* 프로그레스 바 — 미니멀 */}
      <div className="w-full max-w-[200px]">
        <div className="h-0.5 w-full overflow-hidden rounded-full bg-border">
          <div
            className="h-full rounded-full bg-foreground/60 transition-all duration-700 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Stage Content — 고정 높이로 프로그레스바 위치 안정화 */}
      <div className="flex min-h-[340px] w-full items-center justify-center sm:min-h-[380px]">
        <div
          className={cn(
            'w-full transition-all duration-450',
            transitioning ? 'animate-stage-exit' : 'animate-stage-enter',
          )}
        >
        {displayedStage === 'face-detection' && (
          <StageFaceDetection
            previewUrl={previewUrl}
            croppedFaceUrl={croppedFaceUrl}
            faceRect={faceRect}
          />
        )}
        {displayedStage === 'ai-analysis' && (
          <StageAiAnalysis
            croppedFaceUrl={croppedFaceUrl}
            previewUrl={previewUrl}
          />
        )}
        {displayedStage === 'position' && (
          <StagePosition
            croppedFaceUrl={croppedFaceUrl}
            previewUrl={previewUrl}
            positionResult={positionResult}
          />
        )}
        {displayedStage === 'team' && (
          <StageTeam
            teamResult={teamResult}
            isBaseballFace={isBaseballFace}
          />
        )}
        {displayedStage === 'matching' && (
          <StageMatching pendingMatches={pendingMatches} />
        )}
        </div>
      </div>
    </div>
  );
};
