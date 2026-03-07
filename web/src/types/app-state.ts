import type { MatchResult, Classification, PositionClassification, TeamClassification } from '@/types/player';
import type { PipelineStep } from '@/ml/pipeline';

export type AppPhase = 'idle' | 'preview' | 'processing' | 'error' | 'result';

export type AppState =
  | { phase: 'idle' }
  | { phase: 'preview'; previewUrl: string; bitmap: ImageBitmap }
  | {
      phase: 'processing';
      previewUrl: string;
      bitmap: ImageBitmap;
      step: PipelineStep;
      faceRect?: { x: number; y: number; width: number; height: number };
      croppedFaceUrl?: string;
      positionResult?: PositionClassification;
      teamResult?: TeamClassification;
      isBaseballFace?: boolean;
      pendingMatches?: MatchResult[];
    }
  | { phase: 'error'; previewUrl: string; bitmap: ImageBitmap; errorType: ErrorType }
  | {
      phase: 'result';
      previewUrl: string;
      croppedFaceUrl?: string;
      alignedFaceUrl?: string;
      matches: MatchResult[];
      classification?: Classification;
    };

export type ErrorType = 'NO_FACE_DETECTED' | 'MODEL_LOAD_FAILED' | 'UNKNOWN';

export interface StepPayload {
  faceRect?: { x: number; y: number; width: number; height: number };
  croppedFaceUrl?: string;
  positionResult?: PositionClassification;
  teamResult?: TeamClassification;
  isBaseballFace?: boolean;
  pendingMatches?: MatchResult[];
}

export type AppAction =
  | { type: 'SELECT_IMAGE'; previewUrl: string; bitmap: ImageBitmap }
  | { type: 'START_ANALYSIS' }
  | { type: 'UPDATE_STEP'; step: PipelineStep; payload?: StepPayload }
  | {
      type: 'ANALYSIS_COMPLETE';
      matches: MatchResult[];
      croppedFaceUrl?: string;
      alignedFaceUrl?: string;
      classification?: Classification;
    }
  | { type: 'ANALYSIS_ERROR'; errorType: ErrorType }
  | { type: 'RESET' }
  | {
      type: 'RESTORE_RESULT';
      previewUrl: string;
      croppedFaceUrl?: string;
      alignedFaceUrl?: string;
      matches: MatchResult[];
      classification?: Classification;
    };

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
      return {
        ...state,
        step: action.step,
        ...(action.payload && {
          ...(action.payload.faceRect !== undefined && { faceRect: action.payload.faceRect }),
          ...(action.payload.croppedFaceUrl !== undefined && {
            croppedFaceUrl: action.payload.croppedFaceUrl,
          }),
          ...(action.payload.positionResult !== undefined && {
            positionResult: action.payload.positionResult,
          }),
          ...(action.payload.teamResult !== undefined && {
            teamResult: action.payload.teamResult,
          }),
          ...(action.payload.isBaseballFace !== undefined && {
            isBaseballFace: action.payload.isBaseballFace,
          }),
          ...(action.payload.pendingMatches !== undefined && {
            pendingMatches: action.payload.pendingMatches,
          }),
        }),
      };

    case 'ANALYSIS_COMPLETE':
      if (state.phase !== 'processing') return state;
      return {
        phase: 'result',
        previewUrl: state.previewUrl,
        croppedFaceUrl: action.croppedFaceUrl,
        alignedFaceUrl: action.alignedFaceUrl,
        matches: action.matches,
        classification: action.classification,
      };

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
      return {
        phase: 'result',
        previewUrl: action.previewUrl,
        croppedFaceUrl: action.croppedFaceUrl,
        alignedFaceUrl: action.alignedFaceUrl,
        matches: action.matches,
        classification: action.classification,
      };

    default:
      return state;
  }
};
