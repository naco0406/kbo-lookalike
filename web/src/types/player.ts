export interface Player {
  id: string;
  name: string;
  team: string;
  teamCode: string;
  position: string;
  imageUrl: string;
}

export interface PlayerMetadata {
  version: string;
  count: number;
  players: Player[];
}

export interface PlayerEmbeddings {
  version: string;
  model: string;
  dimension: number;
  count: number;
  players: Record<string, number[]>;
}

export interface GalleryEmbeddings {
  version: string;
  model: string;
  dimension: number;
  target_per_player: number;
  count: number;
  players: Record<string, { embeddings: number[][]; count: number }>;
}

export interface BonusBreakdown {
  cosine: number;
  positionBonus: number;
  teamBonus: number;
}

export interface MatchResult {
  player: Player;
  similarity: number;
  bonusBreakdown?: BonusBreakdown;
}

export interface FaceDetection {
  bbox: [number, number, number, number];
  score: number;
  landmarks: number[][];
}

// ── Classification types ──

export interface PositionClassification {
  position: '투수' | '타자';
  confidence: number;
  scores: Record<string, number>;
}

export interface TeamClassification {
  topTeams: Array<{ teamCode: string; name: string; similarity: number }>;
  scores: Record<string, number>;
}

export interface Classification {
  position: PositionClassification;
  team: TeamClassification;
  isBaseballFace: boolean;
  baseballFaceScore: number;
}

export interface ClassificationCentroids {
  version: string;
  position: Record<string, { centroid: number[]; count: number }>;
  team: Record<string, { centroid: number[]; count: number; name: string }>;
  global: { centroid: number[]; similarity_mean: number; similarity_std: number };
}
