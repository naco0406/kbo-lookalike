import type { FC } from 'react';
import { useState, useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Slider } from '@/components/ui/slider';
import { usePlayerAlign } from '@/hooks/use-player-align';
import { X, Loader2 } from 'lucide-react';

interface FaceMorphDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userAlignedUrl: string;
  playerImageUrl: string;
  playerName: string;
}

const CANVAS_SIZE = 112;

export const FaceMorphDialog: FC<FaceMorphDialogProps> = ({
  open,
  onOpenChange,
  userAlignedUrl,
  playerImageUrl,
  playerName,
}) => {
  const [blend, setBlend] = useState(50);
  const [imagesLoaded, setImagesLoaded] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const userImgRef = useRef<HTMLImageElement | null>(null);
  const playerImgRef = useRef<HTMLImageElement | null>(null);

  const { alignedUrl: playerAlignedUrl, loading, error } = usePlayerAlign(
    open ? playerImageUrl : null,
  );

  // 이미지 로드
  useEffect(() => {
    if (!open || !userAlignedUrl) return;
    const img = new Image();
    img.onload = () => {
      userImgRef.current = img;
      setImagesLoaded((c) => c + 1);
    };
    img.src = userAlignedUrl;
  }, [open, userAlignedUrl]);

  useEffect(() => {
    if (!playerAlignedUrl) return;
    const img = new Image();
    img.onload = () => {
      playerImgRef.current = img;
      setImagesLoaded((c) => c + 1);
    };
    img.src = playerAlignedUrl;
  }, [playerAlignedUrl]);

  // 캔버스 블렌드 렌더
  useEffect(() => {
    const canvas = canvasRef.current;
    const userImg = userImgRef.current;
    const playerImg = playerImgRef.current;
    if (!canvas || !userImg || !playerImg) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    // 유저 얼굴 (base)
    ctx.globalAlpha = 1;
    ctx.drawImage(userImg, 0, 0, CANVAS_SIZE, CANVAS_SIZE);

    // 선수 얼굴 (overlay)
    ctx.globalAlpha = blend / 100;
    ctx.drawImage(playerImg, 0, 0, CANVAS_SIZE, CANVAS_SIZE);

    ctx.globalAlpha = 1;
  }, [blend, imagesLoaded]);

  // 다이얼로그 열릴 때 초기화
  useEffect(() => {
    if (open) {
      setBlend(50);
      setImagesLoaded(0);
      userImgRef.current = null;
      playerImgRef.current = null;
    }
  }, [open]);

  const isReady = !loading && !error && playerAlignedUrl;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="flex max-h-[90dvh] max-w-[88vw] flex-col items-center gap-0 overflow-hidden border-none bg-black/95 p-0 sm:max-w-sm"
      >
        <DialogTitle className="sr-only">얼굴 겹치기 비교</DialogTitle>
        <DialogDescription className="sr-only">슬라이더로 두 얼굴을 겹쳐 비교합니다</DialogDescription>

        {/* 닫기 버튼 */}
        <button
          onClick={() => onOpenChange(false)}
          className="absolute top-3 right-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-sm transition-colors hover:bg-white/20"
        >
          <X className="h-4 w-4" />
        </button>

        {/* 콘텐츠 영역 */}
        <div className="flex w-full flex-col items-center px-6 pt-12 pb-8">
          {/* 캔버스 — 정사각형, 가용 폭에 맞춤 */}
          <div className="aspect-square w-full max-w-[280px] overflow-hidden rounded-3xl ring-1 ring-white/10">
            {loading ? (
              <div className="flex h-full w-full items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-white/30" />
              </div>
            ) : error ? (
              <div className="flex h-full w-full flex-col items-center justify-center gap-1.5">
                <p className="text-[13px] text-white/40">얼굴을 찾을 수 없어요</p>
              </div>
            ) : (
              <canvas
                ref={canvasRef}
                width={CANVAS_SIZE}
                height={CANVAS_SIZE}
                className="h-full w-full"
                style={{ imageRendering: 'auto' }}
              />
            )}
          </div>

          {/* 슬라이더 + 얼굴 썸네일 */}
          {isReady && (
            <div className="mt-8 w-full max-w-[300px]">
              <div className="flex items-center gap-3">
                {/* 유저 얼굴 */}
                <div className="h-9 w-9 shrink-0 overflow-hidden rounded-full ring-1 ring-white/15">
                  <img src={userAlignedUrl} alt="나" className="h-full w-full object-cover" />
                </div>

                <div className="flex-1">
                  <Slider
                    value={[blend]}
                    onValueChange={([v]) => setBlend(v)}
                    min={0}
                    max={100}
                    step={1}
                    className="[&_[data-slot=slider-track]]:bg-white/15 [&_[data-slot=slider-range]]:bg-white/40 [&_[data-slot=slider-thumb]]:border-white/60 [&_[data-slot=slider-thumb]]:bg-white"
                  />
                </div>

                {/* 선수 얼굴 */}
                <div className="h-9 w-9 shrink-0 overflow-hidden rounded-full ring-1 ring-white/15">
                  <img src={playerAlignedUrl} alt={playerName} className="h-full w-full object-cover" />
                </div>
              </div>

              <div className="mt-2.5 flex justify-between px-0.5 text-[11px] text-white/40">
                <span>나</span>
                <span>{playerName}</span>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
