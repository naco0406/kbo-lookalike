/**
 * Admin console API 클라이언트.
 * Pages Function을 통해 KV에 접근하므로 별도 인증 불필요.
 */

export interface Game {
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

// ── API calls ────────────────────────────────────────────────────────────────

export const fetchDates = async (year = 2026): Promise<string[]> => {
  const resp = await fetch(`/api/schedule/dates?year=${year}`);
  if (!resp.ok) throw new Error(`Failed to fetch dates: ${resp.status}`);
  const data = await resp.json() as { dates: string[] };
  return data.dates;
};

export const fetchGames = async (date: string): Promise<Game[]> => {
  const resp = await fetch(`/api/schedule/${date}`);
  if (resp.status === 404) return [];
  if (!resp.ok) throw new Error(`Failed to fetch games: ${resp.status}`);
  const data = await resp.json() as { games: Game[] };
  return data.games;
};

export const saveGames = async (date: string, games: Game[]): Promise<void> => {
  const resp = await fetch(`/api/schedule/${date}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ games }),
  });
  if (!resp.ok) throw new Error(`Failed to save games: ${resp.status}`);
};

export const deleteDate = async (date: string): Promise<void> => {
  const resp = await fetch(`/api/schedule/${date}`, { method: 'DELETE' });
  if (!resp.ok) throw new Error(`Failed to delete date: ${resp.status}`);
};
