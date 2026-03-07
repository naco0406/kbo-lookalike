import type { FC } from 'react';
import { useMemo } from 'react';
import type { PipelineStep } from '@/ml/pipeline';
import { cn } from '@/lib/utils';
import { Check, Loader2 } from 'lucide-react';

interface Step {
  label: string;
  keys: PipelineStep[];
}

const STEPS: Step[] = [
  { label: 'AI 모델 준비', keys: ['loading-models', 'loading-data'] },
  { label: '얼굴 분석', keys: ['detecting-face', 'aligning-face', 'extracting-embedding'] },
  { label: '닮은꼴 검색', keys: ['searching'] },
];

const STEP_ORDER: PipelineStep[] = [
  'loading-models',
  'loading-data',
  'detecting-face',
  'aligning-face',
  'extracting-embedding',
  'searching',
];

type Status = 'pending' | 'active' | 'completed';

interface StepState {
  label: string;
  status: Status;
  progress: number;
}

const getStepState = (step: Step, current: PipelineStep): StepState => {
  if (current === 'done') return { label: step.label, status: 'completed', progress: 100 };

  const idx = STEP_ORDER.indexOf(current);
  const first = STEP_ORDER.indexOf(step.keys[0]);
  const last = STEP_ORDER.indexOf(step.keys[step.keys.length - 1]);

  if (idx > last) return { label: step.label, status: 'completed', progress: 100 };
  if (idx >= first) {
    const posInStep = idx - first;
    const totalSubSteps = step.keys.length;
    const progress = Math.round(((posInStep + 0.5) / totalSubSteps) * 100);
    return { label: step.label, status: 'active', progress };
  }
  return { label: step.label, status: 'pending', progress: 0 };
};

interface ProcessingScreenProps {
  step: PipelineStep;
  previewUrl: string;
}

export const ProcessingScreen: FC<ProcessingScreenProps> = ({ step, previewUrl }) => {
  const states = useMemo(() => STEPS.map((s) => getStepState(s, step)), [step]);

  return (
    <div className="mx-auto flex w-full max-w-[260px] flex-col items-center animate-in fade-in duration-300">
      {/* 사진 + 링 애니메이션 */}
      <div className="relative mb-10">
        <div className="animate-processing-breathe h-32 w-32 overflow-hidden rounded-full shadow-xl sm:h-40 sm:w-40">
          <img src={previewUrl} alt="분석 중" className="h-full w-full object-cover" />
        </div>
        {/* 회전하는 링 */}
        <div
          className="absolute -inset-2.5 animate-spin rounded-full border-2 border-transparent border-t-foreground/15"
          style={{ animationDuration: '3s' }}
        />
      </div>

      {/* 단계 리스트 */}
      <div className="w-full space-y-1">
        {states.map((s, i) => (
          <div
            key={s.label}
            className={cn(
              'flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 transition-all duration-500',
              s.status === 'active' && 'bg-card shadow-sm',
            )}
          >
            {/* 아이콘 — 통일된 24px 컨테이너 */}
            <div className="flex h-5 w-5 shrink-0 items-center justify-center">
              {s.status === 'completed' ? (
                <div className="flex h-5 w-5 items-center justify-center rounded-full bg-foreground/10">
                  <Check className="h-3 w-3 text-foreground" />
                </div>
              ) : s.status === 'active' ? (
                <Loader2 className="h-4 w-4 animate-spin text-foreground" />
              ) : (
                <span className="text-muted-foreground/30 text-[11px] font-medium tabular-nums">{i + 1}</span>
              )}
            </div>

            {/* 라벨 */}
            <span
              className={cn(
                'text-[13px] transition-colors duration-300',
                s.status === 'completed' && 'text-muted-foreground',
                s.status === 'active' && 'font-medium text-foreground',
                s.status === 'pending' && 'text-muted-foreground/40',
              )}
            >
              {s.label}
            </span>

            {/* 진행 바 (active만) */}
            {s.status === 'active' && (
              <div className="ml-auto h-1 w-10 overflow-hidden rounded-full bg-border">
                <div
                  className="h-full rounded-full bg-foreground transition-[width] duration-700 ease-out"
                  style={{ width: `${s.progress}%` }}
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
