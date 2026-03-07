import type { FC } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
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
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="flex max-h-[90dvh] max-w-[90vw] flex-col items-center justify-center gap-0 border-none bg-black/95 p-0 sm:max-w-lg"
      >
        {/* 접근성을 위한 숨겨진 타이틀 */}
        <DialogTitle className="sr-only">{alt}</DialogTitle>

        {/* 닫기 버튼 */}
        <button
          onClick={() => onOpenChange(false)}
          className="absolute top-3 right-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-sm transition-colors hover:bg-white/20"
        >
          <X className="h-4 w-4" />
        </button>

        {/* 이미지 (핀치 줌 지원) */}
        <div className="flex flex-1 items-center justify-center overflow-auto p-4" style={{ touchAction: 'pinch-zoom' }}>
          <img
            src={src}
            alt={alt}
            className="max-h-[75dvh] max-w-full rounded-lg object-contain"
            draggable={false}
          />
        </div>

        {/* 라벨 오버레이 */}
        {label && (
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-4 pb-5 pt-10 text-center text-white">
            <p className="text-lg font-bold">{label}</p>
            {sublabel && (
              <p className="mt-0.5 text-sm text-white/70">{sublabel}</p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
