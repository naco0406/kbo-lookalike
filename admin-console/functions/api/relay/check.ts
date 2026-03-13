/**
 * GET /api/relay/check?date=2026-03-12
 * 해당 날짜의 relay 파일이 R2에 존재하는지 확인한다.
 * 응답: { date, gameIds: string[] }  ← R2에 있는 경기 ID 목록
 */

interface Env {
  RELAY_BUCKET: R2Bucket;
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const url = new URL(request.url);
  const date = url.searchParams.get('date'); // "2026-03-12"

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return Response.json({ error: 'date 파라미터 필요 (YYYY-MM-DD)' }, { status: 400 });
  }

  const prefix = `relay/${date.replace(/-/g, '')}`; // "relay/20260312"
  const listed = await env.RELAY_BUCKET.list({ prefix });

  // "relay/20260312KTLT02026.json" → "20260312KTLT02026"
  const gameIds = listed.objects
    .map((o) => o.key.replace('relay/', '').replace('.json', ''))
    .filter((id) => /^[0-9]{8}[A-Z]{4}[0-9]{5}$/.test(id));

  return Response.json({ date, gameIds });
};
