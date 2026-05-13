/**
 * GET /api/standings
 *
 * 공식 KBO 팀 순위 페이지에서 순위표를 가져온다.
 * 최근 5경기 순서는 KV에 쌓인 완료 경기 일정이 충분할 때만 계산한다.
 */

interface Env {
  KV: KVNamespace;
}

type RecentGameResult = 'W' | 'L' | 'D';

interface TeamStanding {
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

interface RawGame {
  id: string;
  date: string;
  time: string;
  status: string;
  roundCode?: string;
  away: { code: string; score?: number };
  home: { code: string; score?: number };
}

const KBO_TEAM_RANK_URL = 'https://www.koreabaseball.com/Record/TeamRank/TeamRank.aspx';
const NAVER_SCHEDULE_API = 'https://api-gw.sports.naver.com/schedule/games';

const KBO_HEADERS = {
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
};

const NAVER_HEADERS = {
  Origin: 'https://m.sports.naver.com',
  Referer: 'https://m.sports.naver.com/kbaseball/schedule/index',
  Accept: 'application/json',
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
};

const TEAM_NAME_TO_CODE: Record<string, { code: string; shortName: string; name: string }> = {
  KT: { code: 'KT', shortName: 'KT', name: 'KT WIZ' },
  LG: { code: 'LG', shortName: 'LG', name: 'LG 트윈스' },
  SSG: { code: 'SK', shortName: 'SSG', name: 'SSG 랜더스' },
  삼성: { code: 'SS', shortName: '삼성', name: '삼성 라이온즈' },
  NC: { code: 'NC', shortName: 'NC', name: 'NC 다이노스' },
  KIA: { code: 'HT', shortName: 'KIA', name: 'KIA 타이거즈' },
  두산: { code: 'OB', shortName: '두산', name: '두산 베어스' },
  한화: { code: 'HH', shortName: '한화', name: '한화 이글스' },
  롯데: { code: 'LT', shortName: '롯데', name: '롯데 자이언츠' },
  키움: { code: 'WO', shortName: '키움', name: '키움 히어로즈' },
};

const stripTags = (value: string): string =>
  value
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();

const toNumber = (value: string): number => Number(value.replace(/,/g, '')) || 0;

const parseStandings = (html: string): TeamStanding[] => {
  const rows = [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)];

