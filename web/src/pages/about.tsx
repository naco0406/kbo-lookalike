import type { FC } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export const AboutPage: FC = () => {
  return (
    <div className="container mx-auto max-w-lg px-4 py-12">
      <h1 className="mb-6 text-2xl font-bold">소개</h1>

      <div className="flex flex-col gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">KBO 닮은꼴이란?</CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground text-sm">
            AI 얼굴 분석 기술을 활용해 KBO 10개 구단 763명의 선수 중 나와 가장 닮은 선수를 찾아주는
            서비스입니다.
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">개인정보 보호</CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground text-sm">
            모든 얼굴 분석은 브라우저에서 직접 처리됩니다. 사진이 서버로 전송되지 않으며, 어디에도
            저장되지 않습니다.
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">기술 스택</CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground space-y-1 text-sm">
            <p>얼굴 검출: SCRFD (det_500m)</p>
            <p>얼굴 인식: MobileFaceNet / ArcFace (w600k_mbf)</p>
            <p>추론 엔진: ONNX Runtime Web (WASM+SIMD)</p>
            <p>프론트엔드: React + TypeScript + Vite</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
