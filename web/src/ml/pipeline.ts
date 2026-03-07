import { detectFaces } from './scrfd';
import { alignFace } from './face-align';
import { extractEmbedding } from './arcface';
import { findTopMatches, deriveClassificationFromMatches, loadPlayerData, isDataLoaded } from './similarity';
import { warmup } from './ort-session';
import { cropFace, imageDataToUrl, bboxToFaceRect } from './face-crop';
import {
  loadClassificationData,
  isClassificationDataLoaded,
  checkBaseballFace,
} from './classify';
import type { MatchResult, FaceDetection, Classification } from '@/types/player';

export type PipelineStep =
  | 'loading-models'
  | 'loading-data'
  | 'detecting-face'
  | 'cropping-face'
  | 'aligning-face'
  | 'extracting-embedding'
  | 'classifying-position'
  | 'classifying-team'
  | 'checking-baseball-face'
  | 'searching'
  | 'done'
  | 'error';

export interface PipelineResult {
  matches: MatchResult[];
  alignedFace: ImageData;
  croppedFace: ImageData;
  croppedFaceUrl: string;
  faceDetection: FaceDetection;
  faceRect: { x: number; y: number; width: number; height: number };
  classification: Classification;
}

export const runPipeline = async (
  image: ImageBitmap,
  onStep: (step: PipelineStep) => void,
): Promise<PipelineResult> => {
  // 1. Load ONNX models
  onStep('loading-models');
  await warmup();

  // 2. Load player data + classification centroids (for baseball face check)
  onStep('loading-data');
  await Promise.all([
    isDataLoaded() ? Promise.resolve() : loadPlayerData(),
    isClassificationDataLoaded() ? Promise.resolve() : loadClassificationData(),
  ]);

  // 3. Detect face
  onStep('detecting-face');
  const faces = await detectFaces(image);
  if (faces.length === 0) {
    throw new Error('NO_FACE_DETECTED');
  }
  const face = faces[0];

  // 4. Crop face (square + padding)
  onStep('cropping-face');
  const croppedFace = cropFace(image, face);
  const croppedFaceUrl = imageDataToUrl(croppedFace);
  const faceRect = bboxToFaceRect(face.bbox, image.width, image.height);

  // 5. Align face
  onStep('aligning-face');
  const alignedFace = alignFace(image, face.landmarks);

  // 6. Extract embedding
  onStep('extracting-embedding');
  const embedding = await extractEmbedding(alignedFace);

  // Debug: check embedding norm (should be ~1.0 since L2-normalized)
  let norm = 0;
  for (let i = 0; i < embedding.length; i++) norm += embedding[i] * embedding[i];
  console.debug('[Pipeline] Embedding dim:', embedding.length, 'L2 norm:', Math.sqrt(norm));

  // 7-8. Position/Team — UI timing steps (actual classification derived from matches)
  onStep('classifying-position');
  onStep('classifying-team');

  // 9. Baseball face check (centroid-based — face shape vs all baseball players)
  onStep('checking-baseball-face');
  const { isBaseballFace, zScore } = checkBaseballFace(embedding);
  console.debug('[Pipeline] Baseball face:', isBaseballFace, 'z-score:', zScore.toFixed(3));

  // 10. Search (pure cosine, top 10 for classification derivation)
  onStep('searching');
  const allMatches = findTopMatches(embedding, 10);
  const matches = allMatches.slice(0, 5);

  // Derive position/team from top 10 match results → 결과와 일맥상통
  const derived = deriveClassificationFromMatches(allMatches);

  const classification: Classification = {
    position: derived.position,
    team: derived.team,
    isBaseballFace,
    baseballFaceScore: zScore,
  };

  console.debug('[Pipeline] Position (derived):', derived.position.position, `(${(derived.position.confidence * 100).toFixed(0)}%)`);
  console.debug('[Pipeline] Top teams (derived):', derived.team.topTeams.map((t) => `${t.name} (${(t.similarity * 100).toFixed(0)}%)`));
  console.debug(
    '[Pipeline] Top 5 matches:',
    matches.map((m) => `${m.player.name} (${(m.similarity * 100).toFixed(1)}%)`),
  );

  onStep('done');
  return {
    matches,
    alignedFace,
    croppedFace,
    croppedFaceUrl,
    faceDetection: face,
    faceRect,
    classification,
  };
};
