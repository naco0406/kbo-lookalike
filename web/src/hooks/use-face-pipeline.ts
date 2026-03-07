import { useCallback } from 'react';
import { useAppState, useAppDispatch } from '@/context/app-state-context';
import { runPipeline } from '@/ml/pipeline';
import { imageDataToUrl } from '@/ml/face-crop';
import type { PipelineStep } from '@/ml/pipeline';
import type { ErrorType, StepPayload } from '@/types/app-state';

// 6개 통합 단계 — UI Stage에 대응
const CONSOLIDATED_GROUPS: PipelineStep[][] = [
  ['loading-models', 'loading-data'],
  ['detecting-face', 'cropping-face'],
  ['aligning-face', 'extracting-embedding'],
  ['classifying-position'],
  ['classifying-team', 'checking-baseball-face'],
  ['searching'],
];

// 각 그룹별 최소 표시 시간 (ms) — 총 ~12초
const MIN_GROUP_MS = [600, 1800, 2200, 2000, 2000, 3500];
const MIN_TOTAL_MS = 12000;

const getGroupIndex = (step: PipelineStep): number =>
  CONSOLIDATED_GROUPS.findIndex((g) => g.includes(step));

const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export const useFacePipeline = () => {
  const state = useAppState();
  const dispatch = useAppDispatch();

  /** 핵심 분석 로직 — bitmap을 직접 받아 파이프라인 실행 */
  const runAnalysis = useCallback(async (bitmap: ImageBitmap) => {
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
      let groupEnteredAt = Date.now();

      for (const step of collectedSteps) {
        const group = getGroupIndex(step);

        if (group !== currentGroup) {
          // 새 통합 단계 진입 — 이전 단계가 최소 시간 채우도록 대기
          if (currentGroup >= 0) {
            const minMs = MIN_GROUP_MS[currentGroup] ?? 600;
            const elapsed = Date.now() - groupEnteredAt;
            if (elapsed < minMs) {
              await delay(minMs - elapsed);
            }
          }
          currentGroup = group;
          groupEnteredAt = Date.now();
        }

        // 중간 결과를 payload로 첨부
        let payload: StepPayload | undefined;

        if (step === 'cropping-face') {
          payload = {
            faceRect: res.faceRect,
            croppedFaceUrl: res.croppedFaceUrl,
          };
        } else if (step === 'classifying-position') {
          payload = {
            positionResult: res.classification.position,
          };
        } else if (step === 'checking-baseball-face') {
          payload = {
            teamResult: res.classification.team,
            isBaseballFace: res.classification.isBaseballFace,
          };
        } else if (step === 'searching') {
          payload = {
            pendingMatches: res.matches,
          };
        }

        dispatch({ type: 'UPDATE_STEP', step, payload });
      }

      // 3) 마지막 단계도 최소 시간 보장 + 전체 최소 시간 보장
      const lastGroupMin = MIN_GROUP_MS[currentGroup] ?? 600;
      const lastGroupElapsed = Date.now() - groupEnteredAt;
      const totalElapsed = Date.now() - startedAt;

      const remaining = Math.max(
        lastGroupMin - lastGroupElapsed,
        MIN_TOTAL_MS - totalElapsed,
      );
      if (remaining > 0) {
        await delay(remaining);
      }

      const alignedFaceUrl = imageDataToUrl(res.alignedFace);

      dispatch({
        type: 'ANALYSIS_COMPLETE',
        matches: res.matches,
        croppedFaceUrl: res.croppedFaceUrl,
        alignedFaceUrl,
        classification: res.classification,
      });
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
  }, [dispatch]);

  /** preview/error 상태에서 분석 시작 */
  const run = useCallback(async () => {
    if (state.phase !== 'preview' && state.phase !== 'error') return;
    await runAnalysis(state.bitmap);
  }, [state, runAnalysis]);

  /** 이미지 선택 → preview 상태로 */
  const selectImage = useCallback(
    (bitmap: ImageBitmap, previewUrl: string) => {
      dispatch({ type: 'SELECT_IMAGE', previewUrl, bitmap });
    },
    [dispatch],
  );

  /** 이미지 선택 + 즉시 분석 시작 (카메라 캡처 확인 시) */
  const selectAndRun = useCallback(
    (bitmap: ImageBitmap, previewUrl: string) => {
      dispatch({ type: 'SELECT_IMAGE', previewUrl, bitmap });
      runAnalysis(bitmap);
    },
    [dispatch, runAnalysis],
  );

  const reset = useCallback(() => {
    dispatch({ type: 'RESET' });
  }, [dispatch]);

  return { state, run, selectImage, selectAndRun, reset };
};
