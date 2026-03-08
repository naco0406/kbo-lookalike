import { useState, useEffect, useRef } from 'react';
import { detectFaces } from '@/ml/scrfd';
import { alignFace } from '@/ml/face-align';
import { imageDataToUrl } from '@/ml/face-crop';

/** 선수 이미지를 ArcFace 112×112 정렬된 얼굴로 변환하는 훅 */
export const usePlayerAlign = (
  playerImageUrl: string | null,
): { alignedUrl: string | null; loading: boolean; error: boolean } => {
  const [alignedUrl, setAlignedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const cacheRef = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    if (!playerImageUrl) {
      setAlignedUrl(null);
      setLoading(false);
      setError(false);
      return;
    }

    // 캐시 히트
    const cached = cacheRef.current.get(playerImageUrl);
    if (cached) {
      setAlignedUrl(cached);
      setLoading(false);
      setError(false);
      return;
    }

    let cancelled = false;

    const run = async () => {
      setLoading(true);
      setError(false);
      setAlignedUrl(null);

      try {
        // 1. 이미지 로드 (CORS 필수 — R2 Transform Rule로 헤더 제공)
        const response = await fetch(playerImageUrl, { mode: 'cors' });
        const blob = await response.blob();

        if (cancelled) return;

        // 2. 얼굴 검출
        const bitmap = await createImageBitmap(blob);
        const faces = await detectFaces(bitmap);

        if (cancelled) return;

        if (faces.length === 0) {
          setError(true);
          setLoading(false);
          return;
        }

        // 3. 얼굴 정렬 (112×112)
        const aligned = alignFace(bitmap, faces[0].landmarks);
        const url = imageDataToUrl(aligned);

        if (cancelled) return;

        cacheRef.current.set(playerImageUrl, url);
        setAlignedUrl(url);
        setLoading(false);
      } catch (e) {
        console.error('[usePlayerAlign] Failed:', e);
        if (!cancelled) {
          setError(true);
          setLoading(false);
        }
      }
    };

    run();
    return () => { cancelled = true; };
  }, [playerImageUrl]);

  return { alignedUrl, loading, error };
};
