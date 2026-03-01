import { getSession, ort } from './ort-session';
import type { FaceDetection } from '@/types/player';

const INPUT_SIZE = 640;
const STRIDES = [8, 16, 32];
const FMC = 3; // feature map count per stride
const SCORE_THRESH = 0.5;
const NMS_THRESH = 0.4;

const generateAnchors = (
  height: number,
  width: number,
  stride: number,
  numAnchors: number,
): number[][] => {
  const anchors: number[][] = [];
  const rows = Math.ceil(height / stride);
  const cols = Math.ceil(width / stride);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      for (let a = 0; a < numAnchors; a++) {
        anchors.push([c * stride, r * stride]);
      }
    }
  }
  return anchors;
};

const distance2bbox = (
  anchor: number[],
  distance: Float32Array,
  stride: number,
): [number, number, number, number] => {
  const cx = anchor[0];
  const cy = anchor[1];
  return [
    cx - distance[0] * stride,
    cy - distance[1] * stride,
    cx + distance[2] * stride,
    cy + distance[3] * stride,
  ];
};

const distance2kps = (anchor: number[], kps: Float32Array, stride: number): number[][] => {
  const points: number[][] = [];
  const cx = anchor[0];
  const cy = anchor[1];
  for (let i = 0; i < 10; i += 2) {
    points.push([cx + kps[i] * stride, cy + kps[i + 1] * stride]);
  }
  return points;
};

const nms = (dets: FaceDetection[], threshold: number): FaceDetection[] => {
  if (dets.length === 0) return [];

  const sorted = [...dets].sort((a, b) => b.score - a.score);
  const keep: FaceDetection[] = [];

  const suppressed = new Uint8Array(sorted.length);

  for (let i = 0; i < sorted.length; i++) {
    if (suppressed[i]) continue;
    keep.push(sorted[i]);

    const [x1a, y1a, x2a, y2a] = sorted[i].bbox;
    const areaA = (x2a - x1a) * (y2a - y1a);

    for (let j = i + 1; j < sorted.length; j++) {
      if (suppressed[j]) continue;
      const [x1b, y1b, x2b, y2b] = sorted[j].bbox;
      const areaB = (x2b - x1b) * (y2b - y1b);

      const x1 = Math.max(x1a, x1b);
      const y1 = Math.max(y1a, y1b);
      const x2 = Math.min(x2a, x2b);
      const y2 = Math.min(y2a, y2b);

      const inter = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
      const iou = inter / (areaA + areaB - inter);

      if (iou > threshold) {
        suppressed[j] = 1;
      }
    }
  }

  return keep;
};

/**
 * Preprocess image to NCHW tensor [1,3,640,640].
 * Maintains aspect ratio with padding (like Python det_img).
 */
const preprocessImage = (
  img: ImageBitmap | HTMLCanvasElement | HTMLImageElement,
): { tensor: ort.Tensor; scale: number; padX: number; padY: number } => {
  const canvas = document.createElement('canvas');
  canvas.width = INPUT_SIZE;
  canvas.height = INPUT_SIZE;
  const ctx = canvas.getContext('2d')!;

  // Fill with black padding (same as Python: np.zeros)
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, INPUT_SIZE, INPUT_SIZE);

  const w = 'naturalWidth' in img ? img.naturalWidth : img.width;
  const h = 'naturalHeight' in img ? img.naturalHeight : img.height;
  const scale = Math.min(INPUT_SIZE / w, INPUT_SIZE / h);
  const newW = Math.round(w * scale);
  const newH = Math.round(h * scale);
  const padX = 0;
  const padY = 0;

  ctx.drawImage(img, padX, padY, newW, newH);

  const imageData = ctx.getImageData(0, 0, INPUT_SIZE, INPUT_SIZE);
  const pixels = imageData.data;
  const size = INPUT_SIZE * INPUT_SIZE;
  const float32 = new Float32Array(3 * size);

  // RGB order, normalize: (pixel - 127.5) / 128.0
  for (let i = 0; i < size; i++) {
    const base = i * 4;
    float32[i] = (pixels[base] - 127.5) / 128.0; // R
    float32[size + i] = (pixels[base + 1] - 127.5) / 128.0; // G
    float32[2 * size + i] = (pixels[base + 2] - 127.5) / 128.0; // B
  }

  return {
    tensor: new ort.Tensor('float32', float32, [1, 3, INPUT_SIZE, INPUT_SIZE]),
    scale,
    padX,
    padY,
  };
};

