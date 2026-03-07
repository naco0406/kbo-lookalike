import type { MatchResult, Classification } from '@/types/player';

const STORAGE_KEY = 'kbo-lookalike-result';

interface PersistedResult {
  previewUrl: string;
  croppedFaceUrl?: string;
  matches: MatchResult[];
  classification?: Classification;
}

export const persistResult = (data: PersistedResult): void => {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // quota exceeded or private browsing — silently fail
  }
};

export const restoreResult = (): PersistedResult | null => {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedResult;
    if (!parsed.previewUrl || !Array.isArray(parsed.matches) || parsed.matches.length === 0) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
};

export const clearPersistedResult = (): void => {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // silently fail
  }
};
