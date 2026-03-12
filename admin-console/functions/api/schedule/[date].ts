/**
 * /api/schedule/:date
 * GET  — 해당 날짜 경기 조회
 * PUT  — 해당 날짜 경기 전체 덮어쓰기
 * DELETE — 해당 날짜 경기 삭제
 */

interface Env {
  KV: KVNamespace;
}

export const onRequestGet: PagesFunction<Env> = async ({ params, env }) => {
  const date = params.date as string;
  const raw = await env.KV.get(`schedule:${date}`);

  if (!raw) {
    return Response.json({ date, games: [] }, { status: 404 });
  }

  return Response.json({ date, games: JSON.parse(raw) });
};

export const onRequestPut: PagesFunction<Env> = async ({ params, request, env }) => {
  const date = params.date as string;
  const body = await request.json<{ games: unknown[] }>();

  if (!Array.isArray(body.games)) {
    return Response.json({ error: 'games must be an array' }, { status: 400 });
  }

  await env.KV.put(`schedule:${date}`, JSON.stringify(body.games));

  // 날짜 인덱스도 업데이트 (없으면 추가)
  const year = date.slice(0, 4);
  const indexKey = `schedule:dates:${year}`;
  const indexRaw = await env.KV.get(indexKey);
  const dates: string[] = indexRaw ? JSON.parse(indexRaw) : [];

  if (!dates.includes(date)) {
    dates.push(date);
    dates.sort();
    await env.KV.put(indexKey, JSON.stringify(dates));
  }

  return Response.json({ date, games: body.games, ok: true });
};

export const onRequestDelete: PagesFunction<Env> = async ({ params, env }) => {
  const date = params.date as string;

  await env.KV.delete(`schedule:${date}`);

  // 날짜 인덱스에서도 제거
  const year = date.slice(0, 4);
  const indexKey = `schedule:dates:${year}`;
  const indexRaw = await env.KV.get(indexKey);

  if (indexRaw) {
    const dates: string[] = JSON.parse(indexRaw);
    const filtered = dates.filter((d) => d !== date);
    await env.KV.put(indexKey, JSON.stringify(filtered));
  }

  return Response.json({ date, ok: true });
};
