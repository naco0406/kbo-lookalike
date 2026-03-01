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

export interface MatchResult {
  player: Player;
  similarity: number;
}

export interface FaceDetection {
  bbox: [number, number, number, number];
  score: number;
  landmarks: number[][];
}
