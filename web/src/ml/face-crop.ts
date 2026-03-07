import type { FaceDetection } from '@/types/player';

/**
 * Crop face region from image as a square with padding.
 * bbox → expand to square (longer side) + 20% padding → clamp to image bounds → Canvas crop.
 */
export const cropFace = (
  image: ImageBitmap | HTMLCanvasElement | HTMLImageElement,
  detection: FaceDetection,
): ImageData => {
  const [x1, y1, x2, y2] = detection.bbox;
  const bw = x2 - x1;
  const bh = y2 - y1;
  const side = Math.max(bw, bh);
  const padded = side * 1.2; // 20% padding

  // Center the square on the bbox center
  const cx = (x1 + x2) / 2;
  const cy = (y1 + y2) / 2;

  const imgW = 'width' in image ? image.width : (image as ImageBitmap).width;
  const imgH = 'height' in image ? image.height : (image as ImageBitmap).height;

  // Clamp to image bounds
  let sx = Math.round(cx - padded / 2);
  let sy = Math.round(cy - padded / 2);
  let sw = Math.round(padded);
  let sh = Math.round(padded);

  if (sx < 0) sx = 0;
  if (sy < 0) sy = 0;
  if (sx + sw > imgW) sw = imgW - sx;
  if (sy + sh > imgH) sh = imgH - sy;

  // Use Canvas to extract the cropped region
  const canvas = document.createElement('canvas');
  canvas.width = sw;
  canvas.height = sh;
  const ctx = canvas.getContext('2d')!;

  if (image instanceof ImageBitmap) {
    ctx.drawImage(image, sx, sy, sw, sh, 0, 0, sw, sh);
  } else {
    ctx.drawImage(image, sx, sy, sw, sh, 0, 0, sw, sh);
  }

  return ctx.getImageData(0, 0, sw, sh);
};

/**
 * Convert ImageData to data URL for display.
 */
export const imageDataToUrl = (imageData: ImageData): string => {
  const canvas = document.createElement('canvas');
  canvas.width = imageData.width;
  canvas.height = imageData.height;
  const ctx = canvas.getContext('2d')!;
  ctx.putImageData(imageData, 0, 0);
  return canvas.toDataURL('image/jpeg', 0.9);
};

/**
 * Convert bbox to face rect for UI overlay positioning (relative to image dimensions).
 */
export const bboxToFaceRect = (
  bbox: [number, number, number, number],
  imgWidth: number,
  imgHeight: number,
): { x: number; y: number; width: number; height: number } => {
  const [x1, y1, x2, y2] = bbox;
  return {
    x: x1 / imgWidth,
    y: y1 / imgHeight,
    width: (x2 - x1) / imgWidth,
    height: (y2 - y1) / imgHeight,
  };
};
