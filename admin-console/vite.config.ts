import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import fs from 'fs'

const SCHEDULE_PATH = path.resolve(__dirname, '../data/schedule/kbo_2026.json')
const RELAY_DIR = path.resolve(__dirname, '../data/relay')

// .dev.vars 파일에서 GITHUB_TOKEN을 읽어 로컬 trigger API에서 사용한다.
// Wrangler가 아닌 Vite가 서버를 실행하므로 직접 파싱.
const readDevVars = (): Record<string, string> => {
  const devVarsPath = path.resolve(__dirname, '.dev.vars')
  if (!fs.existsSync(devVarsPath)) return {}
  return Object.fromEntries(
    fs.readFileSync(devVarsPath, 'utf-8')
      .split('\n')
      .filter((line) => line.includes('=') && !line.startsWith('#'))
      .map((line) => {
        const idx = line.indexOf('=')
        return [line.slice(0, idx).trim(), line.slice(idx + 1).trim()]
      }),
  )
}

const GITHUB_OWNER = 'naco0406'
const GITHUB_REPO = 'kbo-lookalike'
const WORKFLOW_FILE = 'crawl-relay.yml'

/**
 * 개발 서버에서 /api/schedule/* 요청을 로컬 JSON으로 서빙한다.
 * 프로덕션에서는 Cloudflare Pages Function이 처리.
 */
const serveScheduleApi = (): Plugin => ({
  name: 'serve-schedule-api',
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      if (!req.url?.startsWith('/api/')) return next()

      const url = new URL(req.url, 'http://localhost')
      res.setHeader('Content-Type', 'application/json')

      try {
        const data = JSON.parse(fs.readFileSync(SCHEDULE_PATH, 'utf-8'))

        // GET /api/schedule/dates
        if (url.pathname === '/api/schedule/dates') {
          const dates = Object.keys(data.schedule).sort()
          res.end(JSON.stringify({ year: 2026, dates }))
          return
        }

        // GET/PUT/DELETE /api/schedule/:date
        const match = url.pathname.match(/^\/api\/schedule\/(\d{4}-\d{2}-\d{2})$/)
        if (match) {
          const date = match[1]

          if (req.method === 'GET') {
            const games = data.schedule[date] ?? []
            res.end(JSON.stringify({ date, games }))
            return
          }

          if (req.method === 'PUT') {
            let body = ''
            req.on('data', (chunk: string) => { body += chunk })
            req.on('end', () => {
              const parsed = JSON.parse(body)
              data.schedule[date] = parsed.games
              fs.writeFileSync(SCHEDULE_PATH, JSON.stringify(data, null, 2), 'utf-8')
              res.end(JSON.stringify({ date, games: parsed.games, ok: true }))
            })
            return
          }

          if (req.method === 'DELETE') {
            delete data.schedule[date]
            fs.writeFileSync(SCHEDULE_PATH, JSON.stringify(data, null, 2), 'utf-8')
            res.end(JSON.stringify({ date, ok: true }))
            return
          }
        }
      } catch (e) {
        res.statusCode = 500
        res.end(JSON.stringify({ error: String(e) }))
        return
      }

      next()
    })
  },
})

/**
 * 개발 서버에서 /api/relay/* 요청을 처리한다.
 *   GET  /api/relay/check?date=2026-03-12  → data/relay/ 디렉토리 스캔
 *   POST /api/relay/trigger                → .dev.vars의 GITHUB_TOKEN으로 실제 GitHub API 호출
 */
const serveRelayApi = (): Plugin => ({
  name: 'serve-relay-api',
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      if (!req.url?.startsWith('/api/relay/')) return next()

      const url = new URL(req.url, 'http://localhost')
      res.setHeader('Content-Type', 'application/json')

      // GET /api/relay/check?date=2026-03-12
      if (url.pathname === '/api/relay/check' && req.method === 'GET') {
        const date = url.searchParams.get('date') ?? ''
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
          res.statusCode = 400
          res.end(JSON.stringify({ error: 'date 필요 (YYYY-MM-DD)' }))
          return
        }
        const prefix = date.replace(/-/g, '') // "20260312"
        const gameIds: string[] = []
        if (fs.existsSync(RELAY_DIR)) {
          for (const file of fs.readdirSync(RELAY_DIR)) {
            if (file.startsWith(prefix) && file.endsWith('.json')) {
              const id = file.replace('.json', '')
              if (/^[0-9]{8}[A-Z]{4}[0-9]{5}$/.test(id)) gameIds.push(id)
            }
          }
        }
        res.end(JSON.stringify({ date, gameIds }))
        return
      }

      // POST /api/relay/trigger
      if (url.pathname === '/api/relay/trigger' && req.method === 'POST') {
        let body = ''
        req.on('data', (chunk: string) => { body += chunk })
        req.on('end', async () => {
          try {
            const { date, force = false } = JSON.parse(body) as { date?: string; force?: boolean }
            if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
              res.statusCode = 400
              res.end(JSON.stringify({ ok: false, error: 'date 필요 (YYYY-MM-DD)' }))
              return
            }

            const { GITHUB_TOKEN } = readDevVars()
            if (!GITHUB_TOKEN) {
              // 토큰 없으면 mock 성공 반환 (로컬 테스트용)
              res.end(JSON.stringify({ ok: true, mock: true, note: '.dev.vars에 GITHUB_TOKEN이 없어 mock 응답' }))
              return
            }

            const ghResp = await fetch(
              `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/actions/workflows/${WORKFLOW_FILE}/dispatches`,
              {
                method: 'POST',
                headers: {
                  Authorization: `Bearer ${GITHUB_TOKEN}`,
                  Accept: 'application/vnd.github+json',
                  'X-GitHub-Api-Version': '2022-11-28',
                  'Content-Type': 'application/json',
                  'User-Agent': 'kbo-admin-dev',
                },
                body: JSON.stringify({ ref: 'main', inputs: { date, force: String(force) } }),
              },
            )

            if (ghResp.status === 204) {
              res.end(JSON.stringify({ ok: true }))
            } else {
              const text = await ghResp.text()
              res.statusCode = 502
              res.end(JSON.stringify({ ok: false, error: `GitHub API ${ghResp.status}: ${text}` }))
            }
          } catch (e) {
            res.statusCode = 500
            res.end(JSON.stringify({ ok: false, error: String(e) }))
          }
        })
        return
      }

      next()
    })
  },
})

export default defineConfig({
  plugins: [serveScheduleApi(), serveRelayApi(), react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5174,
  },
})
