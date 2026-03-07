import type { FC } from 'react';
import { useMemo } from 'react';
import { STAGE_MESSAGES, pickRandom } from '@/constants/analysis-messages';

interface StageFaceDetectionProps {
  previewUrl: string;
  croppedFaceUrl?: string;
  faceRect?: { x: number; y: number; width: number; height: number };
}

export const StageFaceDetection: FC<StageFaceDetectionProps> = ({
  previewUrl,
  croppedFaceUrl,
  faceRect,
}) => {
  const message = useMemo(() => pickRandom(STAGE_MESSAGES.faceDetection), []);
  const showCropped = croppedFaceUrl && faceRect;

  return (
    <div className="flex flex-col items-center gap-6">
      {/* 이미지 영역 — 은은한 glow 배경 */}
      <div className="relative flex items-center justify-center">
        {/* 배경 glow */}
        <div className="absolute h-56 w-56 rounded-full bg-foreground/[0.03] blur-2xl sm:h-64 sm:w-64" />

        <div className="relative h-56 w-56 overflow-hidden rounded-3xl shadow-lg sm:h-64 sm:w-64">
          {/* 원본 → 크롭 crossfade */}
          <img
            src={previewUrl}
            alt="원본"
            className="absolute inset-0 h-full w-full object-cover transition-opacity duration-700"
            style={{ opacity: showCropped ? 0 : 1 }}
          />
          {croppedFaceUrl && (
            <img
              src={croppedFaceUrl}
              alt="얼굴 크롭"
              className="absolute inset-0 h-full w-full object-cover transition-opacity duration-700"
              style={{ opacity: showCropped ? 1 : 0 }}
            />
          )}

          {/* 스캔라인 — 가느다란 1px + 은은한 glow */}
          {!showCropped && (
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
              <div className="animate-scan-line absolute inset-x-0 flex flex-col items-center">
                <div className="h-px w-full bg-white/40 shadow-[0_0_8px_2px_rgba(255,255,255,0.15)]" />
              </div>
            </div>
          )}

          {/* bbox 포커스 프레임 */}
          {faceRect && !showCropped && (
            <div
              className="animate-focus-frame pointer-events-none absolute rounded-xl border border-white/60"
              style={{
                left: `${faceRect.x * 100}%`,
                top: `${faceRect.y * 100}%`,
                width: `${faceRect.width * 100}%`,
                height: `${faceRect.height * 100}%`,
                transition: 'all 0.5s ease-out',
              }}
            />
          )}

          {/* 코너 브래킷 — 섬세한 L자 */}
          <div className="pointer-events-none absolute inset-3">
            <div className="absolute top-0 left-0 h-3 w-3 border-t border-l border-white/30" />
            <div className="absolute top-0 right-0 h-3 w-3 border-t border-r border-white/30" />
            <div className="absolute bottom-0 left-0 h-3 w-3 border-b border-l border-white/30" />
            <div className="absolute bottom-0 right-0 h-3 w-3 border-b border-r border-white/30" />
          </div>
        </div>
      </div>

      {/* 메시지 */}
      <p className="text-muted-foreground text-center text-sm font-medium">
        {message}
      </p>
    </div>
  );
};
