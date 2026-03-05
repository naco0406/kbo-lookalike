import { useCallback } from 'react';
import { useAppState, useAppDispatch } from '@/context/app-state-context';
import { runPipeline } from '@/ml/pipeline';
import type { PipelineStep } from '@/ml/pipeline';
import type { ErrorType } from '@/types/app-state';

// 3개 통합 단계의 경계 — 각 단계가 최소 이만큼 보이도록 보장
const CONSOLIDATED_GROUPS: PipelineStep[][] = [
  ['loading-models', 'loading-data'],
  ['detecting-face', 'aligning-face', 'extracting-embedding'],
  ['searching'],
];

const MIN_GROUP_MS = 600;
const MIN_TOTAL_MS = 2200;

const getGroupIndex = (step: PipelineStep): number =>
  CONSOLIDATED_GROUPS.findIndex((g) => g.includes(step));

const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export const useFacePipeline = () => {
  const state = useAppState();
  const dispatch = useAppDispatch();

  const run = useCallback(async () => {
    if (state.phase !== 'preview' && state.phase !== 'error') return;
    const { bitmap } = state;

    dispatch({ type: 'START_ANALYSIS' });
    const startedAt = Date.now();

    try {
      // 1) 파이프라인 실행 — 단계는 버퍼에 수집
      const collectedSteps: PipelineStep[] = [];
      const res = await runPipeline(bitmap, (step) => {
        if (step !== 'done') collectedSteps.push(step);
      });

      // 2) 워터폴 replay — 통합 단계별 최소 표시 시간 보장
      let currentGroup = -1;

      for (const step of collectedSteps) {
        const group = getGroupIndex(step);

        if (group !== currentGroup) {
          // 새 통합 단계 진입 — 이전 단계가 최소 시간 채우도록 대기
          if (currentGroup >= 0) {
            await delay(MIN_GROUP_MS);
          }
          currentGroup = group;
        }

        dispatch({ type: 'UPDATE_STEP', step });
      }

      // 3) 마지막 단계도 최소 시간 보장 + 전체 최소 시간 보장
      const remaining = Math.max(
        MIN_GROUP_MS,
        MIN_TOTAL_MS - (Date.now() - startedAt),
      );
      await delay(remaining);

      dispatch({ type: 'ANALYSIS_COMPLETE', matches: res.matches });
    } catch (e) {
      console.error('[FacePipeline] Error:', e);
      let errorType: ErrorType = 'UNKNOWN';
      if (e instanceof Error) {
        if (e.message === 'NO_FACE_DETECTED') errorType = 'NO_FACE_DETECTED';
        else if (e.message.includes('model') || e.message.includes('fetch'))
          errorType = 'MODEL_LOAD_FAILED';
      }
      dispatch({ type: 'ANALYSIS_ERROR', errorType });
    }
  }, [state, dispatch]);

  const selectImage = useCallback(
    (bitmap: ImageBitmap, previewUrl: string) => {
      dispatch({ type: 'SELECT_IMAGE', previewUrl, bitmap });
    },
    [dispatch],
  );

  const reset = useCallback(() => {
    dispatch({ type: 'RESET' });
  }, [dispatch]);

  return { state, run, selectImage, reset };
};
