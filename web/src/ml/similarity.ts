import type { Player, PlayerMetadata, GalleryEmbeddings, MatchResult } from '@/types/player';

const R2_BASE = import.meta.env.VITE_R2_BASE ?? '';

const toAbsoluteImageUrl = (relativeUrl: string): string =>
  R2_BASE && relativeUrl.startsWith('/') ? `${R2_BASE}${relativeUrl}` : relativeUrl;

let metadata: PlayerMetadata | null = null;
let embeddingMatrix: Float32Array[][] | null = null;
let playerIndex: Map<string, Player> | null = null;

export const loadPlayerData = async (): Promise<{ count: number }> => {
  if (metadata && embeddingMatrix) {
    return { count: metadata.count };
  }

  const [metaRes, embRes] = await Promise.all([
    fetch('/data/player_metadata.json'),
    fetch('/data/player_embeddings_gallery.json'),
  ]);

  metadata = (await metaRes.json()) as PlayerMetadata;
  const gallery = (await embRes.json()) as GalleryEmbeddings;

  // 이미지 URL을 R2 절대 경로로 변환
  playerIndex = new Map(
    metadata.players.map((p) => [p.id, { ...p, imageUrl: toAbsoluteImageUrl(p.imageUrl) }]),
  );

  // 선수별 임베딩 배열 (복수) — 갤러리 포맷
  embeddingMatrix = metadata.players.map((p) => {
    const entry = gallery.players[p.id];
    return entry ? entry.embeddings.map((e) => new Float32Array(e)) : [];
  });

  return { count: metadata.count };
};

export const findTopMatches = (queryEmbedding: Float32Array, topK = 5): MatchResult[] => {
  if (!metadata || !embeddingMatrix || !playerIndex) {
    throw new Error('Player data not loaded');
  }

  const scores: { idx: number; sim: number }[] = [];

  for (let i = 0; i < embeddingMatrix.length; i++) {
    const embeddings = embeddingMatrix[i];
    if (embeddings.length === 0) continue;

    // 선수의 여러 임베딩 중 최대 유사도를 대표값으로 사용
    let maxSim = -Infinity;
    for (const db of embeddings) {
      let dot = 0;
      for (let j = 0; j < db.length; j++) {
        dot += queryEmbedding[j] * db[j];
      }
      if (dot > maxSim) maxSim = dot;
    }
    scores.push({ idx: i, sim: maxSim });
  }

  scores.sort((a, b) => b.sim - a.sim);

  return scores.slice(0, topK).map((s) => {
    const original = metadata!.players[s.idx];
    return {
      player: playerIndex!.get(original.id) ?? original,
      similarity: s.sim,
    };
  });
};

export const isDataLoaded = (): boolean => {
  return metadata !== null && embeddingMatrix !== null;
};
