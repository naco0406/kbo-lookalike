import { useCallback, useEffect, useState } from 'react';
import type { ScheduleGame } from './use-schedule';

// ── Types ─────────────────────────────────────────────────────────────────────

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
}

export interface UseMonthScheduleReturn {
  gamesByDate: Record<string, ScheduleGame[]>;
  loading: boolean;
  error: string | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

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

// ── Hook ──────────────────────────────────────────────────────────────────────

/**
 * 특정 월(YYYY-MM)의 전체 KBO 경기 일정을 로드한다.
 * - 운영: /api/schedule (Cloudflare Pages + KV)
 * - 개발 fallback: /data/schedule.json (정적 파일 symlink)
 */
export const useMonthSchedule = (month: string): UseMonthScheduleReturn => {
  const [gamesByDate, setGamesByDate] = useState<Record<string, ScheduleGame[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      let transformed: Record<string, ScheduleGame[]> = {};

      // 1차 시도: Cloudflare Pages Function (운영)
      try {
        const resp = await fetch(`/api/schedule?month=${month}`);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const data = (await resp.json()) as { gamesByDate: Record<string, RawGame[]> };
        for (const [date, rawGames] of Object.entries(data.gamesByDate)) {
          transformed[date] = rawGames.map(transformGame);
        }
      } catch {
        // 2차 시도: 정적 JSON 파일 (개발환경 symlink)
        const resp = await fetch('/data/schedule.json');
        if (!resp.ok) throw new Error('schedule data unavailable');
        const data = (await resp.json()) as { schedule: Record<string, RawGame[]> };
        for (const [date, rawGames] of Object.entries(data.schedule)) {
          if (date.startsWith(month)) {
            transformed[date] = rawGames.map(transformGame);
          }
        }
      }

      setGamesByDate(transformed);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
      setGamesByDate({});
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => {
    load();
  }, [load]);

  return { gamesByDate, loading, error };
};
