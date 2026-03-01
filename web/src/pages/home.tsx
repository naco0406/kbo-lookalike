import type { FC } from 'react';
import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { ImageUpload } from '@/components/upload/image-upload';
import { ProcessingScreen } from '@/components/processing/processing-screen';
import { Button } from '@/components/ui/button';
import { useFacePipeline } from '@/hooks/use-face-pipeline';

export const HomePage: FC = () => {
  const navigate = useNavigate();
  const { step, result, error, run, reset } = useFacePipeline();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [bitmap, setBitmap] = useState<ImageBitmap | null>(null);

  const handleImageSelect = useCallback((bmp: ImageBitmap, url: string) => {
    setBitmap(bmp);
    setPreviewUrl(url);
  }, []);

  const handleAnalyze = useCallback(async () => {
    if (!bitmap) return;
    await run(bitmap);
  }, [bitmap, run]);

  const handleReset = useCallback(() => {
    reset();
    setBitmap(null);
    setPreviewUrl(null);
  }, [reset]);

  // Navigate to result when done
  useEffect(() => {
    if (result && previewUrl) {
      navigate('/result', {
        state: {
          matches: result.matches,
          previewUrl,
        },
      });
    }
  }, [result, previewUrl, navigate]);

  // Processing state
  if (step && step !== 'done' && step !== 'error' && previewUrl) {
    return (
      <div className="container mx-auto px-4 py-12">
        <ProcessingScreen step={step} previewUrl={previewUrl} />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="mb-10 text-center">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">나와 닮은 KBO 선수는?</h1>
        <p className="text-muted-foreground mx-auto mt-3 max-w-md">
          사진 한 장으로 763명의 KBO 선수 중 나와 가장 닮은 선수를 찾아보세요. AI가 브라우저에서
          직접 분석합니다.
        </p>
      </div>

      {error && (
        <div className="bg-destructive/10 text-destructive mx-auto mb-6 max-w-sm rounded-lg p-4 text-center text-sm">
          <p>{error}</p>
          <Button onClick={handleReset} variant="outline" size="sm" className="mt-3">
            다시 시도
          </Button>
        </div>
      )}

      {!bitmap && <ImageUpload onImageSelect={handleImageSelect} />}

      {bitmap && previewUrl && !step && (
        <div className="mx-auto flex max-w-sm flex-col items-center gap-6">
          <div className="bg-muted aspect-square w-full overflow-hidden rounded-xl">
            <img src={previewUrl} alt="선택한 사진" className="h-full w-full object-cover" />
          </div>
          <div className="flex w-full gap-3">
            <Button onClick={handleAnalyze} className="flex-1" size="lg">
              분석 시작
            </Button>
            <Button onClick={handleReset} variant="outline" size="lg">
              다른 사진
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
