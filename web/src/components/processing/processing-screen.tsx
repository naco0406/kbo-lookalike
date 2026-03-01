import type { FC } from 'react';
import type { PipelineStep } from '@/ml/pipeline';
import { Progress } from '@/components/ui/progress';

const STEP_INFO: Record<string, { label: string; progress: number }> = {
  'loading-models': { label: 'AI 모델 로딩 중...', progress: 10 },
  'loading-data': { label: '선수 데이터 로딩 중...', progress: 25 },
  'detecting-face': { label: '얼굴 검출 중...', progress: 45 },
  'aligning-face': { label: '얼굴 정렬 중...', progress: 60 },
  'extracting-embedding': { label: '특징 추출 중...', progress: 75 },
  searching: { label: '닮은꼴 검색 중...', progress: 90 },
  done: { label: '완료!', progress: 100 },
};

interface ProcessingScreenProps {
  step: PipelineStep;
  previewUrl: string;
}

export const ProcessingScreen: FC<ProcessingScreenProps> = ({ step, previewUrl }) => {
  const info = STEP_INFO[step] ?? { label: '처리 중...', progress: 0 };

  return (
    <div className="mx-auto flex w-full max-w-sm flex-col items-center gap-6 py-8">
      <div className="border-primary/20 h-40 w-40 overflow-hidden rounded-full border-4">
        <img src={previewUrl} alt="업로드한 사진" className="h-full w-full object-cover" />
      </div>

      <div className="w-full space-y-3">
        <Progress value={info.progress} className="h-2" />
        <p className="text-muted-foreground text-center text-sm">{info.label}</p>
      </div>
    </div>
  );
};
