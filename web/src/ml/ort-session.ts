import * as ort from 'onnxruntime-web';

ort.env.wasm.wasmPaths = '/';
ort.env.wasm.numThreads = Math.min(navigator.hardwareConcurrency ?? 4, 4);

const sessionCache = new Map<string, ort.InferenceSession>();

export const getSession = async (modelPath: string): Promise<ort.InferenceSession> => {
  const cached = sessionCache.get(modelPath);
  if (cached) return cached;

  const session = await ort.InferenceSession.create(modelPath, {
    executionProviders: ['wasm'],
    graphOptimizationLevel: 'all',
  });

  sessionCache.set(modelPath, session);
  return session;
};

export const warmup = async (): Promise<void> => {
  await Promise.all([getSession('/models/det_500m.onnx'), getSession('/models/w600k_mbf.onnx')]);
};

export { ort };
