import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import fs from 'fs'

/**
 * Vite 7은 /public 디렉토리의 파일을 소스 코드에서 import하는 것을 차단한다.
 * onnxruntime-web이 워커 .mjs 파일을 동적 import하므로,
 * 개발 서버에서는 node_modules에서 직접 서빙하여 이 제한을 우회한다.
 */
const serveOnnxWorkers = (): Plugin => ({
  name: 'serve-onnx-workers',
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      if (req.url && /^\/ort-wasm.*\.mjs(\?.*)?$/.test(req.url)) {
        const basename = path.basename(req.url.split('?')[0])
        const filePath = path.resolve(__dirname, 'node_modules/onnxruntime-web/dist', basename)
        if (fs.existsSync(filePath)) {
          res.setHeader('Content-Type', 'application/javascript')
          res.setHeader('Access-Control-Allow-Origin', '*')
          res.setHeader('Cross-Origin-Opener-Policy', 'same-origin')
          res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless')
          fs.createReadStream(filePath).pipe(res)
          return
        }
      }
      next()
    })
  },
})

/**
 * 개발 서버에서 /api/* 요청을 로컬 JSON 파일로 서빙한다.
 * 프로덕션에서는 Cloudflare Pages Function이 처리.
 */
const serveScheduleApi = (): Plugin => ({
  name: 'serve-schedule-api',
  configureServer(server) {
    server.middlewares.use(async (req, res, next) => {
      if (!req.url?.startsWith('/api/')) return next()

      // GET /api/relay/live/:gameId — Naver game-polling 프록시 (dev용)
      const liveMatch = req.url.match(/^\/api\/relay\/live\/([^?/]+)/)
      if (liveMatch) {
        const gameId = liveMatch[1]
        const urlObj = new URL(req.url, 'http://localhost')
        const inning = urlObj.searchParams.get('inning') ?? '1'
        const naverUrl = `https://api-gw.sports.naver.com/schedule/games/${gameId}/game-polling?inning=${inning}&isHighlight=false`

        try {
          const resp = await fetch(naverUrl, {
            headers: {
              'Referer': 'https://sports.naver.com/',
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
            },
          })
          const raw = await resp.json() as Record<string, unknown>
          if ((raw as { code?: number }).code !== 200) {
            res.statusCode = 404
            res.end(JSON.stringify({ error: 'No data' }))
            return
          }
          const result = (raw as { result?: Record<string, unknown> }).result ?? {}
          const game = (result.game ?? {}) as Record<string, unknown>
          const td = (result.textRelayData ?? {}) as Record<string, unknown>
          const cgs = (td.currentGameState ?? {}) as Record<string, unknown>

          const homeArr = (game.homeTeamScoreByInning ?? []) as (number | null)[]
          const awayArr = (game.awayTeamScoreByInning ?? []) as (number | null)[]
          const toMap = (arr: (number | null)[]) =>
            Object.fromEntries(arr.map((s, i) => [String(i + 1), s != null ? String(s) : '-']))
          const [hR, hH, hE, hB] = (game.homeTeamRheb ?? [0, 0, 0, 0]) as number[]
          const [aR, aH, aE, aB] = (game.awayTeamRheb ?? [0, 0, 0, 0]) as number[]

          const body = JSON.stringify({
            textRelayData: {
              gameId,
              inningScore: { home: toMap(homeArr), away: toMap(awayArr) },
              currentGameState: { homeScore: hR, awayScore: aR, homeHit: hH, awayHit: aH, homeError: hE, awayError: aE, homeBallFour: hB, awayBallFour: aB },
              homeLineup: game.homeLineup ?? {},
              awayLineup: game.awayLineup ?? {},
              textRelays: td.textRelays ?? [],
            },
            live: {
              statusCode: game.statusCode ?? 'UNKNOWN',
              currentInning: game.currentInning ?? '',
              ball: Number(cgs.ball ?? 0), strike: Number(cgs.strike ?? 0), out: Number(cgs.out ?? 0),
              bases: [Boolean(Number(cgs.base1 ?? 0)), Boolean(Number(cgs.base2 ?? 0)), Boolean(Number(cgs.base3 ?? 0))],
              relayNo: Number(td.no ?? 0),
            },
          })
          res.setHeader('Content-Type', 'application/json')
          res.end(body)
        } catch {
          res.statusCode = 502
          res.end(JSON.stringify({ error: 'Upstream fetch failed' }))
        }
        return
      }

      // GET /api/relay/:gameId
      const relayMatch = req.url.match(/^\/api\/relay\/([^?/]+)/)
      if (relayMatch) {
        const gameId = relayMatch[1]
        const filePath = path.resolve(__dirname, `../data/relay/${gameId}.json`)
        if (fs.existsSync(filePath)) {
          res.setHeader('Content-Type', 'application/json')
          fs.createReadStream(filePath).pipe(res)
        } else {
          res.statusCode = 404
          res.end(JSON.stringify({ error: 'Not found' }))
        }
        return
      }

      // GET /api/today?date=2026-03-12
      if (req.url.startsWith('/api/today')) {
        const url = new URL(req.url, 'http://localhost')
        const now = new Date()
        const kstDate = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(now)
        const date = url.searchParams.get('date') ?? kstDate
        const isToday = date === kstDate

        // 오늘 날짜: Naver Schedule API 프록시 (실시간 상태 반영)
        if (isToday) {
          const STATUS_MAP: Record<string, string> = { BEFORE: 'upcoming', LIVE: 'live', RESULT: 'completed' }
          const naverParams = new URLSearchParams({
            fields: 'basic,schedule,baseball,manualRelayUrl',
            upperCategoryId: 'kbaseball', categoryId: 'kbo',
            fromDate: date, toDate: date, roundCodes: '', size: '500',
          })
          try {
            const naverResp = await fetch(
              `https://api-gw.sports.naver.com/schedule/games?${naverParams}`,
              { headers: {
                'Origin': 'https://m.sports.naver.com',
                'Referer': 'https://m.sports.naver.com/kbaseball/schedule/index',
                'Accept': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
              }},
            )
            const data = await naverResp.json() as Record<string, unknown>
            const result = (data.result ?? {}) as Record<string, unknown>
            const rawGames = ((result.games ?? []) as Record<string, unknown>[])
            const games = rawGames.map((g) => {
              let status: string
              if (g.cancel) status = 'cancelled'
              else if (g.suspended) status = 'suspended'
              else status = STATUS_MAP[g.statusCode as string] ?? 'upcoming'

              const away: Record<string, unknown> = { code: g.awayTeamCode }
              const home: Record<string, unknown> = { code: g.homeTeamCode }
              if (status === 'live' || status === 'completed') {
                away.score = g.awayTeamScore; home.score = g.homeTeamScore
              }
              const game: Record<string, unknown> = {
                id: g.gameId, date: g.gameDate,
                time: (g.gameDateTime as string).split('T')[1]?.slice(0, 5) ?? '',
                venue: g.stadium ?? '', status, away, home,
              }
              if (status === 'live' && g.statusInfo) game.inning = g.statusInfo
              if (g.broadChannel) game.broadcast = g.broadChannel
              if (g.roundCode) game.roundCode = g.roundCode
              return game
            })
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ date, games }))
          } catch {
            // Naver 실패 시 로컬 파일 fallback
            const schedulePath = path.resolve(__dirname, '../data/schedule/kbo_2026.json')
            try {
              const localData = JSON.parse(fs.readFileSync(schedulePath, 'utf-8'))
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ date, games: localData.schedule[date] ?? [] }))
            } catch {
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ date, games: [] }))
            }
          }
          return
        }

        // 과거/미래 날짜: 로컬 JSON 파일
        const schedulePath = path.resolve(__dirname, '../data/schedule/kbo_2026.json')
        try {
          const data = JSON.parse(fs.readFileSync(schedulePath, 'utf-8'))
          const games = data.schedule[date] ?? []
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ date, games }))
        } catch {
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ date, games: [], message: 'Schedule file not found' }))
        }
        return
      }

      next()
    })
  },
})

export default defineConfig({
  plugins: [serveOnnxWorkers(), serveScheduleApi(), react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'credentialless',
    },
  },
  optimizeDeps: {
    exclude: ['onnxruntime-web'],
  },
  build: {
    target: 'esnext',
  },
})
