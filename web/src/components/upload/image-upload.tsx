import type { FC } from 'react';
import { useCallback, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Camera, Upload, X } from 'lucide-react';

interface ImageUploadProps {
  onImageSelect: (bitmap: ImageBitmap, previewUrl: string) => void;
}

export const ImageUpload: FC<ImageUploadProps> = ({ onImageSelect }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);

  const processFile = useCallback(
    async (file: File) => {
      const url = URL.createObjectURL(file);
      const bitmap = await createImageBitmap(file);
      onImageSelect(bitmap, url);
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
      alert('카메라 접근이 거부되었습니다.');
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

  if (cameraActive) {
    return (
      <div className="flex flex-col items-center gap-4">
        <div className="relative aspect-square w-full max-w-sm overflow-hidden rounded-xl bg-black">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="h-full w-full -scale-x-100 object-cover"
          />
        </div>
        <div className="flex gap-3">
          <Button onClick={capturePhoto} size="lg">
            촬영
          </Button>
          <Button onClick={stopCamera} variant="outline" size="lg">
            <X className="mr-2 h-4 w-4" />
            취소
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-sm flex-col items-center gap-6">
      <div
        className="border-muted-foreground/30 hover:border-muted-foreground/50 flex aspect-square w-full cursor-pointer flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed transition-colors"
        onClick={() => fileInputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
      >
        <Upload className="text-muted-foreground/50 h-10 w-10" />
        <div className="text-center">
          <p className="text-sm font-medium">사진을 드래그하거나 클릭해서 업로드</p>
          <p className="text-muted-foreground mt-1 text-xs">JPG, PNG, WebP</p>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />

      <div className="flex w-full items-center gap-3">
        <div className="bg-border h-px flex-1" />
        <span className="text-muted-foreground text-xs">또는</span>
        <div className="bg-border h-px flex-1" />
      </div>

      <Button onClick={startCamera} variant="outline" className="w-full">
        <Camera className="mr-2 h-4 w-4" />
        셀카 촬영
      </Button>
    </div>
  );
};
