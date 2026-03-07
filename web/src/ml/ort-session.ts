import * as ort from 'onnxruntime-web';
import { assetUrl } from './asset-url';

ort.env.wasm.wasmPaths = '/';
ort.env.wasm.numThreads = Math.min(navigator.hardwareConcurrency ?? 4, 4);

const sessionCache = new Map<string, ort.InferenceSession>();
const pendingLoads = new Map<string, Promise<ort.InferenceSession>>();

export const getSession = async (modelPath: string): Promise<ort.InferenceSession> => {
  const url = assetUrl(modelPath);

  const cached = sessionCache.get(url);
  if (cached) return cached;

  // 이미 로딩 중인 프라미스가 있으면 재사용 (중복 다운로드 방지)
  const pending = pendingLoads.get(url);
  if (pending) return pending;

  const promise = ort.InferenceSession.create(url, {
    executionProviders: ['wasm'],
    graphOptimizationLevel: 'all',
  }).then((session) => {
    sessionCache.set(url, session);
    pendingLoads.delete(url);
    return session;
  }).catch((e) => {
    pendingLoads.delete(url);
    throw e;
  });

  pendingLoads.set(url, promise);
  return promise;
};

export const warmup = async (): Promise<void> => {
  await Promise.all([getSession('/models/det_500m.onnx'), getSession('/models/w600k_mbf.onnx')]);
};

export { ort };
