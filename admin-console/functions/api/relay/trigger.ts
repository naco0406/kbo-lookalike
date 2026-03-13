/**
 * POST /api/relay/trigger
 * Body: { date: "2026-03-12", force?: boolean }
 *
 * GitHub Actions workflow_dispatch으로 crawl-relay.yml을 트리거한다.
 * 응답: { ok: true } | { ok: false, error: string }
 */

interface Env {
  GITHUB_TOKEN: string;
}

const GITHUB_OWNER = 'naco0406';
const GITHUB_REPO = 'kbo-lookalike';
const WORKFLOW_FILE = 'crawl-relay.yml';

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const body = await request.json<{ date?: string; force?: boolean }>();
  const { date, force = false } = body;

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return Response.json({ ok: false, error: 'date 필요 (YYYY-MM-DD)' }, { status: 400 });
  }

  const resp = await fetch(
    `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/actions/workflows/${WORKFLOW_FILE}/dispatches`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.GITHUB_TOKEN}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
        'User-Agent': 'kbo-admin',
      },
      body: JSON.stringify({
        ref: 'main',
        inputs: {
          date,
          force: String(force),
        },
      }),
    },
  );

  // 204 No Content = 트리거 성공 (실행 자체는 비동기)
  if (resp.status === 204) {
    return Response.json({ ok: true });
  }

  const text = await resp.text().catch(() => '');
  return Response.json({ ok: false, error: `GitHub API ${resp.status}: ${text}` }, { status: 502 });
};
