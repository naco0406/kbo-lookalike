import type {
  ClassificationCentroids,
  PositionClassification,
  TeamClassification,
} from '@/types/player';
import { assetUrl } from './asset-url';

let centroids: ClassificationCentroids | null = null;
let positionVecs: Map<string, Float32Array> | null = null;
let teamVecs: Map<string, { vec: Float32Array; name: string }> | null = null;
let globalVec: Float32Array | null = null;
let globalMean = 0;
let globalStd = 0;
let _loadPromise: Promise<void> | null = null;

export const loadClassificationData = async (): Promise<void> => {
  if (centroids) return;

  // 이미 로딩 중인 프라미스가 있으면 재사용 (중복 fetch 방지)
  if (_loadPromise) return _loadPromise;

  _loadPromise = (async () => {
    const res = await fetch(assetUrl('/data/classification_centroids.json'));
    centroids = (await res.json()) as ClassificationCentroids;

    // Pre-convert to Float32Array for fast dot products
    positionVecs = new Map();
    for (const [pos, data] of Object.entries(centroids.position)) {
      positionVecs.set(pos, new Float32Array(data.centroid));
    }

    teamVecs = new Map();
    for (const [tc, data] of Object.entries(centroids.team)) {
      teamVecs.set(tc, { vec: new Float32Array(data.centroid), name: data.name });
    }

    globalVec = new Float32Array(centroids.global.centroid);
    globalMean = centroids.global.similarity_mean;
    globalStd = centroids.global.similarity_std;
  })().catch((e) => {
    _loadPromise = null; // 실패 시 재시도 허용
    throw e;
  });

  return _loadPromise;
};

export const isClassificationDataLoaded = (): boolean => centroids !== null;

const dot = (a: Float32Array, b: Float32Array): number => {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += a[i] * b[i];
  return sum;
};

export const classifyPosition = (embedding: Float32Array): PositionClassification => {
  if (!positionVecs) throw new Error('Classification data not loaded');

  const scores: Record<string, number> = {};
  for (const [pos, vec] of positionVecs) {
    scores[pos] = dot(embedding, vec);
  }

  // Temperature-scaled softmax (temp=8) → confidence 65-95% 범위
  const temp = 8;
  const entries = Object.entries(scores);
  const maxScore = Math.max(...entries.map(([, v]) => v));
  const exps = entries.map(([k, v]) => [k, Math.exp((v - maxScore) * temp)] as const);
  const sumExp = exps.reduce((s, [, e]) => s + e, 0);
  const softmaxEntries = exps
    .map(([k, e]) => [k, e / sumExp] as const)
    .sort((a, b) => b[1] - a[1]);

  return {
    position: softmaxEntries[0][0] as '투수' | '타자',
    confidence: softmaxEntries[0][1],
    scores,
  };
};

export const classifyTeam = (
  embedding: Float32Array,
): TeamClassification => {
  if (!teamVecs) throw new Error('Classification data not loaded');

  const scores: Record<string, number> = {};
  const rawEntries: Array<{ teamCode: string; name: string; raw: number }> = [];

  for (const [tc, { vec, name }] of teamVecs) {
    const sim = dot(embedding, vec);
    scores[tc] = sim;
    rawEntries.push({ teamCode: tc, name, raw: sim });
  }

  // Temperature-scaled softmax (temp=10) → 1위 30-50%, 극적 격차
  const temp = 10;
  const maxRaw = Math.max(...rawEntries.map((e) => e.raw));
  const exps = rawEntries.map((e) => ({ ...e, exp: Math.exp((e.raw - maxRaw) * temp) }));
  const sumExp = exps.reduce((s, e) => s + e.exp, 0);
  const softmaxed = exps
    .map((e) => ({ teamCode: e.teamCode, name: e.name, similarity: e.exp / sumExp }))
    .sort((a, b) => b.similarity - a.similarity);

  return {
    topTeams: softmaxed.slice(0, 3),
    scores,
  };
};

export const checkBaseballFace = (
  embedding: Float32Array,
): { isBaseballFace: boolean; zScore: number } => {
  if (!globalVec) throw new Error('Classification data not loaded');

  const sim = dot(embedding, globalVec);
  const zScore = (sim - globalMean) / (globalStd || 1);

  return {
    isBaseballFace: zScore >= -1.5,
    zScore,
  };
};
