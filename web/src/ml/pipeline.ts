import { detectFaces } from './scrfd';
import { alignFace } from './face-align';
import { extractEmbedding } from './arcface';
import { findTopMatches, loadPlayerData, isDataLoaded } from './similarity';
import { warmup } from './ort-session';
import type { MatchResult } from '@/types/player';

export type PipelineStep =
  | 'loading-models'
  | 'loading-data'
  | 'detecting-face'
  | 'aligning-face'
  | 'extracting-embedding'
  | 'searching'
  | 'done'
  | 'error';

export interface PipelineResult {
  matches: MatchResult[];
  alignedFace: ImageData;
}

export const runPipeline = async (
  image: ImageBitmap,
  onStep: (step: PipelineStep) => void,
): Promise<PipelineResult> => {
  // 1. Load ONNX models
  onStep('loading-models');
  await warmup();

  // 2. Load player data
  if (!isDataLoaded()) {
    onStep('loading-data');
    await loadPlayerData();
  }

  // 3. Detect face
  onStep('detecting-face');
  const faces = await detectFaces(image);
  if (faces.length === 0) {
    throw new Error('NO_FACE_DETECTED');
  }

  // 4. Align face
  onStep('aligning-face');
  const alignedFace = alignFace(image, faces[0].landmarks);

  // 5. Extract embedding
  onStep('extracting-embedding');
  const embedding = await extractEmbedding(alignedFace);

  // Debug: check embedding norm (should be ~1.0 since L2-normalized)
  let norm = 0;
  for (let i = 0; i < embedding.length; i++) norm += embedding[i] * embedding[i];
  console.debug('[Pipeline] Embedding dim:', embedding.length, 'L2 norm:', Math.sqrt(norm));

  // 6. Search
  onStep('searching');
  const matches = findTopMatches(embedding, 5);

  console.debug(
    '[Pipeline] Top 5 matches:',
    matches.map((m) => `${m.player.name} (${(m.similarity * 100).toFixed(1)}%)`),
  );

  onStep('done');
  return { matches, alignedFace };
};
