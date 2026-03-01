# KBO 닮은꼴 — CLAUDE.md

## Project Overview

KBO 프로 야구 선수 닮은꼴 찾기 서비스. 사용자가 사진을 업로드하면 **브라우저 온디바이스 AI**로 763명의 KBO 선수 중 가장 닮은 선수 Top 5를 찾아준다. 서버로 사진이 전송되지 않음.

## Monorepo Structure

```
kbo-lookalike/
├── python/          # 데이터 파이프라인 (크롤링, 임베딩 추출)
├── web/             # React 프론트엔드 (Vite + TypeScript)
├── data/            # 선수 이미지, 임베딩, 메타데이터 (gitignored)
├── browser_models/  # ONNX 모델 파일 (gitignored)
└── CLAUDE.md
```

## Code Conventions (web/)

### General
- **No `export default`** — 항상 named export 사용
- **`const` arrow functions** — `function` 선언 대신 `const fn = () => {}` 사용
- **React imports** — `React.xxx` 대신 `import { xxx } from 'react'` 직접 임포트
- **`import type`** — 타입만 사용하는 import에는 반드시 `import type` 사용 (verbatimModuleSyntax)

### React Components
```typescript
import type { FC } from 'react';

interface MyComponentProps {
  value: string;
}

export const MyComponent: FC<MyComponentProps> = ({ value }) => {
  return <div>{value}</div>;
};
```

### Hooks
```typescript
export const useMyHook = (): ReturnType => {
  // ...
  return { ... };
};
```

### State Management
- 서버 상태: `react-query` (추후 적용 예정)
- 클라이언트 상태: React useState/useCallback/useEffect
- 페이지 간 데이터 전달: `react-router` location state

### Path Aliases
- `@/*` → `./src/*`

## ML Pipeline (web/src/ml/)

브라우저에서 실행되는 on-device face analysis pipeline:

```
User Image (ImageBitmap)
    │
    ▼
[scrfd.ts] SCRFD 얼굴 검출 (det_500m.onnx, 2.4MB)
    - Input: [1,3,640,640] NCHW, normalize (mean=127.5, std=128.0)
    - 9 outputs: 3 strides(8,16,32) × [scores, bbox, kps]
    - Anchor grid → distance2bbox / distance2kps → NMS(0.4) → 가장 큰 얼굴
    → bbox + 5-point landmarks
    │
    ▼
[face-align.ts] 얼굴 정렬 (Similarity Transform)
    - 5-point landmarks → ArcFace 표준 좌표 (112×112)
    - 4-DOF least squares → inverse mapping + bilinear interpolation
    → 112×112 aligned face
    │
    ▼
[arcface.ts] MobileFaceNet 임베딩 (w600k_mbf.onnx, 13MB)
    - Input: [1,3,112,112], normalize (mean=127.5, std=127.5) ⚠️ SCRFD와 다름!
    - Output: 512-D embedding → L2 normalize
    │
    ▼
[similarity.ts] 코사인 유사도 검색
    - L2-normalized embeddings → dot product = cosine similarity
    - 763명 brute-force (<1ms) → Top 5 반환
```

### Critical Constants
| Value | SCRFD | ArcFace |
|-------|-------|---------|
| mean | 127.5 | 127.5 |
| **std** | **128.0** | **127.5** |
| Input size | 640×640 | 112×112 |

### ArcFace Standard Landmarks (112×112)
```
[[38.2946, 51.6963], [73.5318, 51.5014], [56.0252, 71.7366],
 [41.5493, 92.3655], [70.7299, 92.2041]]
```
순서: left_eye, right_eye, nose, left_mouth, right_mouth

## Tech Stack

### Web (web/)
- **Framework**: React 19 + TypeScript 5.9
- **Build**: Vite 7
- **Styling**: Tailwind CSS 4 + shadcn/ui
- **Routing**: react-router 7
- **ML Runtime**: onnxruntime-web 1.24 (WASM+SIMD)
- **Icons**: lucide-react

### Python (python/)
- **Runtime**: Python 3.12 (uv)
- **ML**: InsightFace (buffalo_sc), ONNX Runtime
- **Crawling**: requests, BeautifulSoup

## Commit Convention

```
prefix(scope): 메시지
```

- **prefix**: `feat` | `fix` | `refactor` | `chore` | `docs`
- **scope**: `web` | `python` (루트 파일은 scope 생략 가능)
- 예시: `feat(web): 온디바이스 얼굴 분석 파이프라인 구현`, `docs(python): README 업데이트`

## Dev Setup (web/)

```bash
cd web
npm install          # postinstall copies WASM files to public/
npm run dev          # http://localhost:5173 (COOP/COEP headers enabled)
```

### Symlinks (개발환경)
`web/public/` 의 symlink들이 data 디렉토리를 가리킴:
- `models` → `../../browser_models`
- `data/player_metadata.json` → `../../../data/metadata/player_metadata.json`
- `data/player_embeddings.json` → `../../../data/embeddings/player_embeddings.json`
- `images/players` → `../../../data/player_images_high`

### COOP/COEP
SharedArrayBuffer(WASM 멀티스레딩)를 위해 필요:
- Dev: `vite.config.ts` server.headers
- Prod: `public/_headers` (Cloudflare Pages)

## Data Formats

### player_metadata.json
```json
{ "version": "1.0", "count": 763, "players": [
  { "id": "68050", "name": "강백호", "team": "한화 이글스",
    "teamCode": "HH", "position": "타자", "imageUrl": "/images/players/68050.jpg" }
]}
```

### player_embeddings.json
```json
{ "version": "1.0", "model": "buffalo_sc (MobileFaceNet / ArcFace)",
  "dimension": 512, "count": 763,
  "players": { "68050": [0.094, 0.042, ...] } }
```

## Deployment Target
- **Cloudflare Pages + R2** ($0/month at low traffic)
- Static assets: ONNX models lazy-loaded, player images from R2

## Licensing
- InsightFace: **non-commercial** license
- 상업화 시 UniFace (MIT) 등 대안 필요
