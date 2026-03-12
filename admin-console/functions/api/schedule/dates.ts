/**
 * GET /api/schedule/dates?year=2026
 * KV에서 날짜 인덱스를 반환한다.
 */

interface Env {
  KV: KVNamespace;
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const url = new URL(request.url);
  const year = url.searchParams.get('year') ?? '2026';
  const key = `schedule:dates:${year}`;

  const raw = await env.KV.get(key);
  if (!raw) {
    return Response.json({ year, dates: [] });
  }

  return Response.json({ year, dates: JSON.parse(raw) });
};
