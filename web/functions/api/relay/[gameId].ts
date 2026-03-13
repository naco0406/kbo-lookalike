interface Env {
  RELAY_BUCKET: R2Bucket;
}

export const onRequestGet: PagesFunction<Env> = async ({ params, env }) => {
  const gameId = params.gameId as string;

  // gameId 형식: 20260312KTLT02026 (8자리 날짜 + 4자리 팀코드 + 5자리 라운드코드)
  if (!/^[0-9]{8}[A-Z]{4}[0-9]{5}$/.test(gameId)) {
    return new Response(JSON.stringify({ error: 'Invalid gameId' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const obj = await env.RELAY_BUCKET.get(`relay/${gameId}.json`);

  if (!obj) {
    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(obj.body, {
    headers: {
      'Content-Type': 'application/json',
      // 경기 결과는 불변 — 하루 CDN 캐시
      'Cache-Control': 's-maxage=86400, stale-while-revalidate=3600',
    },
  });
};
