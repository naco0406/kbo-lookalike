# KBO 닮은꼴

AI 얼굴 분석으로 나와 가장 닮은 KBO 프로야구 선수를 찾아주는 웹 서비스.

**모든 분석은 브라우저에서 처리되며, 사진은 서버로 전송되지 않습니다.**

## Features

- 사진 업로드 또는 셀카 촬영으로 닮은꼴 선수 검색
- KBO 10개 구단 763명 선수 DB
- On-device AI (ONNX Runtime Web, WASM+SIMD)
- Top 5 닮은꼴 결과 + 유사도 %

## Project Structure

```
kbo-lookalike/
├── python/          # 데이터 파이프라인 (크롤링, 임베딩 추출)
│   ├── kbo_crawling.ipynb
│   └── pyproject.toml
├── web/             # React 프론트엔드
│   ├── src/
│   │   ├── ml/      # 브라우저 ML 파이프라인 (SCRFD → ArcFace)
│   │   ├── pages/   # 홈, 결과, 소개
│   │   ├── components/
│   │   ├── hooks/
│   │   └── types/
│   └── public/      # 모델, 데이터 (symlinks)
├── data/            # 선수 이미지, 임베딩, 메타데이터
└── browser_models/  # ONNX 모델 (det_500m, w600k_mbf)
```

## Quick Start

### Prerequisites
- Node.js 20+
- Python 3.12+ (데이터 파이프라인만 필요 시)

### Web Development
```bash
cd web
npm install
npm run dev
```
http://localhost:5173 에서 확인.

### Data Pipeline (Python)
```bash
cd python
uv sync
uv run jupyter lab
# kbo_crawling.ipynb 실행
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, TypeScript, Vite 7 |
| Styling | Tailwind CSS 4, shadcn/ui |
| ML Runtime | ONNX Runtime Web (WASM+SIMD) |
| Face Detection | SCRFD (det_500m.onnx) |
| Face Recognition | MobileFaceNet/ArcFace (w600k_mbf.onnx) |
| Data Pipeline | Python, InsightFace, BeautifulSoup |

## How It Works

1. 사용자가 사진을 업로드/촬영
2. SCRFD 모델이 얼굴 검출 + 5-point 랜드마크 추출
3. Similarity transform으로 112x112 정규화 얼굴 생성
4. MobileFaceNet이 512차원 임베딩 벡터 추출
5. 763명의 사전 계산된 임베딩과 코사인 유사도 비교
6. Top 5 결과 표시
