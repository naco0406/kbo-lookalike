# KBO 닮은꼴 — Web

## 로컬 개발

```bash
npm install          # postinstall이 ONNX Runtime WASM 파일을 public/에 복사
npm run dev          # http://localhost:5173
```

### Symlinks (로컬 전용)

`web/public/` 아래 symlink들이 gitignored 디렉토리를 가리킵니다.
로컬에서만 동작하며, 프로덕션에서는 R2에서 서빙됩니다.

```
public/models              → ../../browser_models          (.onnx 모델)
public/data/*.json         → ../../../data/embeddings/...  (임베딩, 메타데이터)
public/images/players      → ../../../data/player_images_high
```

로컬에서 `.env.development`의 `VITE_R2_BASE`가 비어 있으므로 symlink를 통해 `/models/`, `/data/`, `/images/` 경로로 직접 접근합니다.

## 배포 아키텍처

```
GitHub (git push)
  └─ Cloudflare Pages (git clone → npm install → npm run build)
       ├─ dist/           ← 정적 파일 (HTML, JS, CSS, WASM)
       └─ _headers        ← COOP/COEP, 캐시 정책

Cloudflare R2 (assets.naco.kr)
  ├─ /models/             ← ONNX 모델 파일
  │    ├─ det_500m.onnx        (SCRFD 얼굴 검출, 2.4MB)
  │    └─ w600k_mbf.onnx       (ArcFace 임베딩, 13MB)
  ├─ /data/               ← JSON 데이터
  │    ├─ player_metadata.json
  │    └─ player_embeddings_gallery.json
  └─ /images/players/     ← 선수 프로필 이미지 (763장)
```

- **Cloudflare Pages**: git push → 자동 빌드·배포. HTML/JS/CSS/WASM만 포함
- **Cloudflare R2**: 대용량 정적 에셋 (모델, 데이터, 이미지). 커스텀 도메인 `assets.naco.kr`
- **`VITE_R2_BASE`**: 프로덕션에서 `https://assets.naco.kr`, 로컬에서 빈 문자열

## R2 에셋 업데이트

모델, 데이터, 이미지를 업데이트할 때는 wrangler CLI로 R2에 직접 업로드합니다.

```bash
# ONNX 모델 업로드
wrangler r2 object put kbo-assets/models/det_500m.onnx \
  --file ../browser_models/det_500m.onnx \
  --content-type application/octet-stream --remote

wrangler r2 object put kbo-assets/models/w600k_mbf.onnx \
  --file ../browser_models/w600k_mbf.onnx \
  --content-type application/octet-stream --remote

# 데이터 JSON 업로드
wrangler r2 object put kbo-assets/data/player_metadata.json \
  --file ../data/metadata/player_metadata.json \
  --content-type application/json --remote

wrangler r2 object put kbo-assets/data/player_embeddings_gallery.json \
  --file ../data/embeddings/player_embeddings_gallery.json \
  --content-type application/json --remote

# 선수 이미지 업로드 (개별)
wrangler r2 object put kbo-assets/images/players/68050.jpg \
  --file ../data/player_images_high/68050.jpg \
  --content-type image/jpeg --remote
```

> R2 에셋은 git과 독립적입니다. 모델/데이터만 업데이트할 때는 git push 없이 wrangler로 R2에 직접 업로드하면 됩니다.

## 환경 변수

| 변수 | 개발 | 프로덕션 | 용도 |
|------|------|----------|------|
| `VITE_R2_BASE` | (빈 문자열) | `https://assets.naco.kr` | 모델·데이터·이미지 URL prefix |

## 빌드 파이프라인

```
npm install
  └─ postinstall: scripts/copy-wasm.mjs
       → node_modules/onnxruntime-web/dist/*.wasm → public/

npm run build
  └─ tsc -b && vite build
       → public/ + src/ → dist/
```

WASM 파일은 gitignored이며, Cloudflare Pages 빌드 시 `npm install` → postinstall에서 자동 복사됩니다.
