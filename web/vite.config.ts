import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';
import fs from 'fs';

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
        const basename = path.basename(req.url.split('?')[0]);
        const filePath = path.resolve(__dirname, 'node_modules/onnxruntime-web/dist', basename);
        if (fs.existsSync(filePath)) {
          res.setHeader('Content-Type', 'application/javascript');
          res.setHeader('Access-Control-Allow-Origin', '*');
          fs.createReadStream(filePath).pipe(res);
          return;
        }
      }
      next();
    });
  },
});

/**
 * 개발 서버에서 /api/* 요청을 로컬 JSON 파일로 서빙한다.
 * 프로덕션에서는 Cloudflare Pages Function이 처리.
 */
const serveScheduleApi = (): Plugin => ({
  name: 'serve-schedule-api',
  configureServer(server) {
    server.middlewares.use(async (req, res, next) => {
      if (!req.url?.startsWith('/api/')) return next();

      // GET /api/standings — KBO 공식 팀 순위
      if (req.url.startsWith('/api/standings')) {
        const teamMap: Record<string, { code: string; shortName: string; name: string }> = {
          KT: { code: 'KT', shortName: 'KT', name: 'KT WIZ' },
          LG: { code: 'LG', shortName: 'LG', name: 'LG 트윈스' },
          SSG: { code: 'SK', shortName: 'SSG', name: 'SSG 랜더스' },
          삼성: { code: 'SS', shortName: '삼성', name: '삼성 라이온즈' },
          NC: { code: 'NC', shortName: 'NC', name: 'NC 다이노스' },
          KIA: { code: 'HT', shortName: 'KIA', name: 'KIA 타이거즈' },
          두산: { code: 'OB', shortName: '두산', name: '두산 베어스' },
          한화: { code: 'HH', shortName: '한화', name: '한화 이글스' },
          롯데: { code: 'LT', shortName: '롯데', name: '롯데 자이언츠' },
          키움: { code: 'WO', shortName: '키움', name: '키움 히어로즈' },
        };
        const stripTags = (value: string) =>
          value
            .replace(/<script[\s\S]*?<\/script>/gi, '')
            .replace(/<style[\s\S]*?<\/style>/gi, '')
            .replace(/<[^>]+>/g, '')
            .replace(/&nbsp;/g, ' ')
            .replace(/&amp;/g, '&')
            .replace(/\s+/g, ' ')
            .trim();
        const toNumber = (value: string) => Number(value.replace(/,/g, '')) || 0;
        interface DevStanding {
          rank: number;
          teamCode: string;
          teamName: string;
          shortName: string;
          games: number;
          wins: number;
          losses: number;
          draws: number;
          winRate: string;
          gamesBehind: string;
          recent10: string;
          streak: string;
          home: string;
          away: string;
        }
        const parseStandings = (html: string): DevStanding[] =>
          [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)]
            .map((row) => {
              const cells = [...row[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((cell) =>
                stripTags(cell[1]),
              );
              if (cells.length < 12 || !/^\d+$/.test(cells[0])) return null;
              const team = teamMap[cells[1]];
              if (!team) return null;
              return {
                rank: toNumber(cells[0]),
                teamCode: team.code,
                teamName: team.name,
                shortName: team.shortName,
                games: toNumber(cells[2]),
                wins: toNumber(cells[3]),
                losses: toNumber(cells[4]),
                draws: toNumber(cells[5]),
                winRate: cells[6],
                gamesBehind: cells[7],
                recent10: cells[8],
                streak: cells[9],
                home: cells[10],
                away: cells[11],
              };
            })
            .filter((standing): standing is DevStanding => standing !== null);
        const toKSTDateString = () =>
          new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(new Date());
        const addDays = (date: string, days: number) => {
          const nextDate = new Date(`${date}T00:00:00Z`);
          nextDate.setUTCDate(nextDate.getUTCDate() + days);
          return nextDate.toISOString().slice(0, 10);
        };
        const getGameResult = (
          game: {
            away: { code: string; score: number };
            home: { code: string; score: number };
          },
          teamCode: string,
        ) => {
          const isAway = game.away.code === teamCode;
          const isHome = game.home.code === teamCode;
          if (!isAway && !isHome) return null;
          if (game.away.score === game.home.score) return 'D';
          const teamWon = isAway
            ? game.away.score > game.home.score
            : game.home.score > game.away.score;
          return teamWon ? 'W' : 'L';
        };
        const fetchRecentGames = async (fromDate: string, toDate: string) => {
          const params = new URLSearchParams({
            fields: 'basic,schedule,baseball,manualRelayUrl',
            upperCategoryId: 'kbaseball',
            categoryId: 'kbo',
            fromDate,
            toDate,
            roundCodes: '',
            size: '500',
          });
          const resp = await fetch(`https://api-gw.sports.naver.com/schedule/games?${params}`, {
            headers: {
              Origin: 'https://m.sports.naver.com',
              Referer: 'https://m.sports.naver.com/kbaseball/schedule/index',
              Accept: 'application/json',
              'User-Agent':
                'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
            },
          });
          if (!resp.ok) return [];
          const data = (await resp.json()) as Record<string, unknown>;
          if (!data.success) return [];
          const result = data.result as Record<string, unknown>;
          const rawGames = (result?.games ?? []) as Record<string, unknown>[];
          return rawGames
            .filter((game) => {
              const awayScore = Number(game.awayTeamScore);
              const homeScore = Number(game.homeTeamScore);
              return (
                (game.statusCode === 'RESULT' || game.statusCode === 'ENDED') &&
                game.roundCode !== 'kbo_e' &&
                Number.isFinite(awayScore) &&
                Number.isFinite(homeScore)
              );
            })
            .map((game) => ({
              id: game.gameId as string,
              date: game.gameDate as string,
              away: { code: game.awayTeamCode as string, score: Number(game.awayTeamScore) },
              home: { code: game.homeTeamCode as string, score: Number(game.homeTeamScore) },
            }));
        };
        const buildRecentForms = async (
          standings: Array<{ teamCode?: string }>,
        ): Promise<Record<string, string[]>> => {
          const teamCodes = standings.map((team) => team.teamCode).filter(Boolean) as string[];
          const forms: Record<string, string[]> = {};
          let toDate = toKSTDateString();

          for (let window = 0; window < 4; window += 1) {
            if (teamCodes.every((code) => (forms[code]?.length ?? 0) >= 5)) break;
            const fromDate = addDays(toDate, -44);
            const games = (await fetchRecentGames(fromDate, toDate)).sort((a, b) => {
              const byDate = b.date.localeCompare(a.date);
              if (byDate !== 0) return byDate;
              return b.id.localeCompare(a.id);
            });
            for (const game of games) {
              for (const teamCode of [game.away.code, game.home.code]) {
                if (!teamCodes.includes(teamCode)) continue;
                if ((forms[teamCode]?.length ?? 0) >= 5) continue;
                const gameResult = getGameResult(game, teamCode);
                if (!gameResult) continue;
                forms[teamCode] = [...(forms[teamCode] ?? []), gameResult];
              }
            }
            toDate = addDays(fromDate, -1);
          }

          return Object.fromEntries(Object.entries(forms).filter(([, form]) => form.length >= 5));
        };

        try {
          const resp = await fetch('https://www.koreabaseball.com/Record/TeamRank/TeamRank.aspx', {
            headers: {
              Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
              'User-Agent':
                'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
            },
          });
          if (!resp.ok) throw new Error(`KBO ${resp.status}`);
          const standings = parseStandings(await resp.text());
          if (standings.length === 0) throw new Error('KBO standings parse failed');
          const recentForms: Record<string, string[]> = await buildRecentForms(standings).catch(
            () => ({}),
          );
          const standingsWithForm = standings.map((team) => ({
            ...team,
            recentForm: recentForms[team.teamCode],
          }));
          res.setHeader('Content-Type', 'application/json');
          res.end(
            JSON.stringify({
              updatedAt: new Date().toISOString(),
              source: 'kbo',
              standings: standingsWithForm,
            }),
          );
        } catch {
          res.statusCode = 502;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'KBO standings unavailable' }));
        }
        return;
      }

      // GET /api/relay/live/:gameId — Naver game-polling 프록시 (dev용)
      const liveMatch = req.url.match(/^\/api\/relay\/live\/([^?/]+)/);
      if (liveMatch) {
        const gameId = liveMatch[1];
        const urlObj = new URL(req.url, 'http://localhost');
        const inning = urlObj.searchParams.get('inning') ?? '1';
        const naverUrl = `https://api-gw.sports.naver.com/schedule/games/${gameId}/game-polling?inning=${inning}&isHighlight=false`;

        try {
          const resp = await fetch(naverUrl, {
            headers: {
              Referer: 'https://sports.naver.com/',
              'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
            },
          });
          const raw = (await resp.json()) as Record<string, unknown>;
          if ((raw as { code?: number }).code !== 200) {
            res.statusCode = 404;
            res.end(JSON.stringify({ error: 'No data' }));
            return;
          }
          const result = (raw as { result?: Record<string, unknown> }).result ?? {};
          const game = (result.game ?? {}) as Record<string, unknown>;
          const td = (result.textRelayData ?? {}) as Record<string, unknown>;
          const cgs = (td.currentGameState ?? {}) as Record<string, unknown>;

          const homeArr = (game.homeTeamScoreByInning ?? []) as (number | null)[];
          const awayArr = (game.awayTeamScoreByInning ?? []) as (number | null)[];
          const toMap = (arr: (number | null)[]) =>
            Object.fromEntries(arr.map((s, i) => [String(i + 1), s != null ? String(s) : '-']));
          const [hR, hH, hE, hB] = (game.homeTeamRheb ?? [0, 0, 0, 0]) as number[];
          const [aR, aH, aE, aB] = (game.awayTeamRheb ?? [0, 0, 0, 0]) as number[];

          const body = JSON.stringify({
            textRelayData: {
              gameId,
              inningScore: { home: toMap(homeArr), away: toMap(awayArr) },
              currentGameState: {
                homeScore: hR,
                awayScore: aR,
                homeHit: hH,
                awayHit: aH,
                homeError: hE,
                awayError: aE,
                homeBallFour: hB,
                awayBallFour: aB,
              },
              homeLineup: game.homeLineup ?? {},
              awayLineup: game.awayLineup ?? {},
              textRelays: td.textRelays ?? [],
            },
            live: {
              statusCode: game.statusCode ?? 'UNKNOWN',
              currentInning: game.currentInning ?? '',
              ball: Number(cgs.ball ?? 0),
              strike: Number(cgs.strike ?? 0),
              out: Number(cgs.out ?? 0),
              bases: [
                Boolean(Number(cgs.base1 ?? 0)),
                Boolean(Number(cgs.base2 ?? 0)),
                Boolean(Number(cgs.base3 ?? 0)),
              ],
              relayNo: Number(td.no ?? 0),
            },
          });
          res.setHeader('Content-Type', 'application/json');
          res.end(body);
        } catch {
          res.statusCode = 502;
          res.end(JSON.stringify({ error: 'Upstream fetch failed' }));
        }
        return;
      }

      // GET /api/relay/:gameId — 로컬 파일 → 없으면 Naver game-polling 전체 이닝 fallback
      const relayMatch = req.url.match(/^\/api\/relay\/([^?/]+)/);
      if (relayMatch && !req.url.includes('/relay/live/')) {
        const gameId = relayMatch[1];
        const filePath = path.resolve(__dirname, `../data/relay/${gameId}.json`);
        if (fs.existsSync(filePath)) {
          res.setHeader('Content-Type', 'application/json');
          fs.createReadStream(filePath).pipe(res);
        } else {
          // 로컬 파일 없으면 Naver API에서 1회 데이터로 대체
          try {
            const naverUrl = `https://api-gw.sports.naver.com/schedule/games/${gameId}/game-polling?inning=1&isHighlight=false`;
            const resp = await fetch(naverUrl, {
              headers: {
                Referer: 'https://sports.naver.com/',
                'User-Agent':
                  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
              },
            });
            const raw = (await resp.json()) as Record<string, unknown>;
            if ((raw as { code?: number }).code !== 200) {
              res.statusCode = 404;
              res.end(JSON.stringify({ error: 'No data' }));
              return;
            }
            const result = (raw as { result?: Record<string, unknown> }).result ?? {};
            const game = (result.game ?? {}) as Record<string, unknown>;
            const td = (result.textRelayData ?? {}) as Record<string, unknown>;
            const homeArr = (game.homeTeamScoreByInning ?? []) as (number | null)[];
            const awayArr = (game.awayTeamScoreByInning ?? []) as (number | null)[];
            const toMap = (arr: (number | null)[]) =>
              Object.fromEntries(arr.map((s, i) => [String(i + 1), s != null ? String(s) : '-']));
            const [hR, hH, hE, hB] = (game.homeTeamRheb ?? [0, 0, 0, 0]) as number[];
            const [aR, aH, aE, aB] = (game.awayTeamRheb ?? [0, 0, 0, 0]) as number[];
            const body = JSON.stringify({
              textRelayData: {
                gameId,
                partial: true,
                inningScore: { home: toMap(homeArr), away: toMap(awayArr) },
                currentGameState: {
                  homeScore: hR,
                  awayScore: aR,
                  homeHit: hH,
                  awayHit: aH,
                  homeError: hE,
                  awayError: aE,
                  homeBallFour: hB,
                  awayBallFour: aB,
                },
                homeLineup: game.homeLineup ?? {},
                awayLineup: game.awayLineup ?? {},
                textRelays: td.textRelays ?? [],
              },
            });
            res.setHeader('Content-Type', 'application/json');
            res.end(body);
          } catch {
            res.statusCode = 502;
            res.end(JSON.stringify({ error: 'Upstream fetch failed' }));
          }
        }
        return;
      }

      // GET /api/today?date=2026-03-12
      if (req.url.startsWith('/api/today')) {
        const url = new URL(req.url, 'http://localhost');
        const now = new Date();
        const kstDate = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(now);
        const date = url.searchParams.get('date') ?? kstDate;
        const isToday = date === kstDate;

        // 오늘 날짜: Naver Schedule API 프록시 (실시간 상태 반영)
        if (isToday) {
          const STATUS_MAP: Record<string, string> = {
            BEFORE: 'upcoming',
            LIVE: 'live',
            STARTED: 'live',
            RESULT: 'completed',
            ENDED: 'completed',
          };
          const naverParams = new URLSearchParams({
            fields: 'basic,schedule,baseball,manualRelayUrl',
            upperCategoryId: 'kbaseball',
            categoryId: 'kbo',
            fromDate: date,
            toDate: date,
            roundCodes: '',
            size: '500',
          });
          try {
            const naverResp = await fetch(
              `https://api-gw.sports.naver.com/schedule/games?${naverParams}`,
              {
                headers: {
                  Origin: 'https://m.sports.naver.com',
                  Referer: 'https://m.sports.naver.com/kbaseball/schedule/index',
                  Accept: 'application/json',
                  'User-Agent':
                    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
                },
              },
            );
            const data = (await naverResp.json()) as Record<string, unknown>;
            const result = (data.result ?? {}) as Record<string, unknown>;
            const rawGames = (result.games ?? []) as Record<string, unknown>[];
            const games = rawGames.map((g) => {
              let status: string;
              if (g.cancel) status = 'cancelled';
              else if (g.suspended) status = 'suspended';
              else status = STATUS_MAP[g.statusCode as string] ?? 'upcoming';

              const away: Record<string, unknown> = { code: g.awayTeamCode };
              const home: Record<string, unknown> = { code: g.homeTeamCode };
              if (status === 'live' || status === 'completed') {
                away.score = g.awayTeamScore;
                home.score = g.homeTeamScore;
              }
              const game: Record<string, unknown> = {
                id: g.gameId,
                date: g.gameDate,
                time: (g.gameDateTime as string).split('T')[1]?.slice(0, 5) ?? '',
                venue: g.stadium ?? '',
                status,
                away,
                home,
              };
              if (status === 'live' && g.statusInfo) game.inning = g.statusInfo;
              if (g.broadChannel) game.broadcast = g.broadChannel;
              if (g.roundCode) game.roundCode = g.roundCode;
              return game;
            });
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ date, games }));
          } catch {
            // Naver 실패 시 로컬 파일 fallback
            const schedulePath = path.resolve(__dirname, '../data/schedule/kbo_2026.json');
            try {
              const localData = JSON.parse(fs.readFileSync(schedulePath, 'utf-8'));
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ date, games: localData.schedule[date] ?? [] }));
            } catch {
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ date, games: [] }));
            }
          }
          return;
        }

        // 과거/미래 날짜: 로컬 JSON 파일
        const schedulePath = path.resolve(__dirname, '../data/schedule/kbo_2026.json');
        try {
          const data = JSON.parse(fs.readFileSync(schedulePath, 'utf-8'));
          const games = data.schedule[date] ?? [];
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ date, games }));
        } catch {
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ date, games: [], message: 'Schedule file not found' }));
        }
        return;
      }

      next();
    });
  },
});

export default defineConfig({
  plugins: [serveOnnxWorkers(), serveScheduleApi(), react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {},
  optimizeDeps: {
    exclude: ['onnxruntime-web'],
  },
  build: {
    target: 'esnext',
  },
});
