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
    server.middlewares.use((req, res, next) => {
      if (!req.url?.startsWith('/api/')) return next()

      // GET /api/today?date=2026-03-12
      if (req.url.startsWith('/api/today')) {
        const url = new URL(req.url, 'http://localhost')
        const now = new Date()
        const kstDate = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(now)
        const date = url.searchParams.get('date') ?? kstDate

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
