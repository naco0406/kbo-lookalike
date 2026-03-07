import type { FC } from 'react';
import { useMemo, useState, useEffect, useRef } from 'react';
import { STAGE_MESSAGES, pickRandom } from '@/constants/analysis-messages';

interface StageAiAnalysisProps {
  croppedFaceUrl?: string;
  previewUrl: string;
}

// 이퀄라이저 바 32개
const EQ_BARS = Array.from({ length: 32 }, (_, i) => ({
  id: i,
  minH: 0.15 + Math.random() * 0.2,
  maxH: 0.5 + Math.random() * 0.5,
  duration: `${0.5 + Math.random() * 0.7}s`,
  delay: `${i * 0.03}s`,
}));

// 얼굴 특징 크롭 — 2개씩 좌우 교대 표시
// cropX/Y: 얼굴 이미지 내 해당 부위의 대략적 위치 (%)
// zoom: 확대 배율
const FEATURE_SETS: Array<
  Array<{
    text: string;
    cropX: number;
    cropY: number;
    zoom: number;
    pos: string;
  }>
> = [
  [
    { text: '눈매', cropX: 50, cropY: 32, zoom: 2.8, pos: 'top-2 right-full mr-3' },
    { text: '턱선', cropX: 50, cropY: 82, zoom: 2.8, pos: 'bottom-2 left-full ml-3' },
  ],
  [
    { text: '이마 비율', cropX: 50, cropY: 14, zoom: 2.5, pos: 'top-2 left-full ml-3' },
    { text: '입 모양', cropX: 50, cropY: 68, zoom: 3, pos: 'bottom-2 right-full mr-3' },
  ],
  [
    { text: '코 높이', cropX: 50, cropY: 50, zoom: 3, pos: 'top-1/3 right-full mr-3' },
    { text: '광대뼈', cropX: 30, cropY: 46, zoom: 2.8, pos: 'top-1/3 left-full ml-3' },
  ],
];

export const StageAiAnalysis: FC<StageAiAnalysisProps> = ({ croppedFaceUrl, previewUrl }) => {
  const message = useMemo(() => pickRandom(STAGE_MESSAGES.aiAnalysis), []);
  const imageUrl = croppedFaceUrl ?? previewUrl;

  // 특징 세트 순환 (2개씩 1.6초 주기)
  const [featureIdx, setFeatureIdx] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    timerRef.current = setInterval(() => {
      setFeatureIdx((prev) => (prev + 1) % FEATURE_SETS.length);
    }, 1600);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const currentFeatures = FEATURE_SETS[featureIdx];

  return (
    <div className="flex flex-col items-center gap-6">
      {/* 얼굴 + 배경 펄스 */}
      <div className="relative flex items-center justify-center">
        {/* 은은한 그라데이션 펄스 배경 */}
        <div
          className="animate-processing-breathe absolute h-52 w-52 rounded-full sm:h-60 sm:w-60"
          style={{
            background:
              'radial-gradient(circle, oklch(0.5 0 0 / 0.07) 0%, oklch(0.5 0 0 / 0.03) 50%, transparent 70%)',
          }}
        />

        {/* 얼굴 이미지 + 특징 크롭 */}
        <div className="relative">
          <div className="h-36 w-36 overflow-hidden rounded-2xl shadow-xl sm:h-44 sm:w-44">
            <img src={imageUrl} alt="분석 중" className="h-full w-full object-cover" />
          </div>

          {/* 특징 크롭 원형 뷰 — 얼굴 부위를 확대해 원 안에 표시 */}
          {currentFeatures.map((feature, idx) => (
            <div
              key={`${featureIdx}-${idx}`}
              className={`animate-feature-circle pointer-events-none absolute ${feature.pos} flex flex-col items-center gap-1`}
            >
              <div
                className="h-10 w-10 rounded-full border-2 border-foreground/20 shadow-md sm:h-12 sm:w-12"
                style={{
                  backgroundImage: `url(${imageUrl})`,
                  backgroundSize: `${feature.zoom * 100}%`,
                  backgroundPosition: `${feature.cropX}% ${feature.cropY}%`,
                }}
              />
              <span className="whitespace-nowrap rounded-full bg-foreground/10 px-2 py-0.5 text-[10px] font-medium text-foreground/70 backdrop-blur-sm">
                {feature.text}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* 512-D 이퀄라이저 바 */}
      <div className="flex h-8 w-52 items-end gap-px overflow-hidden rounded-lg bg-muted/30 px-1.5 py-1.5">
        {EQ_BARS.map((bar) => (
          <div
            key={bar.id}
            className="animate-equalizer flex-1 rounded-full bg-foreground/25"
            style={{
              '--min-h': bar.minH,
              '--max-h': bar.maxH,
              '--eq-duration': bar.duration,
              '--delay': bar.delay,
            } as React.CSSProperties}
          />
        ))}
      </div>

      {/* 메시지 */}
      <p className="text-muted-foreground text-center text-sm font-medium">{message}</p>
    </div>
  );
};
