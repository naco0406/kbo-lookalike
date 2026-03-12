import type { FC } from 'react';
import { useEffect } from 'react';
import { useNavigate } from 'react-router';
import { ImageUpload } from '@/components/upload/image-upload';
import { ProcessingScreen } from '@/components/processing/processing-screen';
import { Button } from '@/components/ui/button';
import { useFacePipeline } from '@/hooks/use-face-pipeline';
import { AlertTriangle, RefreshCw, ImagePlus, Search, ShieldCheck } from 'lucide-react';
import type { ErrorType } from '@/types/app-state';

const ERROR_CONFIG: Record<ErrorType, { title: string; tips: string[] }> = {
  NO_FACE_DETECTED: {
    title: '얼굴을 찾을 수 없습니다',
    tips: ['정면을 바라보는 사진을 사용해주세요', '얼굴이 잘 보이고 밝은 사진이 좋아요'],
  },
  MODEL_LOAD_FAILED: {
    title: 'AI 모델을 불러올 수 없습니다',
    tips: ['인터넷 연결을 확인해주세요', '페이지를 새로고침한 후 다시 시도해주세요'],
  },
  UNKNOWN: {
    title: '분석 중 오류가 발생했습니다',
    tips: ['다시 시도해주세요', '문제가 계속되면 페이지를 새로고침해주세요'],
  },
};

export const HomePage: FC = () => {
  const navigate = useNavigate();
  const { state, run, selectImage, selectAndRun, reset } = useFacePipeline();

  useEffect(() => {
    if (state.phase === 'result') {
      navigate('/lookalike/result');
    }
  }, [state.phase, navigate]);

  useEffect(() => {
    if (state.phase === 'processing') {
      document.body.classList.add('overscroll-none');
      return () => document.body.classList.remove('overscroll-none');
    }
  }, [state.phase]);

  // ── Processing ──
  if (state.phase === 'processing') {
    return (
      <div className="flex flex-1 items-center justify-center px-5">
        <ProcessingScreen
          step={state.step}
          previewUrl={state.previewUrl}
          faceRect={state.faceRect}
          croppedFaceUrl={state.croppedFaceUrl}
          positionResult={state.positionResult}
          teamResult={state.teamResult}
          isBaseballFace={state.isBaseballFace}
          pendingMatches={state.pendingMatches}
        />
      </div>
    );
  }

  // ── Error ──
  if (state.phase === 'error') {
    const config = ERROR_CONFIG[state.errorType];
    return (
      <div className="flex flex-1 items-center justify-center px-5">
        <div className="w-full max-w-sm animate-reveal-up">
          <div className="mx-auto mb-6 h-28 w-28 overflow-hidden rounded-2xl opacity-30">
            <img
              src={state.previewUrl}
              alt="업로드한 사진"
              className="h-full w-full object-cover"
            />
          </div>

          <div className="rounded-2xl border p-5 text-center sm:p-6">
            <div className="bg-destructive/10 mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-full">
              <AlertTriangle className="text-destructive h-4.5 w-4.5" />
            </div>
            <h2 className="mb-1 text-[15px] font-semibold">{config.title}</h2>
            <ul className="text-muted-foreground mb-5 space-y-0.5 text-[13px]">
              {config.tips.map((tip) => (
                <li key={tip}>{tip}</li>
              ))}
            </ul>
            <div className="flex gap-2.5">
              <Button
                onClick={reset}
                variant="outline"
                className="h-11 flex-1 text-[13px] active:scale-[0.97]"
              >
                <ImagePlus className="mr-1.5 h-4 w-4" />
                다른 사진
              </Button>
              <Button onClick={run} className="h-11 flex-1 text-[13px] active:scale-[0.97]">
                <RefreshCw className="mr-1.5 h-4 w-4" />
                다시 시도
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Preview (image selected) ──
  if (state.phase === 'preview') {
    return (
      <div className="flex flex-1 items-center justify-center px-5">
        <div className="flex w-full max-w-sm flex-col items-center gap-5 animate-scale-reveal">
          <div className="relative aspect-[3/4] w-full max-w-[260px] overflow-hidden rounded-3xl shadow-xl">
            <img
              src={state.previewUrl}
              alt="선택한 사진"
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/25 to-transparent" />
          </div>
          <div className="flex w-full max-w-[260px] gap-2.5">
            <Button
              onClick={run}
              className="h-11 flex-1 text-[14px] active:scale-[0.97]"
            >
              <Search className="mr-1.5 h-4 w-4" />
              닮은꼴 찾기
            </Button>
            <Button
              onClick={reset}
              variant="outline"
              className="h-11 active:scale-[0.97]"
            >
              다른 사진
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ── Idle (landing) ──
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-5 pb-6">
      {/* Hero */}
      <div className="mb-10 max-w-xs text-center animate-reveal-up sm:mb-12 sm:max-w-sm">
        <p
          className="text-muted-foreground mb-3 text-[11px] font-medium uppercase tracking-[0.2em] animate-reveal-up"
        >
          763명의 KBO 프로야구 선수
        </p>
        <h1 className="text-[2rem] leading-[1.2] font-extrabold tracking-tight sm:text-[2.5rem]">
          나와 닮은
          <br />
          KBO 선수는?
        </h1>
        <p
          className="text-muted-foreground mt-3 text-balance text-[15px] leading-relaxed animate-reveal-up"
          style={{ animationDelay: '100ms' }}
        >
          사진 한 장이면 AI가 찾아드립니다
        </p>
      </div>

      {/* Upload */}
      <div
        className="w-full max-w-sm animate-reveal-up"
        style={{ animationDelay: '200ms' }}
      >
        <ImageUpload onImageSelect={selectImage} onCameraConfirm={selectAndRun} />
      </div>

      {/* Trust badge */}
      <div
        className="mt-6 flex items-center gap-1.5 animate-reveal-up"
        style={{ animationDelay: '400ms' }}
      >
        <ShieldCheck className="text-muted-foreground/50 h-3.5 w-3.5 shrink-0" />
        <span className="text-muted-foreground/50 text-[11px]">
          사진은 기기에서만 처리되며 서버로 전송되지 않습니다
        </span>
      </div>
    </div>
  );
};
