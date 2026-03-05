import type { FC } from 'react';
import { useMemo } from 'react';
import type { PipelineStep } from '@/ml/pipeline';
import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';

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
  progress: number; // 0–100 within this step
}

const getStepState = (step: Step, current: PipelineStep): StepState => {
  if (current === 'done') return { label: step.label, status: 'completed', progress: 100 };

  const idx = STEP_ORDER.indexOf(current);
  const first = STEP_ORDER.indexOf(step.keys[0]);
  const last = STEP_ORDER.indexOf(step.keys[step.keys.length - 1]);

  if (idx > last) return { label: step.label, status: 'completed', progress: 100 };
  if (idx >= first) {
    // 이 단계 내에서 몇 번째 sub-step인지 계산
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
    <div className="mx-auto flex w-full max-w-xs flex-col items-center pt-6 sm:pt-10 animate-in fade-in duration-300">
      {/* Photo */}
      <div className="animate-processing-breathe mb-8 h-40 w-40 overflow-hidden rounded-full shadow-xl sm:mb-10 sm:h-48 sm:w-48">
        <img src={previewUrl} alt="분석 중" className="h-full w-full object-cover" />
      </div>

      {/* Step list */}
      <div className="w-full space-y-4">
        {states.map((s) => (
          <div key={s.label} className="transition-all duration-500">
            {/* Label row */}
            <div
              className={cn(
                'mb-1.5 flex items-center justify-between text-sm',
                s.status === 'completed' && 'text-muted-foreground',
                s.status === 'active' && 'text-foreground',
                s.status === 'pending' && 'text-muted-foreground/30',
              )}
            >
              <span className={cn(s.status === 'active' && 'font-medium')}>
                {s.label}
              </span>
              {s.status === 'completed' && <Check className="h-3.5 w-3.5" />}
            </div>

            {/* Per-step progress bar */}
            <div
              className={cn(
                'h-[3px] w-full overflow-hidden rounded-full transition-colors duration-500',
                s.status === 'pending' ? 'bg-border/50' : 'bg-border',
              )}
            >
              <div
                className={cn(
                  'h-full rounded-full transition-[width] duration-700 ease-out',
                  s.status === 'completed' && 'bg-foreground/30',
                  s.status === 'active' && 'bg-foreground',
                  s.status === 'pending' && 'bg-transparent',
                )}
                style={{ width: `${s.progress}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
