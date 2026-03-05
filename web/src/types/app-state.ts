import type { MatchResult } from '@/types/player';
import type { PipelineStep } from '@/ml/pipeline';

export type AppPhase = 'idle' | 'preview' | 'processing' | 'error' | 'result';

export type AppState =
  | { phase: 'idle' }
  | { phase: 'preview'; previewUrl: string; bitmap: ImageBitmap }
  | { phase: 'processing'; previewUrl: string; bitmap: ImageBitmap; step: PipelineStep }
  | { phase: 'error'; previewUrl: string; bitmap: ImageBitmap; errorType: ErrorType }
  | { phase: 'result'; previewUrl: string; matches: MatchResult[] };

export type ErrorType = 'NO_FACE_DETECTED' | 'MODEL_LOAD_FAILED' | 'UNKNOWN';

export type AppAction =
  | { type: 'SELECT_IMAGE'; previewUrl: string; bitmap: ImageBitmap }
  | { type: 'START_ANALYSIS' }
  | { type: 'UPDATE_STEP'; step: PipelineStep }
  | { type: 'ANALYSIS_COMPLETE'; matches: MatchResult[] }
  | { type: 'ANALYSIS_ERROR'; errorType: ErrorType }
  | { type: 'RESET' }
  | { type: 'RESTORE_RESULT'; previewUrl: string; matches: MatchResult[] };

export const appReducer = (state: AppState, action: AppAction): AppState => {
  switch (action.type) {
    case 'SELECT_IMAGE':
      return { phase: 'preview', previewUrl: action.previewUrl, bitmap: action.bitmap };

    case 'START_ANALYSIS':
      if (state.phase !== 'preview' && state.phase !== 'error') return state;
      return {
        phase: 'processing',
        previewUrl: state.previewUrl,
        bitmap: state.bitmap,
        step: 'loading-models',
      };

    case 'UPDATE_STEP':
      if (state.phase !== 'processing') return state;
      return { ...state, step: action.step };

    case 'ANALYSIS_COMPLETE':
      if (state.phase !== 'processing') return state;
      return { phase: 'result', previewUrl: state.previewUrl, matches: action.matches };

    case 'ANALYSIS_ERROR':
      if (state.phase !== 'processing') return state;
      return {
        phase: 'error',
        previewUrl: state.previewUrl,
        bitmap: state.bitmap,
        errorType: action.errorType,
      };

    case 'RESET':
      return { phase: 'idle' };

    case 'RESTORE_RESULT':
      return { phase: 'result', previewUrl: action.previewUrl, matches: action.matches };

    default:
      return state;
  }
};
