import type { Player, PlayerMetadata, PlayerEmbeddings, MatchResult } from '@/types/player';

let metadata: PlayerMetadata | null = null;
let embeddingMatrix: Float32Array[] | null = null;
let playerIndex: Map<string, Player> | null = null;

export const loadPlayerData = async (): Promise<{ count: number }> => {
  if (metadata && embeddingMatrix) {
    return { count: metadata.count };
  }

  const [metaRes, embRes] = await Promise.all([
    fetch('/data/player_metadata.json'),
    fetch('/data/player_embeddings.json'),
  ]);

  metadata = (await metaRes.json()) as PlayerMetadata;
  const embeddings = (await embRes.json()) as PlayerEmbeddings;

  playerIndex = new Map(metadata.players.map((p) => [p.id, p]));

  // Pre-convert to Float32Array for fast dot product
  embeddingMatrix = metadata.players.map((p) => {
    const raw = embeddings.players[p.id];
    return new Float32Array(raw);
  });

  return { count: metadata.count };
};

export const findTopMatches = (queryEmbedding: Float32Array, topK = 5): MatchResult[] => {
  if (!metadata || !embeddingMatrix || !playerIndex) {
    throw new Error('Player data not loaded');
  }

  const scores: { idx: number; sim: number }[] = [];

  for (let i = 0; i < embeddingMatrix.length; i++) {
    const db = embeddingMatrix[i];
    let dot = 0;
    for (let j = 0; j < db.length; j++) {
      dot += queryEmbedding[j] * db[j];
    }
    scores.push({ idx: i, sim: dot });
  }

  scores.sort((a, b) => b.sim - a.sim);

  return scores.slice(0, topK).map((s) => ({
    player: metadata!.players[s.idx],
    similarity: s.sim,
  }));
};

export const isDataLoaded = (): boolean => {
  return metadata !== null && embeddingMatrix !== null;
};
