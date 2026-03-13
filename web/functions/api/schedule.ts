/**
 * GET /api/schedule?month=YYYY-MM
 * KV에서 해당 월의 전체 경기 일정을 반환한다.
 */

interface Env {
  KV: KVNamespace;
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const url = new URL(request.url);
  const month = url.searchParams.get('month');

  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return Response.json(
      { error: 'month parameter required (YYYY-MM)' },
      { status: 400 },
    );
  }

  const year = month.slice(0, 4);
  const indexKey = `schedule:dates:${year}`;
  const indexRaw = await env.KV.get(indexKey);
  const allDates: string[] = indexRaw ? (JSON.parse(indexRaw) as string[]) : [];
  const monthDates = allDates.filter((d) => d.startsWith(month));

  const entries = await Promise.all(
    monthDates.map(async (date) => {
      const raw = await env.KV.get(`schedule:${date}`);
      return [date, raw ? JSON.parse(raw) : []] as const;
    }),
  );

  const gamesByDate = Object.fromEntries(entries);

  return Response.json(
    { month, gamesByDate },
    {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, s-maxage=300',
      },
    },
  );
};
