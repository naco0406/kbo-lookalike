import { useState, useCallback } from 'react';
import { runPipeline, type PipelineStep, type PipelineResult } from '@/ml/pipeline';

interface UseFacePipelineReturn {
  step: PipelineStep | null;
  result: PipelineResult | null;
  error: string | null;
  run: (image: ImageBitmap) => Promise<void>;
  reset: () => void;
}

export const useFacePipeline = (): UseFacePipelineReturn => {
  const [step, setStep] = useState<PipelineStep | null>(null);
  const [result, setResult] = useState<PipelineResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async (image: ImageBitmap) => {
    setError(null);
    setResult(null);
    try {
      const res = await runPipeline(image, setStep);
      setResult(res);
    } catch (e) {
      console.error('[FacePipeline] Error:', e);
      setStep('error');
      if (e instanceof Error && e.message === 'NO_FACE_DETECTED') {
        setError('얼굴을 찾을 수 없습니다. 다른 사진을 시도해주세요.');
      } else {
        setError('분석 중 오류가 발생했습니다. 다시 시도해주세요.');
      }
    }
  }, []);

  const reset = useCallback(() => {
    setStep(null);
    setResult(null);
    setError(null);
  }, []);

  return { step, result, error, run, reset };
};
