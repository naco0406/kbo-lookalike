import type { FC } from 'react';
import { useCallback, useRef, useState } from 'react';
import { Camera, ImagePlus, X, Circle } from 'lucide-react';
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
      <div className="mx-auto flex max-w-sm flex-col items-center gap-4 animate-in fade-in duration-200">
        <div className="relative aspect-square w-full overflow-hidden rounded-3xl bg-black shadow-xl">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="h-full w-full -scale-x-100 object-cover"
          />
          {/* Face guide */}
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="h-[60%] w-[45%] rounded-full border-2 border-white/25" />
          </div>
          {/* Bottom controls overlay */}
          <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-6 bg-gradient-to-t from-black/60 to-transparent px-6 pb-6 pt-16">
            <button
              onClick={stopCamera}
              className="flex h-12 w-12 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur-sm transition-transform active:scale-90"
            >
              <X className="h-5 w-5" />
            </button>
            <button
              onClick={capturePhoto}
              className="flex h-18 w-18 items-center justify-center rounded-full border-4 border-white bg-white/20 text-white backdrop-blur-sm transition-transform active:scale-90"
            >
              <Circle className="h-12 w-12 fill-white text-white" />
            </button>
            <div className="h-12 w-12" /> {/* spacer for centering */}
          </div>
        </div>
      </div>
    );
  }

  // ── Upload Mode ──
  return (
    <div className="mx-auto flex w-full max-w-sm flex-col items-center gap-3">
      {/* Two action cards */}
      <div className="grid w-full grid-cols-2 gap-3">
        {/* Camera card */}
        <button
          onClick={startCamera}
          className="group flex flex-col items-center gap-3 rounded-2xl border-2 border-transparent bg-foreground px-4 py-8 text-background transition-all active:scale-[0.97] sm:py-10"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-background/15 transition-transform group-active:scale-90">
            <Camera className="h-5 w-5" />
          </div>
          <p className="text-sm font-semibold">카메라로 촬영</p>
        </button>

        {/* Album card */}
        <button
          onClick={() => fileInputRef.current?.click()}
          className={cn(
            'group flex flex-col items-center gap-3 rounded-2xl border-2 px-4 py-8 transition-all active:scale-[0.97] sm:py-10',
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
              'flex h-12 w-12 items-center justify-center rounded-full transition-transform group-active:scale-90',
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
          <p className="text-sm font-semibold">앨범에서 선택</p>
        </button>
      </div>

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
