import type { FC } from 'react';
import { useRef, useCallback } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useDragToDismiss } from '@/hooks/use-drag-to-dismiss';
import { X } from 'lucide-react';

interface ImageLightboxProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  src: string;
  alt: string;
  label?: string;
  sublabel?: string;
}

export const ImageLightbox: FC<ImageLightboxProps> = ({
  open,
  onOpenChange,
  src,
  alt,
  label,
  sublabel,
}) => {
  const contentRef = useRef<HTMLDivElement>(null);
  const handleDismiss = useCallback(() => onOpenChange(false), [onOpenChange]);
  useDragToDismiss(contentRef, handleDismiss);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        ref={contentRef}
        showCloseButton={false}
        className="flex max-h-[85dvh] max-w-[88vw] flex-col items-center gap-0 overflow-hidden border-none bg-black/95 p-0 sm:max-w-md"
      >
        <DialogTitle className="sr-only">{alt}</DialogTitle>
        <DialogDescription className="sr-only">{label ?? alt} 이미지 보기</DialogDescription>

        {/* 닫기 버튼 — 시각 32px, 터치 영역 44px */}
        <button
          onClick={() => onOpenChange(false)}
          className="absolute top-1 right-1 z-10 flex h-11 w-11 items-center justify-center rounded-full text-white transition-colors active:scale-90"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 backdrop-blur-sm">
            <X className="h-4 w-4" />
          </span>
        </button>

        {/* 이미지 */}
        <div
          className="flex flex-1 items-center justify-center overflow-auto p-5"
          style={{ touchAction: 'pinch-zoom' }}
        >
          <img
            src={src}
            alt={alt}
            className="max-h-[70dvh] max-w-full rounded-xl object-contain"
            draggable={false}
          />
        </div>

        {/* 라벨 — 하단 그라디언트 */}
        {label && (
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent px-5 pb-5 pt-12 text-center text-white">
            <p className="text-base font-bold leading-tight">{label}</p>
            {sublabel && (
              <p className="mt-1 text-[13px] text-white/60">{sublabel}</p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
