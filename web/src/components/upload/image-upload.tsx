import type { FC } from 'react';
import { useCallback, useRef, useState } from 'react';
import { Camera, ImagePlus, X } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { blobUrlToDataUrl } from '@/lib/image-utils';

interface ImageUploadProps {
  onImageSelect: (bitmap: ImageBitmap, previewUrl: string) => void;
}

export const ImageUpload: FC<ImageUploadProps> = ({ onImageSelect }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const processFile = useCallback(
    async (file: File) => {
      const url = URL.createObjectURL(file);
      const [bitmap, dataUrl] = await Promise.all([createImageBitmap(file), blobUrlToDataUrl(url)]);
      URL.revokeObjectURL(url);
      onImageSelect(bitmap, dataUrl);
    },
    [onImageSelect],
  );

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) processFile(file);
    },
    [processFile],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file?.type.startsWith('image/')) processFile(file);
    },
    [processFile],
  );

  const startCamera = useCallback(async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 640 } },
      });
      setStream(mediaStream);
      setCameraActive(true);
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
      });
    } catch {
      toast.error('카메라 접근이 거부되었습니다');
    }
  }, []);

  const stopCamera = useCallback(() => {
    stream?.getTracks().forEach((t) => t.stop());
    setStream(null);
    setCameraActive(false);
  }, [stream]);

  const capturePhoto = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(video, 0, 0);

    const bitmap = await createImageBitmap(canvas);
    const url = canvas.toDataURL('image/jpeg', 0.9);
    stopCamera();
    onImageSelect(bitmap, url);
  }, [onImageSelect, stopCamera]);

  // ── Camera Mode ──
  if (cameraActive) {
    return (
      <div className="mx-auto flex max-w-sm flex-col items-center gap-4 animate-scale-reveal">
        <div className="relative aspect-[3/4] w-full max-w-[300px] overflow-hidden rounded-3xl bg-black shadow-2xl">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="h-full w-full -scale-x-100 object-cover"
          />
          {/* Face guide */}
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="h-[55%] w-[50%] rounded-full border-2 border-white/20" />
          </div>
          {/* Bottom controls overlay */}
          <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-6 bg-gradient-to-t from-black/70 via-black/20 to-transparent px-6 pb-6 pt-20">
            <button
              onClick={stopCamera}
              className="flex h-11 w-11 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur-md transition-all active:scale-90"
            >
              <X className="h-4.5 w-4.5" />
            </button>
            <button
              onClick={capturePhoto}
              className="flex h-[72px] w-[72px] items-center justify-center rounded-full border-[3px] border-white transition-all active:scale-90"
            >
              <div className="h-[58px] w-[58px] rounded-full bg-white" />
            </button>
            <div className="h-11 w-11" /> {/* spacer for centering */}
          </div>
        </div>
      </div>
    );
  }

  // ── Upload Mode ──
  return (
    <div className="mx-auto flex w-full max-w-sm flex-col items-center gap-3">
      {/* Primary CTA — 카메라 */}
      <button
        onClick={startCamera}
        className="group flex w-full items-center gap-4 rounded-2xl bg-foreground px-5 py-4 text-background transition-all active:scale-[0.98]"
      >
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-background/15">
          <Camera className="h-5 w-5" />
        </div>
        <div className="text-left">
          <p className="text-[15px] font-semibold">카메라로 촬영</p>
          <p className="mt-0.5 text-xs opacity-60">셀카 한 장이면 충분해요</p>
        </div>
      </button>

      {/* Secondary — 앨범 */}
      <button
        onClick={() => fileInputRef.current?.click()}
        className={cn(
          'group flex w-full items-center gap-4 rounded-2xl border px-5 py-4 transition-all active:scale-[0.98]',
          isDragOver
            ? 'border-foreground bg-foreground/5'
            : 'border-border bg-card hover:border-foreground/20',
        )}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
      >
        <div
          className={cn(
            'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-colors',
            isDragOver ? 'bg-foreground/10' : 'bg-muted',
          )}
        >
          <ImagePlus
            className={cn(
              'h-5 w-5 transition-colors',
              isDragOver ? 'text-foreground' : 'text-muted-foreground',
            )}
          />
        </div>
        <div className="text-left">
          <p className="text-[15px] font-semibold">앨범에서 선택</p>
          <p className="text-muted-foreground mt-0.5 text-xs">
            {isDragOver ? '여기에 놓으세요' : '갤러리에서 사진을 골라보세요'}
          </p>
        </div>
      </button>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />
    </div>
  );
};
