/**
 * 백그라운드 리소스 프리로더
 *
 * 페이지 로드 즉시 무거운 리소스(ONNX 모델, 선수 데이터)를 백그라운드에서 로드 시작.
 * 각 모듈 내부에 중복 로드 방지(promise deduplication)가 되어 있으므로,
 * 프리로드 중 실제 사용 시점이 오면 동일 프라미스를 공유하여 중복 다운로드 없이 대기.
 */
import { warmup } from './ort-session';
import { loadPlayerData, preloadSamplePlayerImages } from './similarity';
import { loadClassificationData } from './classify';

let _started = false;

/** 모든 리소스 프리로드 시작 (idempotent, fire-and-forget) */
export const startPreload = () => {
  if (_started) return;
  _started = true;

  // ONNX 모델 (SCRFD 2.4MB + ArcFace 13MB)
  warmup().catch((e) => {
    console.warn('[Preload] Model warmup failed — will retry on demand:', e);
  });

  // 선수 데이터 + 분류 중심점 → 데이터 로드 후 타일 이미지 프리로드
  loadPlayerData()
    .then(() => preloadSamplePlayerImages())
    .catch((e) => {
      console.warn('[Preload] Player data load failed — will retry on demand:', e);
    });

  loadClassificationData().catch((e) => {
    console.warn('[Preload] Classification data load failed — will retry on demand:', e);
  });
};
