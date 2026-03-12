import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import fs from 'fs'

const SCHEDULE_PATH = path.resolve(__dirname, '../data/schedule/kbo_2026.json')

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

export default defineConfig({
  plugins: [serveScheduleApi(), react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5174,
  },
})
