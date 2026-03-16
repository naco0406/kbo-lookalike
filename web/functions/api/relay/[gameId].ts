/**
 * GET /api/relay/:gameId
 *
 * 1차: R2에서 전체 relay JSON 반환 (크롤러가 경기 종료 후 저장)
 * 2차: R2에 없으면 Naver game-polling API fallback (스코어보드 정도만 제공)
 */

interface Env {
  RELAY_BUCKET: R2Bucket;
}

const NAVER_API = 'https://api-gw.sports.naver.com/schedule/games';
const NAVER_HEADERS = {
  'Referer': 'https://sports.naver.com/',
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
};

const transformPollingResponse = (raw: Record<string, unknown>, gameId: string) => {
  const result = raw.result as Record<string, unknown> | undefined;
  if (!result) return null;

  const game = (result.game ?? {}) as Record<string, unknown>;
  const td = (result.textRelayData ?? {}) as Record<string, unknown>;

  const homeArr = (game.homeTeamScoreByInning ?? []) as (number | string | null)[];
  const awayArr = (game.awayTeamScoreByInning ?? []) as (number | string | null)[];
  const toScoreMap = (arr: (number | string | null)[]) =>
    Object.fromEntries(arr.map((s, i) => [String(i + 1), s != null ? String(s) : '-']));

  const [hR, hH, hE, hB] = (game.homeTeamRheb ?? [0, 0, 0, 0]) as number[];
  const [aR, aH, aE, aB] = (game.awayTeamRheb ?? [0, 0, 0, 0]) as number[];

  return {
    textRelayData: {
      gameId,
      // Naver fallback임을 표시 — 프론트에서 탭 제한 판단에 사용
      partial: true,
      inningScore: {
        home: toScoreMap(homeArr),
        away: toScoreMap(awayArr),
      },
      currentGameState: {
        homeScore: hR, awayScore: aR,
        homeHit: hH, awayHit: aH,
        homeError: hE, awayError: aE,
        homeBallFour: hB, awayBallFour: aB,
      },
      homeLineup: game.homeLineup ?? {},
      awayLineup: game.awayLineup ?? {},
      textRelays: (td.textRelays ?? []) as unknown[],
    },
  };
};

export const onRequestGet: PagesFunction<Env> = async ({ params, env }) => {
  const gameId = params.gameId as string;

  if (!/^[0-9]{8}[A-Z]{4}[0-9]{5}$/.test(gameId)) {
    return Response.json({ error: 'Invalid gameId' }, { status: 400 });
  }

  // 1차: R2에서 전체 relay 조회
  const obj = await env.RELAY_BUCKET.get(`relay/${gameId}.json`);

  if (obj) {
    return new Response(obj.body, {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 's-maxage=86400, stale-while-revalidate=3600',
      },
    });
  }

  // 2차: Naver game-polling fallback (스코어보드 수준)
  try {
    const naverUrl = `${NAVER_API}/${gameId}/game-polling?inning=1&isHighlight=false`;
    const resp = await fetch(naverUrl, { headers: NAVER_HEADERS });
    if (!resp.ok) {
      return Response.json({ error: 'Not found' }, { status: 404 });
    }

    const raw = (await resp.json()) as Record<string, unknown>;
    if ((raw.code as number) !== 200 || !raw.result) {
      return Response.json({ error: 'Not found' }, { status: 404 });
    }

    const transformed = transformPollingResponse(raw, gameId);
    if (!transformed) {
      return Response.json({ error: 'Transform failed' }, { status: 500 });
    }

    return Response.json(transformed, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        // fallback 데이터는 짧게 캐싱 — R2에 올라오면 다음 요청부터 전체 데이터 반환
        'Cache-Control': 's-maxage=120, stale-while-revalidate=60',
      },
    });
  } catch {
    return Response.json({ error: 'Upstream fetch failed' }, { status: 502 });
  }
};
