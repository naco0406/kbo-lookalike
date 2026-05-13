export type RecentGameResult = 'W' | 'L' | 'D';

export interface TeamStanding {
  rank: number;
  teamCode: string;
  teamName: string;
  shortName: string;
  games: number;
  wins: number;
  losses: number;
  draws: number;
  winRate: string;
  gamesBehind: string;
  recent10: string;
  streak: string;
  home: string;
  away: string;
  recentForm?: RecentGameResult[];
}

export interface StandingsResponse {
  updatedAt: string;
  source: 'kbo';
  standings: TeamStanding[];
}
