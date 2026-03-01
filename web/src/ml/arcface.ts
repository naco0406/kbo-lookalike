import { getSession, ort } from './ort-session';

const INPUT_SIZE = 112;

/**
 * Extract 512-D face embedding from aligned 112×112 face image.
 * Normalization: (pixel - 127.5) / 127.5 (different from SCRFD's /128.0)
 */
export const extractEmbedding = async (alignedFace: ImageData): Promise<Float32Array> => {
  const session = await getSession('/models/w600k_mbf.onnx');
  const pixels = alignedFace.data;
  const size = INPUT_SIZE * INPUT_SIZE;
  const float32 = new Float32Array(3 * size);

  for (let i = 0; i < size; i++) {
    const base = i * 4;
    float32[i] = (pixels[base] - 127.5) / 127.5; // R
    float32[size + i] = (pixels[base + 1] - 127.5) / 127.5; // G
    float32[2 * size + i] = (pixels[base + 2] - 127.5) / 127.5; // B
  }

  const tensor = new ort.Tensor('float32', float32, [1, 3, INPUT_SIZE, INPUT_SIZE]);
  const inputName = session.inputNames[0];
  const results = await session.run({ [inputName]: tensor });
  const outputName = session.outputNames[0];
  const raw = results[outputName].data as Float32Array;

  // L2 normalize
  let norm = 0;
  for (let i = 0; i < raw.length; i++) {
    norm += raw[i] * raw[i];
  }
  norm = Math.sqrt(norm);

  const normalized = new Float32Array(raw.length);
  for (let i = 0; i < raw.length; i++) {
    normalized[i] = raw[i] / norm;
  }

  return normalized;
};
