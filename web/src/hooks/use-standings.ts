import { useCallback, useEffect, useState } from 'react';
import type { StandingsResponse, TeamStanding } from '@/types/standings';

interface UseStandingsReturn {
  standings: TeamStanding[];
  updatedAt: string | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export const useStandings = (): UseStandingsReturn => {
  const [standings, setStandings] = useState<TeamStanding[]>([]);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const resp = await fetch('/api/standings');
      if (!resp.ok) throw new Error(`Standings fetch failed: ${resp.status}`);

      const data = (await resp.json()) as StandingsResponse;
      setStandings(data.standings ?? []);
      setUpdatedAt(data.updatedAt ?? null);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
      setStandings([]);
      setUpdatedAt(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { standings, updatedAt, loading, error, refresh: load };
};
