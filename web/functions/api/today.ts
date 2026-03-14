/**
 * GET /api/today?date=2026-03-12
 *
 * 오늘 날짜: Naver Schedule API → Cache API (60s) → 응답 + KV write-through
 * 과거/미래:  KV에서 읽기 (Cache API 5분)
 *
 * 오늘 날짜 요청 시 Naver API에서 실시간 상태(live/completed/score)를 가져오므로
 * 프론트가 60초 이내의 최신 상태를 볼 수 있고, KV도 자동 갱신된다.
 */

interface Env {
  KV: KVNamespace;
}

const NAVER_SCHEDULE_API = 'https://api-gw.sports.naver.com/schedule/games';
const NAVER_HEADERS = {
  'Origin': 'https://m.sports.naver.com',
  'Referer': 'https://m.sports.naver.com/kbaseball/schedule/index',
  'Accept': 'application/json',
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
};

const STATUS_MAP: Record<string, string> = {
  BEFORE: 'upcoming',
  LIVE: 'live',
  RESULT: 'completed',
};

const toKSTDateString = (): string => {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(new Date());
};

const transformGame = (raw: Record<string, unknown>): Record<string, unknown> => {
  let status: string;
  if (raw.cancel) {
    status = 'cancelled';
  } else if (raw.suspended) {
    status = 'suspended';
  } else {
    status = STATUS_MAP[raw.statusCode as string] ?? 'upcoming';
  }

  const away: Record<string, unknown> = { code: raw.awayTeamCode };
  const home: Record<string, unknown> = { code: raw.homeTeamCode };

  if (status === 'live' || status === 'completed') {
    away.score = raw.awayTeamScore;
    home.score = raw.homeTeamScore;
  }

  const game: Record<string, unknown> = {
    id: raw.gameId,
    date: raw.gameDate,
    time: (raw.gameDateTime as string).split('T')[1]?.slice(0, 5) ?? '',
    venue: raw.stadium ?? '',
    status,
    away,
    home,
  };

  if (status === 'live' && raw.statusInfo) {
    game.inning = raw.statusInfo;
  }

  if (raw.broadChannel) {
    game.broadcast = raw.broadChannel;
  }

  if (raw.roundCode) {
    game.roundCode = raw.roundCode;
  }

  return game;
};

/**
 * Naver Schedule API에서 특정 날짜의 경기 목록을 가져와 우리 스키마로 변환한다.
 */
const fetchFromNaver = async (date: string): Promise<Record<string, unknown>[] | null> => {
  const params = new URLSearchParams({
    fields: 'basic,schedule,baseball,manualRelayUrl',
    upperCategoryId: 'kbaseball',
    categoryId: 'kbo',
    fromDate: date,
    toDate: date,
    roundCodes: '',
    size: '500',
  });

  const resp = await fetch(`${NAVER_SCHEDULE_API}?${params}`, { headers: NAVER_HEADERS });
  if (!resp.ok) return null;

  const data = (await resp.json()) as Record<string, unknown>;
  if (!data.success) return null;

  const result = data.result as Record<string, unknown>;
  const rawGames = (result?.games ?? []) as Record<string, unknown>[];

  return rawGames.map(transformGame);
};

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const url = new URL(request.url);
  const today = toKSTDateString();
  const date = url.searchParams.get('date') ?? today;
  const isToday = date === today;

  // ── 오늘이 아닌 날짜: 기존 KV 조회 ──────────────────────────────────
  if (!isToday) {
    const key = `schedule:${date}`;
    const cached = await env.KV.get(key);

    if (!cached) {
      return Response.json(
        { date, games: [], message: '해당 날짜의 경기 일정이 없습니다.' },
        {
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'public, s-maxage=300',
          },
        },
      );
    }

    return Response.json(
      { date, games: JSON.parse(cached) },
      {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'public, s-maxage=300',
        },
      },
    );
  }

  // ── 오늘 날짜: Cache API → Naver API → KV write-through ────────────
  const cache = caches.default;
  const cacheKey = new Request(`https://kbo-schedule-cache/${date}`);
  const cachedResp = await cache.match(cacheKey);
  if (cachedResp) return cachedResp;

  // Naver API 호출
  let games: Record<string, unknown>[];
  try {
    const result = await fetchFromNaver(date);
    games = result ?? [];
  } catch {
    // Naver API 실패 시 KV fallback
    const kvData = await env.KV.get(`schedule:${date}`);
    games = kvData ? (JSON.parse(kvData) as Record<string, unknown>[]) : [];
  }

  const response = Response.json(
    { date, games },
    {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 's-maxage=60, stale-while-revalidate=30',
      },
    },
  );

  // Cache API + KV write-through (비동기)
  context.waitUntil(
    Promise.all([
      cache.put(cacheKey, response.clone()),
      env.KV.put(`schedule:${date}`, JSON.stringify(games)),
    ]),
  );

  return response;
};
