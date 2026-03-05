import type { FC } from 'react';
import { useEffect } from 'react';
import { useNavigate } from 'react-router';
import { ImageUpload } from '@/components/upload/image-upload';
import { ProcessingScreen } from '@/components/processing/processing-screen';
import { Button } from '@/components/ui/button';
import { useFacePipeline } from '@/hooks/use-face-pipeline';
import { AlertTriangle, RefreshCw, ImagePlus, Sparkles, ShieldCheck } from 'lucide-react';
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
  const { state, run, selectImage, reset } = useFacePipeline();

  useEffect(() => {
    if (state.phase === 'result') {
      navigate('/result');
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
      <div className="container mx-auto px-4 py-8">
        <ProcessingScreen step={state.step} previewUrl={state.previewUrl} />
      </div>
    );
  }

  // ── Error ──
  if (state.phase === 'error') {
    const config = ERROR_CONFIG[state.errorType];
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="mx-auto max-w-sm animate-reveal-up">
          <div className="bg-muted mx-auto mb-6 h-44 w-44 overflow-hidden rounded-full opacity-50">
            <img
              src={state.previewUrl}
              alt="업로드한 사진"
              className="h-full w-full object-cover"
            />
          </div>

          <div className="rounded-2xl border p-6 text-center">
            <div className="bg-destructive/10 mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-full">
              <AlertTriangle className="text-destructive h-5 w-5" />
            </div>
            <h2 className="mb-1.5 text-base font-semibold">{config.title}</h2>
            <ul className="text-muted-foreground mb-6 space-y-0.5 text-sm">
              {config.tips.map((tip) => (
                <li key={tip}>{tip}</li>
              ))}
            </ul>
            <div className="flex gap-3">
              <Button
                onClick={reset}
                variant="outline"
                className="flex-1 active:scale-[0.97]"
                size="lg"
              >
                <ImagePlus className="mr-2 h-4 w-4" />
                다른 사진
              </Button>
              <Button onClick={run} className="flex-1 active:scale-[0.97]" size="lg">
                <RefreshCw className="mr-2 h-4 w-4" />
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
      <div className="container mx-auto px-4 py-8">
        <div className="mx-auto flex max-w-sm flex-col items-center gap-5 animate-scale-reveal">
          <div className="relative aspect-square w-full overflow-hidden rounded-3xl shadow-lg">
            <img
              src={state.previewUrl}
              alt="선택한 사진"
              className="h-full w-full object-cover"
            />
            {/* Gradient overlay at bottom */}
            <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/30 to-transparent" />
          </div>
          <div className="flex w-full gap-3">
            <Button onClick={run} className="flex-1 active:scale-[0.97]" size="lg">
              <Sparkles className="mr-2 h-4 w-4" />
              분석 시작
            </Button>
            <Button
              onClick={reset}
              variant="outline"
              size="lg"
              className="active:scale-[0.97]"
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
    <div className="container mx-auto flex flex-col items-center px-4 py-10 sm:py-16">
      <div className="mb-10 max-w-md text-center animate-reveal-up sm:mb-14">
        <h1 className="text-[2rem] leading-tight font-bold tracking-tight sm:text-4xl">
          나와 닮은
          <br />
          KBO 선수는?
        </h1>
        <p className="text-muted-foreground mt-4 text-balance text-sm leading-relaxed sm:text-base">
          763명의 KBO 프로야구 선수 중
          <br className="sm:hidden" />
          {' '}나와 가장 닮은 선수를 찾아보세요
        </p>
      </div>

      <div className="w-full animate-reveal-up" style={{ animationDelay: '150ms' }}>
        <ImageUpload onImageSelect={selectImage} />
      </div>

      {/* Trust badge */}
      <div
        className="mt-10 flex items-center gap-2 animate-reveal-up"
        style={{ animationDelay: '300ms' }}
      >
        <ShieldCheck className="text-muted-foreground h-3.5 w-3.5" />
        <span className="text-muted-foreground text-xs">
          사진은 브라우저에서만 처리됩니다
        </span>
      </div>
    </div>
  );
};
