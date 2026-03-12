# KBO 실시간 스코어 서빙 계획

## 데이터 소스

**Naver Sports 내부 API** (개인 프로젝트 범위 사용)

```
GET https://api-gw.sports.naver.com/schedule/games
  ?fields=basic,schedule,baseball,manualRelayUrl
  &upperCategoryId=kbaseball
  &categoryId=kbo
  &fromDate=2026-03-01
  &toDate=2026-03-31
  &size=500
```

### 필수 헤더
```
Origin: https://m.sports.naver.com
Referer: https://m.sports.naver.com/kbaseball/schedule/index?category=kbo
```

### 주요 응답 필드
| 필드 | 예시 | 설명 |
|---|---|---|
| `gameId` | `20260312KTLT02026` | 고유 ID |
| `gameDate` | `2026-03-12` | 날짜 |
| `gameDateTime` | `2026-03-12T13:00:00` | 경기 시작 시간 (KST) |
| `statusCode` | `BEFORE` / `LIVE` / `RESULT` | 경기 상태 |
| `statusInfo` | `9회초` | 현재 이닝 (LIVE/RESULT) |
| `homeTeamCode` / `awayTeamCode` | `LT` / `KT` | 네이버 팀 코드 |
| `homeTeamName` / `awayTeamName` | `롯데` / `KT` | 팀 단축명 |
| `homeTeamScore` / `awayTeamScore` | `4` / `3` | 스코어 |
| `stadium` | `사직` | 경기장 |
| `cancel` | `false` | 우천취소 여부 |
| `suspended` | `false` | 서스펜디드 여부 |
| `gameOnAir` | `true` / `false` | 실시간 중계 여부 |
| `broadChannel` | `MBC SPORTS+` | 중계 채널 |
| `homeStarterName` / `awayStarterName` | `김진욱` / `주권` | 선발투수 |

### 네이버 팀 코드 → KBO 매핑
```
HT = KIA 타이거즈      (광주)
SS = 삼성 라이온즈      (대구)
LG = LG 트윈스         (잠실)
OB = 두산 베어스        (잠실)
SK = SSG 랜더스        (인천)
NC = NC 다이노스       (창원/마산)
HH = 한화 이글스        (대전)
WO = 키움 히어로즈      (고척)
KT = KT 위즈           (수원)
LT = 롯데 자이언츠      (사직)
```

---

## 아키텍처

### 저장소: Cloudflare Workers KV

```
KV key: schedule:2026           → 시즌 전체 일정 (TTL 없음, 시즌 초 1회 write)
KV key: today:2026-03-12        → 오늘 경기 데이터 (TTL 24h, Cron이 덮어쓰기)
```

### Workers & Cron Triggers

```
[시즌 초, 1회 — Python 스크립트]
  → Naver API로 3~11월 전체 일정 크롤링
  → wrangler kv:key put 또는 Workers API로 KV write

[매일 오전 9:00 KST — Cron Trigger: daily-init]
  → KV read schedule:2026
  → 오늘 날짜 게임 추출
  → KV write today:{date} (status=upcoming, 스코어 없음)

[14:00~22:00 KST, 1분마다 — Cron Trigger: score-updater]
  → KV read today:{date} → 게임 있는지 확인 (없으면 early return)
  → 모든 게임 statusCode === "RESULT"면 early return
  → Naver API fetch (당일만)
  → 파싱 후 KV write today:{date} 덮어쓰기

[유저 접속 — Pages Function: /api/today]
  → KV read today:{date}
  → JSON 응답 + Cache-Control: s-maxage=60
```

### 클라이언트 폴링 전략

```typescript
// 경기 시간대(14:00~22:00 KST)이고 live 게임이 있을 때만 폴링
const isGameTime = hour >= 14 && hour <= 22;
const hasLiveGame = games.some(g => g.status === 'live');

if (isGameTime && hasLiveGame) {
  // 60초마다 /api/today refetch
}
```

---

## KV 데이터 스키마

```typescript
interface DailySchedule {
  date: string;           // "2026-03-12"
  updatedAt: string;      // ISO timestamp
  games: GameData[];
}

interface GameData {
  id: string;             // "20260312KTLT02026"
  status: 'upcoming' | 'live' | 'completed' | 'cancelled' | 'suspended';
  time: string;           // "18:30"
  venue: string;          // "사직"
  away: { code: string; score?: number };
  home: { code: string; score?: number };
  inning?: string;        // "7회말" — live일 때만
  broadcast?: string;     // "MBC SPORTS+"
}
```

### statusCode 매핑
```
Naver "BEFORE"    → "upcoming"
Naver "LIVE"      → "live"
Naver "RESULT"    → "completed"
Naver cancel=true → "cancelled"
Naver suspended   → "suspended"
```

---

## 비용 추정 (DAU 1,000)

| 항목 | 월 수량 | 비용 |
|---|---|---|
| Cron 실행 (1분 × 8시간 × 25일) | 12,000회 | 무료 |
| KV write | ~12,000회 | 무료 (1만회/일 무료) |
| KV read (유저 + CDN miss) | ~30만회 | 무료 (2,500만 무료) |
| Pages Function 실행 | ~30만회 | 무료 (10만/일 무료) |
| **합계** | | **$0** |

---

## 구현 순서

1. ✅ Naver API 엔드포인트 & 응답 구조 확인
2. ⬜ Python 크롤러로 시즌 일정 JSON 생성 (로컬 파일 먼저)
3. ⬜ Pages Function `/api/today` 구현 (KV read → JSON)
4. ⬜ 프론트 연동 (mock → API 호출 교체)
5. ⬜ Cloudflare Workers Cron `score-updater` 구현
6. ⬜ KV 배포 & wrangler 설정

---

## 참고

- Naver API는 비공식이므로 구조 변경 가능성 있음
- rate limit 확인 필요 (1분 1회 수준이면 문제없을 것)
- 시즌 중 올스타전/포스트시즌은 `roundCode`가 다름 (`kbo_e` = 시범경기)
