/**
 * Face alignment using similarity transform.
 * Ports insightface/utils/face_align.py norm_crop logic.
 */

const ARCFACE_DST = [
  [38.2946, 51.6963],
  [73.5318, 51.5014],
  [56.0252, 71.7366],
  [41.5493, 92.3655],
  [70.7299, 92.2041],
];

const OUTPUT_SIZE = 112;

/**
 * Estimate similarity transform matrix (4-DOF: scale, rotation, tx, ty)
 * from source points to destination points using least squares.
 *
 * Transform: dx = a*sx - b*sy + tx, dy = b*sx + a*sy + ty
 * where a = s*cos(θ), b = s*sin(θ)
 */
const estimateSimilarityTransform = (
  src: number[][],
  dst: number[][],
): [number, number, number, number] => {
  const n = src.length;
  let sumSrcX = 0,
    sumSrcY = 0,
    sumDstX = 0,
    sumDstY = 0;

  for (let i = 0; i < n; i++) {
    sumSrcX += src[i][0];
    sumSrcY += src[i][1];
    sumDstX += dst[i][0];
    sumDstY += dst[i][1];
  }

  const meanSrcX = sumSrcX / n;
  const meanSrcY = sumSrcY / n;
  const meanDstX = sumDstX / n;
  const meanDstY = sumDstY / n;

  let num1 = 0,
    num2 = 0,
    den = 0;

  for (let i = 0; i < n; i++) {
    const sx = src[i][0] - meanSrcX;
    const sy = src[i][1] - meanSrcY;
    const dx = dst[i][0] - meanDstX;
    const dy = dst[i][1] - meanDstY;

    num1 += dx * sx + dy * sy;
    num2 += dy * sx - dx * sy;
    den += sx * sx + sy * sy;
  }

  const a = num1 / den;
  const b = num2 / den;
  const tx = meanDstX - a * meanSrcX + b * meanSrcY;
  const ty = meanDstY - b * meanSrcX - a * meanSrcY;

  return [a, b, tx, ty];
};

/**
 * Bilinear interpolation of a pixel in the source image.
 */
const bilinearSample = (
  data: Uint8ClampedArray,
  width: number,
  height: number,
  x: number,
  y: number,
  channel: number,
): number => {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = x0 + 1;
  const y1 = y0 + 1;

  if (x0 < 0 || y0 < 0 || x1 >= width || y1 >= height) return 0;

  const fx = x - x0;
  const fy = y - y0;

  const idx00 = (y0 * width + x0) * 4 + channel;
  const idx01 = (y0 * width + x1) * 4 + channel;
  const idx10 = (y1 * width + x0) * 4 + channel;
  const idx11 = (y1 * width + x1) * 4 + channel;

  return (
    data[idx00] * (1 - fx) * (1 - fy) +
    data[idx01] * fx * (1 - fy) +
    data[idx10] * (1 - fx) * fy +
    data[idx11] * fx * fy
  );
};

/**
 * Warp + crop face to 112×112 aligned image.
 * Uses inverse mapping: for each output pixel, find source pixel.
 *
 * Forward:  d = M * s  where M = [[a, -b, tx], [b, a, ty]]
 * Inverse:  s = M^-1 * d
 *   sx = (a*(dx-tx) + b*(dy-ty)) / det
 *   sy = (-b*(dx-tx) + a*(dy-ty)) / det
 */
export const alignFace = (
  img: ImageBitmap | HTMLCanvasElement | HTMLImageElement,
  landmarks: number[][],
): ImageData => {
  // Get source image pixels
  const srcCanvas = document.createElement('canvas');
  const w = 'naturalWidth' in img ? img.naturalWidth : img.width;
  const h = 'naturalHeight' in img ? img.naturalHeight : img.height;
  srcCanvas.width = w;
  srcCanvas.height = h;
  const srcCtx = srcCanvas.getContext('2d')!;
  srcCtx.drawImage(img, 0, 0);
  const srcData = srcCtx.getImageData(0, 0, w, h);

  // Compute forward transform: src landmarks → ARCFACE_DST
  const [a, b, tx, ty] = estimateSimilarityTransform(landmarks, ARCFACE_DST);

  console.debug('[FaceAlign] transform params:', { a, b, tx, ty });

  // Inverse transform: dst pixel → src pixel
  const det = a * a + b * b;

  const output = new ImageData(OUTPUT_SIZE, OUTPUT_SIZE);
  const outData = output.data;

  for (let dy = 0; dy < OUTPUT_SIZE; dy++) {
    for (let dx = 0; dx < OUTPUT_SIZE; dx++) {
      const ddx = dx - tx;
      const ddy = dy - ty;
      const sx = (a * ddx + b * ddy) / det;
      const sy = (-b * ddx + a * ddy) / det;

      const outIdx = (dy * OUTPUT_SIZE + dx) * 4;
      outData[outIdx] = bilinearSample(srcData.data, w, h, sx, sy, 0);
      outData[outIdx + 1] = bilinearSample(srcData.data, w, h, sx, sy, 1);
      outData[outIdx + 2] = bilinearSample(srcData.data, w, h, sx, sy, 2);
      outData[outIdx + 3] = 255;
    }
  }

  return output;
};
