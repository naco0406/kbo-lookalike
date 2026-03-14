/**
 * GET /api/relay/live/:gameId?inning=N
 *
 * 실시간 경기 중계 프록시 — Naver game-polling API → Cache API (30s TTL)
 * 동일 게임+이닝 요청은 30초간 1회만 Naver API를 호출한다.
 */

// eslint-disable-next-line @typescript-eslint/no-empty-interface
interface Env {}

const NAVER_API = 'https://api-gw.sports.naver.com/schedule/games';
const CACHE_TTL = 30;

/**
 * game-polling 응답을 기존 RelayApiResponse 포맷으로 변환한다.
 * 기존 game-detail-modal이 동일 UI로 라이브 데이터를 표시할 수 있도록.
 */
const transformPollingResponse = (raw: Record<string, unknown>, gameId: string) => {
  const result = raw.result as Record<string, unknown> | undefined;
  if (!result) return null;

  const game = (result.game ?? {}) as Record<string, unknown>;
  const td = (result.textRelayData ?? {}) as Record<string, unknown>;
  const cgs = (td.currentGameState ?? {}) as Record<string, unknown>;

  // scoreByInning 배열 → { "1": "0", "2": "3", ... } 객체로 변환
  const homeArr = (game.homeTeamScoreByInning ?? []) as (number | string | null)[];
  const awayArr = (game.awayTeamScoreByInning ?? []) as (number | string | null)[];
  const toScoreMap = (arr: (number | string | null)[]) =>
    Object.fromEntries(arr.map((s, i) => [String(i + 1), s != null ? String(s) : '-']));

  // RHEB totals [Runs, Hits, Errors, BB]
  const [hR, hH, hE, hB] = ((game.homeTeamRheb ?? [0, 0, 0, 0]) as number[]);
  const [aR, aH, aE, aB] = ((game.awayTeamRheb ?? [0, 0, 0, 0]) as number[]);

  return {
    textRelayData: {
      gameId,
      inningScore: {
        home: toScoreMap(homeArr),
        away: toScoreMap(awayArr),
      },
      currentGameState: {
        homeScore: hR,
        awayScore: aR,
        homeHit: hH,
        awayHit: aH,
        homeError: hE,
        awayError: aE,
        homeBallFour: hB,
        awayBallFour: aB,
      },
      homeLineup: game.homeLineup ?? {},
      awayLineup: game.awayLineup ?? {},
      textRelays: (td.textRelays ?? []) as unknown[],
    },
    live: {
      statusCode: (game.statusCode ?? 'UNKNOWN') as string,
      currentInning: (game.currentInning ?? '') as string,
      ball: Number(cgs.ball ?? 0),
      strike: Number(cgs.strike ?? 0),
      out: Number(cgs.out ?? 0),
      bases: [
        Boolean(Number(cgs.base1 ?? 0)),
        Boolean(Number(cgs.base2 ?? 0)),
        Boolean(Number(cgs.base3 ?? 0)),
      ],
      relayNo: Number(td.no ?? 0),
    },
  };
};

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { params, request } = context;
  const gameId = params.gameId as string;

  if (!/^[0-9]{8}[A-Z]{4}[0-9]{5}$/.test(gameId)) {
    return Response.json({ error: 'Invalid gameId' }, { status: 400 });
  }

  const url = new URL(request.url);
  const inning = url.searchParams.get('inning') ?? '1';

  // 1. Cache API 조회
  const cache = caches.default;
  const cacheKey = new Request(`https://kbo-live-cache/${gameId}?inning=${inning}`);
  const cached = await cache.match(cacheKey);
  if (cached) return cached;

  // 2. Naver API 호출
  const naverUrl = `${NAVER_API}/${gameId}/game-polling?inning=${inning}&isHighlight=false`;
  let naverResp: Response;
  try {
    naverResp = await fetch(naverUrl, {
      headers: {
        'Referer': 'https://sports.naver.com/',
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
      },
    });
  } catch {
    return Response.json({ error: 'Upstream fetch failed' }, { status: 502 });
  }

  if (!naverResp.ok) {
    return Response.json({ error: 'Upstream error' }, { status: 502 });
  }

  const raw = (await naverResp.json()) as Record<string, unknown>;
  if ((raw.code as number) !== 200 || !raw.result) {
    return Response.json({ error: 'No data' }, { status: 404 });
  }

  // 3. 기존 RelayApiResponse 포맷으로 변환
  const transformed = transformPollingResponse(raw, gameId);
  if (!transformed) {
    return Response.json({ error: 'Transform failed' }, { status: 500 });
  }

  // 4. Cache에 저장 + 응답
  const response = Response.json(transformed, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': `s-maxage=${CACHE_TTL}, stale-while-revalidate=15`,
    },
  });

  context.waitUntil(cache.put(cacheKey, response.clone()));
  return response;
};