  return rows
    .map((row) => {
      const cells = [...row[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((cell) =>
        stripTags(cell[1]),
      );

      if (cells.length < 12 || !/^\d+$/.test(cells[0])) return null;

      const team = TEAM_NAME_TO_CODE[cells[1]];
      if (!team) return null;

      return {
        rank: toNumber(cells[0]),
        teamCode: team.code,
        teamName: team.name,
        shortName: team.shortName,
        games: toNumber(cells[2]),
        wins: toNumber(cells[3]),
        losses: toNumber(cells[4]),
        draws: toNumber(cells[5]),
        winRate: cells[6],
        gamesBehind: cells[7],
        recent10: cells[8],
        streak: cells[9],
        home: cells[10],
        away: cells[11],
      } satisfies TeamStanding;
    })
    .filter((standing): standing is TeamStanding => standing !== null);
};

const toKSTDateString = (): string =>
  new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(new Date());

const toDateString = (date: Date): string => date.toISOString().slice(0, 10);

const addDays = (date: string, days: number): string => {
  const next = new Date(`${date}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + days);
  return toDateString(next);
};

const getGameResult = (game: RawGame, teamCode: string): RecentGameResult | null => {
  if (game.status !== 'completed') return null;
  if (game.away.score === undefined || game.home.score === undefined) return null;

  const isAway = game.away.code === teamCode;
  const isHome = game.home.code === teamCode;
  if (!isAway && !isHome) return null;

  if (game.away.score === game.home.score) return 'D';
  const teamWon = isAway ? game.away.score > game.home.score : game.home.score > game.away.score;

  return teamWon ? 'W' : 'L';
};

const buildRecentForms = async (
  env: Env,
  standings: TeamStanding[],
): Promise<Record<string, RecentGameResult[]>> => {
  const today = toKSTDateString();
  const year = today.slice(0, 4);
  const indexRaw = await env.KV.get(`schedule:dates:${year}`);
  if (!indexRaw) return {};

  const dates = (JSON.parse(indexRaw) as string[])
    .filter((date) => date <= today)
    .sort()
    .reverse();

  const forms: Record<string, RecentGameResult[]> = {};
  const teamCodes = standings.map((team) => team.teamCode);

  for (const date of dates) {
    if (teamCodes.every((code) => (forms[code]?.length ?? 0) >= 5)) break;

    const raw = await env.KV.get(`schedule:${date}`);
    if (!raw) continue;

    const games = (JSON.parse(raw) as RawGame[])
      .filter((game) => game.roundCode !== 'kbo_e')
      .sort((a, b) => b.id.localeCompare(a.id));

    for (const game of games) {
      for (const teamCode of [game.away.code, game.home.code]) {
        if ((forms[teamCode]?.length ?? 0) >= 5) continue;

        const result = getGameResult(game, teamCode);
        if (!result) continue;

        forms[teamCode] = [...(forms[teamCode] ?? []), result];
      }
    }
  }

  return Object.fromEntries(Object.entries(forms).filter(([, form]) => form.length >= 5));
};

const transformNaverGame = (raw: Record<string, unknown>): RawGame | null => {
  const statusCode = raw.statusCode as string | undefined;
  if (statusCode !== 'RESULT' && statusCode !== 'ENDED') return null;

  const awayScore = Number(raw.awayTeamScore);
  const homeScore = Number(raw.homeTeamScore);
  if (!Number.isFinite(awayScore) || !Number.isFinite(homeScore)) return null;

  return {
    id: raw.gameId as string,
    date: raw.gameDate as string,
    time: (raw.gameDateTime as string | undefined)?.split('T')[1]?.slice(0, 5) ?? '',
    status: 'completed',
    roundCode: raw.roundCode as string | undefined,
    away: {
      code: raw.awayTeamCode as string,
      score: awayScore,
    },
    home: {
      code: raw.homeTeamCode as string,
      score: homeScore,
    },
  };
};

const fetchNaverGames = async (fromDate: string, toDate: string): Promise<RawGame[]> => {
  const params = new URLSearchParams({
    fields: 'basic,schedule,baseball,manualRelayUrl',
    upperCategoryId: 'kbaseball',
    categoryId: 'kbo',
    fromDate,
    toDate,
    roundCodes: '',
    size: '500',
  });

  const resp = await fetch(`${NAVER_SCHEDULE_API}?${params}`, { headers: NAVER_HEADERS });
  if (!resp.ok) return [];

  const data = (await resp.json()) as Record<string, unknown>;
  if (!data.success) return [];

  const result = data.result as Record<string, unknown>;
  const rawGames = (result?.games ?? []) as Record<string, unknown>[];

  return rawGames
    .map(transformNaverGame)
    .filter((game): game is RawGame => game !== null && game.roundCode !== 'kbo_e');
};

const appendRecentForms = (
  forms: Record<string, RecentGameResult[]>,
  games: RawGame[],
  teamCodes: string[],
): Record<string, RecentGameResult[]> => {
  const next = { ...forms };
  const sortedGames = [...games].sort((a, b) => {
    const byDate = b.date.localeCompare(a.date);
    if (byDate !== 0) return byDate;
    return b.id.localeCompare(a.id);
  });

  for (const game of sortedGames) {
    for (const teamCode of [game.away.code, game.home.code]) {
      if (!teamCodes.includes(teamCode)) continue;
      if ((next[teamCode]?.length ?? 0) >= 5) continue;

      const result = getGameResult(game, teamCode);
      if (!result) continue;

      next[teamCode] = [...(next[teamCode] ?? []), result];
    }
  }

  return next;
};

const buildRecentFormsFromNaver = async (
  standings: TeamStanding[],
  existingForms: Record<string, RecentGameResult[]>,
): Promise<Record<string, RecentGameResult[]>> => {
  const today = toKSTDateString();
  const teamCodes = standings.map((team) => team.teamCode);
  let forms = { ...existingForms };
  let toDate = today;

  for (let window = 0; window < 4; window += 1) {
    if (teamCodes.every((code) => (forms[code]?.length ?? 0) >= 5)) break;

    const fromDate = addDays(toDate, -44);
    const games = await fetchNaverGames(fromDate, toDate);
    forms = appendRecentForms(forms, games, teamCodes);
    toDate = addDays(fromDate, -1);
  }

  return Object.fromEntries(Object.entries(forms).filter(([, form]) => form.length >= 5));
};

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  const resp = await fetch(KBO_TEAM_RANK_URL, { headers: KBO_HEADERS });
  if (!resp.ok) {
    return Response.json({ error: 'KBO standings unavailable' }, { status: 502 });
  }

  const html = await resp.text();
  const standings = parseStandings(html);
  if (standings.length === 0) {
    return Response.json({ error: 'KBO standings parse failed' }, { status: 502 });
  }

  const kvRecentForms = await buildRecentForms(env, standings).catch(() => ({}));
  const recentForms = await buildRecentFormsFromNaver(standings, kvRecentForms).catch(
    () => kvRecentForms,
  );

  return Response.json(
    {
      updatedAt: new Date().toISOString(),
      source: 'kbo',
      standings: standings.map((team) => ({
        ...team,
        recentForm: recentForms[team.teamCode],
      })),
    },
    {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=120',
      },
    },
  );
};
