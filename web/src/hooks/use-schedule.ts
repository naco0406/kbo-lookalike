import { useCallback, useEffect, useState } from 'react';

// ── Types ────────────────────────────────────────────────────────────────────

interface RawGame {
  id: string;
  date: string;
  time: string;
  venue: string;
  status: 'upcoming' | 'live' | 'completed' | 'cancelled' | 'suspended';
  away: { code: string; score?: number };
  home: { code: string; score?: number };
  inning?: string;
  broadcast?: string;
  roundCode?: string;
}

export interface ScheduleGame {
  id: string;
  date: string;
  time: string;
  venue: string;
  status: 'upcoming' | 'live' | 'completed' | 'cancelled' | 'suspended';
  awayCode: string;
  homeCode: string;
  awayScore?: number;
  homeScore?: number;
  inning?: string;
  broadcast?: string;
}

interface UseScheduleReturn {
  games: ScheduleGame[];
  loading: boolean;
  error: string | null;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const transformGame = (raw: RawGame): ScheduleGame => ({
  id: raw.id,
  date: raw.date,
  time: raw.time,
  venue: raw.venue,
  status: raw.status,
  awayCode: raw.away.code,
  homeCode: raw.home.code,
  awayScore: raw.away.score,
  homeScore: raw.home.score,
  inning: raw.inning,
  broadcast: raw.broadcast,
});

// ── Hook ─────────────────────────────────────────────────────────────────────

/**
 * 오늘 날짜의 KBO 경기 일정을 /api/today에서 로드한다.
 * Pages Function → KV 경유.
 */
export const useSchedule = (): UseScheduleReturn => {
  const [games, setGames] = useState<ScheduleGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const resp = await fetch('/api/today');
      if (!resp.ok) throw new Error(`Schedule fetch failed: ${resp.status}`);

      const data = await resp.json() as { games: RawGame[] };
      setGames((data.games ?? []).map(transformGame));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
      setGames([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { games, loading, error };
};