let _debugOnce = true;

export const detectFaces = async (
  img: ImageBitmap | HTMLCanvasElement | HTMLImageElement,
): Promise<FaceDetection[]> => {
  const session = await getSession('/models/det_500m.onnx');
  const { tensor, scale, padX, padY } = preprocessImage(img);

  const inputName = session.inputNames[0];
  const results = await session.run({ [inputName]: tensor });

  const outputNames = session.outputNames;

  // Debug: print output names and shapes once
  if (_debugOnce) {
    _debugOnce = false;
    console.debug('[SCRFD] Output names:', outputNames);
    for (const name of outputNames) {
      const t = results[name];
      console.debug(`  ${name}: dims=${JSON.stringify(t.dims)}, size=${t.size}`);
    }
  }

  // Detect number of anchors from first score output shape
  const firstScoreDims = results[outputNames[0]].dims;
  const fmH = Math.ceil(INPUT_SIZE / STRIDES[0]);
  const fmW = Math.ceil(INPUT_SIZE / STRIDES[0]);
  const numAnchors = Math.round(
    (firstScoreDims as number[]).reduce((a, b) => a * b, 1) / (fmH * fmW),
  );

  console.debug('[SCRFD] Detected numAnchors:', numAnchors);

  const allDetections: FaceDetection[] = [];

  // SCRFD outputs: 9 tensors = 3 strides × (scores, bbox, kps)
  for (let strideIdx = 0; strideIdx < STRIDES.length; strideIdx++) {
    const stride = STRIDES[strideIdx];
    const anchors = generateAnchors(INPUT_SIZE, INPUT_SIZE, stride, numAnchors);

    const scoreOutput = results[outputNames[strideIdx]].data as Float32Array;
    const bboxOutput = results[outputNames[strideIdx + FMC]].data as Float32Array;
    const kpsOutput = results[outputNames[strideIdx + FMC * 2]].data as Float32Array;

    for (let i = 0; i < anchors.length; i++) {
      const score = scoreOutput[i];
      if (score < SCORE_THRESH) continue;

      const bboxSlice = bboxOutput.subarray(i * 4, i * 4 + 4);
      const bbox = distance2bbox(anchors[i], bboxSlice, stride);

      const kpsSlice = kpsOutput.subarray(i * 10, i * 10 + 10);
      const landmarks = distance2kps(anchors[i], kpsSlice, stride);

      // Scale back to original image coordinates
      allDetections.push({
        bbox: [
          (bbox[0] - padX) / scale,
          (bbox[1] - padY) / scale,
          (bbox[2] - padX) / scale,
          (bbox[3] - padY) / scale,
        ],
        score,
        landmarks: landmarks.map(([x, y]) => [(x - padX) / scale, (y - padY) / scale]),
      });
    }
  }

  const kept = nms(allDetections, NMS_THRESH);

  // Return largest face (by area)
  if (kept.length === 0) return [];

  kept.sort((a, b) => {
    const areaA = (a.bbox[2] - a.bbox[0]) * (a.bbox[3] - a.bbox[1]);
    const areaB = (b.bbox[2] - b.bbox[0]) * (b.bbox[3] - b.bbox[1]);
    return areaB - areaA;
  });

  console.debug('[SCRFD] Detected face:', {
    bbox: kept[0].bbox,
    score: kept[0].score,
    landmarks: kept[0].landmarks,
  });

  return [kept[0]];
};
