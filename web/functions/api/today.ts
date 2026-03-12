/**
 * GET /api/today
 * KV에서 오늘 날짜의 경기 일정을 반환한다.
 * ?date=2026-03-12 형태로 특정 날짜 조회도 가능.
 */

interface Env {
  KV: KVNamespace;
}

const toKSTDateString = (): string => {
  const now = new Date();
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(now);
};

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const url = new URL(request.url);
  const date = url.searchParams.get('date') ?? toKSTDateString();

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
        'Cache-Control': 'public, s-maxage=60',
      },
    },
  );
};
