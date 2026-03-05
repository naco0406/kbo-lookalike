import type { FC, ReactNode, Dispatch } from 'react';
import { createContext, useContext, useReducer, useEffect } from 'react';
import type { AppState, AppAction } from '@/types/app-state';
import { appReducer } from '@/types/app-state';
import { persistResult, restoreResult, clearPersistedResult } from '@/lib/session-storage';

const StateContext = createContext<AppState | null>(null);
const DispatchContext = createContext<Dispatch<AppAction> | null>(null);

const INITIAL_STATE: AppState = { phase: 'idle' };

interface AppStateProviderProps {
  children: ReactNode;
}

export const AppStateProvider: FC<AppStateProviderProps> = ({ children }) => {
  const [state, dispatch] = useReducer(appReducer, INITIAL_STATE, () => {
    // 마운트 시 sessionStorage에서 result 복원 시도
    const persisted = restoreResult();
    if (persisted) {
      return {
        phase: 'result' as const,
        previewUrl: persisted.previewUrl,
        matches: persisted.matches,
      };
    }
    return INITIAL_STATE;
  });

  // result 상태 변경 시 sessionStorage에 저장
  useEffect(() => {
    if (state.phase === 'result') {
      persistResult({ previewUrl: state.previewUrl, matches: state.matches });
    } else if (state.phase === 'idle') {
      clearPersistedResult();
    }
  }, [state]);

  return (
    <StateContext value={state}>
      <DispatchContext value={dispatch}>{children}</DispatchContext>
    </StateContext>
  );
};

export const useAppState = (): AppState => {
  const state = useContext(StateContext);
  if (!state) throw new Error('useAppState must be used within AppStateProvider');
  return state;
};

export const useAppDispatch = (): Dispatch<AppAction> => {
  const dispatch = useContext(DispatchContext);
  if (!dispatch) throw new Error('useAppDispatch must be used within AppStateProvider');
  return dispatch;
};
