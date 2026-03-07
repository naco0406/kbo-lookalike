import type { FC } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, ImagePlus, X, RotateCcw, Search, Image } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { blobUrlToDataUrl } from '@/lib/image-utils';
import { detectFaces } from '@/ml/scrfd';

interface ImageUploadProps {
  onImageSelect: (bitmap: ImageBitmap, previewUrl: string) => void;
  /** 카메라 캡처 확인 시 — preview를 건너뛰고 바로 분석 시작 */
  onCameraConfirm?: (bitmap: ImageBitmap, previewUrl: string) => void;
}

type FaceStatus = 'loading' | 'none' | 'ok' | 'too-small' | 'off-center' | 'multiple';
type Mode = 'idle' | 'camera' | 'captured';

const AUTO_CAPTURE_MS = 3000;
const DETECTION_INTERVAL_MS = 600;
const RING_R = 35;
const RING_C = 2 * Math.PI * RING_R;

const STATUS_TEXT: Record<FaceStatus, string> = {
  loading: '얼굴 인식 준비 중...',
  none: '얼굴을 프레임 안에 맞춰주세요',
  ok: '좋아요!',
  'too-small': '좀 더 가까이 와주세요',
  'off-center': '얼굴을 가운데로 맞춰주세요',
  multiple: '한 명만 나오도록 해주세요',
};

export const ImageUpload: FC<ImageUploadProps> = ({ onImageSelect, onCameraConfirm }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const okStartRef = useRef<number | null>(null);
  const rafRef = useRef<number>(0);

  const [mode, setMode] = useState<Mode>('idle');
  const [faceStatus, setFaceStatus] = useState<FaceStatus>('loading');
  const [autoCapProgress, setAutoCapProgress] = useState(0);
  const [capturedData, setCapturedData] = useState<{ bitmap: ImageBitmap; url: string } | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  // ── File handling ──

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
      if (e.target) e.target.value = '';
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

  // ── Camera controls ──

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    cancelAnimationFrame(rafRef.current);
    okStartRef.current = null;
  }, []);

  const startCamera = useCallback(async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 640 } },
      });
      streamRef.current = mediaStream;
      // 상태를 한 번에 전환 — React 배칭으로 idle 깜빡임 방지
      setMode('camera');
      setFaceStatus('loading');
      setAutoCapProgress(0);
      okStartRef.current = null;
      setCapturedData(null);
      // video srcObject 바인딩은 useEffect에서 처리
    } catch {
      toast.error('카메라 접근이 거부되었습니다');
    }
  }, []);

  const closeCamera = useCallback(() => {
    stopCamera();
    setMode('idle');
  }, [stopCamera]);

  const capturePhoto = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d')!.drawImage(video, 0, 0);

    const bitmap = await createImageBitmap(canvas);
    const url = canvas.toDataURL('image/jpeg', 0.9);

    stopCamera();
    setCapturedData({ bitmap, url });
    setMode('captured');
  }, [stopCamera]);

  // Stable ref for auto-capture callback
  const captureRef = useRef(capturePhoto);
  captureRef.current = capturePhoto;

  // ── Video stream 바인딩 (mode가 camera로 전환될 때 안정적으로 연결) ──

  useEffect(() => {
    if (mode !== 'camera') return;

    const bind = () => {
      const video = videoRef.current;
      const stream = streamRef.current;
      if (video && stream && video.srcObject !== stream) {
        video.srcObject = stream;
      }
    };

    // DOM 커밋 직후 + 한 프레임 뒤 재시도 (안전장치)
    bind();
    const id = requestAnimationFrame(bind);
    return () => cancelAnimationFrame(id);
  }, [mode]);

  // ── Face detection loop ──

  useEffect(() => {
    if (mode !== 'camera') return;

    let active = true;
    let timeoutId: ReturnType<typeof setTimeout>;
    let consecutiveErrors = 0;

    const runDetection = async () => {
      const video = videoRef.current;
      if (!active || !video || video.readyState < 2) {
        if (active) timeoutId = setTimeout(runDetection, 300);
        return;
      }

      try {
        const bitmap = await createImageBitmap(video);
        const faces = await detectFaces(bitmap);
        bitmap.close();
        if (!active) return;

        consecutiveErrors = 0;
        let newStatus: FaceStatus;

        if (faces.length === 0) {
          newStatus = 'none';
        } else if (faces.length > 1) {
          newStatus = 'multiple';
        } else {
          const [x1, y1, x2, y2] = faces[0].bbox;
          const imgW = video.videoWidth;
          const imgH = video.videoHeight;
          const faceRatio = Math.max((x2 - x1) / imgW, (y2 - y1) / imgH);

          if (faceRatio < 0.15) {
            newStatus = 'too-small';
          } else {
            const cx = (x1 + x2) / 2 / imgW;
            const cy = (y1 + y2) / 2 / imgH;
            newStatus = Math.abs(cx - 0.5) > 0.2 || Math.abs(cy - 0.5) > 0.25
              ? 'off-center'
              : 'ok';
          }
        }

        setFaceStatus(newStatus);

        if (newStatus === 'ok') {
          if (okStartRef.current === null) okStartRef.current = Date.now();
        } else {
          okStartRef.current = null;
        }
      } catch {
        consecutiveErrors++;
        // 모델 로드 실패 등 — 3회 연속 실패 시 'none'으로 폴백 (수동 촬영은 가능)
        if (consecutiveErrors >= 3) {
          setFaceStatus('none');
          okStartRef.current = null;
        }
      }

      if (active) timeoutId = setTimeout(runDetection, DETECTION_INTERVAL_MS);
    };

    timeoutId = setTimeout(runDetection, 500);
    return () => { active = false; clearTimeout(timeoutId); };
  }, [mode]);

  // ── Auto-capture progress (60fps smooth) ──

  useEffect(() => {
    if (mode !== 'camera') return;

    let active = true;

    const tick = () => {
      if (!active) return;

      if (okStartRef.current !== null) {
        const progress = Math.min(1, (Date.now() - okStartRef.current) / AUTO_CAPTURE_MS);
        setAutoCapProgress(progress);
        if (progress >= 1) {
          captureRef.current();
          return;
        }
      } else {
        setAutoCapProgress(0);
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => { active = false; cancelAnimationFrame(rafRef.current); };
  }, [mode]);

  // ── Cleanup on unmount ──

  useEffect(() => () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    cancelAnimationFrame(rafRef.current);
  }, []);

  // ── Handlers ──

  const handleRetake = useCallback(() => {
    // startCamera 안에서 모든 상태를 한 번에 전환 (captured→camera)
    // setCapturedData를 여기서 먼저 호출하면 idle 깜빡임 발생
    startCamera();
  }, [startCamera]);

  const handleUsePhoto = useCallback(() => {
    if (!capturedData) return;
    const cb = onCameraConfirm ?? onImageSelect;
    cb(capturedData.bitmap, capturedData.url);
  }, [capturedData, onImageSelect, onCameraConfirm]);

  // ── Derived state ──

  const isOk = faceStatus === 'ok';
  const isWarning = faceStatus === 'multiple' || faceStatus === 'off-center' || faceStatus === 'too-small';

  // ════════════════════════════════════════════════
  // ── Captured Preview ──
  // ════════════════════════════════════════════════

  if (mode === 'captured' && capturedData) {
    return (
      <div className="mx-auto flex max-w-sm flex-col items-center gap-4 animate-scale-reveal">
        <div className="relative aspect-[3/4] w-full max-w-[300px] overflow-hidden rounded-3xl shadow-2xl ring-1 ring-white/10">
          <img
            src={capturedData.url}
            alt="촬영된 사진"
            className="h-full w-full object-cover"
          />
        </div>

        <div className="flex w-full max-w-[300px] gap-2.5">
          <button
            onClick={handleRetake}
            className="flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl border border-border bg-card text-[14px] font-semibold transition-all active:scale-[0.97]"
          >
            <RotateCcw className="h-4 w-4" />
            다시 찍기
          </button>
          <button
            onClick={handleUsePhoto}
            className="flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl bg-foreground text-background text-[14px] font-semibold transition-all active:scale-[0.97]"
          >
            <Search className="h-4 w-4" />
            닮은꼴 찾기
          </button>
        </div>
      </div>
    );
  }

  // ════════════════════════════════════════════════
  // ── Camera Viewfinder ──
  // ════════════════════════════════════════════════

  if (mode === 'camera') {
    return (
      <div className="mx-auto flex max-w-sm flex-col items-center animate-scale-reveal">
        <div className="relative aspect-[3/4] w-full max-w-[300px] overflow-hidden rounded-3xl bg-black shadow-2xl">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="h-full w-full -scale-x-100 object-cover"
          />

          {/* Vignette + Guide */}
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_52%_44%_at_50%_46%,transparent_0%,rgba(0,0,0,0.5)_100%)]" />

            {/* Guide frame */}
            <div
              className={cn(
                'h-[56%] w-[50%] rounded-[2rem] transition-all duration-500',
                isOk
                  ? 'border-2 border-emerald-400/60 shadow-[0_0_24px_rgba(52,211,153,0.12)]'
                  : isWarning
                    ? 'border-[1.5px] border-amber-400/40'
                    : 'border-[1.5px] border-white/15',
              )}
            />
          </div>

          {/* Status pill */}
          <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-center px-4 pt-4">
            <div
              className={cn(
                'flex items-center gap-1.5 rounded-full px-3 py-1.5 backdrop-blur-lg transition-all duration-300',
                isOk ? 'bg-emerald-500/15' : isWarning ? 'bg-amber-500/10' : 'bg-black/20',
              )}
            >
              {/* Auto-capture mini ring */}
              {isOk && autoCapProgress > 0 && (
                <svg className="-rotate-90 h-3.5 w-3.5 shrink-0" viewBox="0 0 16 16">
                  <circle cx="8" cy="8" r="6" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" />
                  <circle
                    cx="8" cy="8" r="6"
                    fill="none"
                    stroke="rgba(52,211,153,0.9)"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeDasharray={`${2 * Math.PI * 6}`}
                    strokeDashoffset={`${2 * Math.PI * 6 * (1 - autoCapProgress)}`}
                  />
                </svg>
              )}
              <span
                className={cn(
                  'text-[11px] font-medium',
                  isOk ? 'text-emerald-300' : isWarning ? 'text-amber-300' : 'text-white/50',
                )}
              >
                {isOk && autoCapProgress > 0.3
                  ? '잠시 후 자동 촬영됩니다'
                  : STATUS_TEXT[faceStatus]}
              </span>
            </div>
          </div>

          {/* Bottom controls */}
          <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/60 via-black/20 to-transparent px-5 pb-5 pt-14">
            {/* Close */}
            <button
              onClick={closeCamera}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-md transition-all active:scale-90"
              aria-label="닫기"
            >
              <X className="h-4 w-4" />
            </button>

            {/* Capture button + progress ring */}
            <div className="relative flex items-center justify-center">
              <button
                onClick={capturePhoto}
                className={cn(
                  'relative z-10 flex h-[68px] w-[68px] items-center justify-center rounded-full transition-all active:scale-90',
                  isOk
                    ? 'border-[3px] border-emerald-400/90'
                    : 'border-[3px] border-white/80',
                )}
                aria-label="촬영"
              >
                <div
                  className={cn(
                    'h-[54px] w-[54px] rounded-full transition-colors duration-300',
                    isOk ? 'bg-emerald-400' : 'bg-white',
                  )}
                />
              </button>

              {/* Progress ring SVG */}
              {autoCapProgress > 0 && (
                <svg
                  className="pointer-events-none absolute -inset-1 -rotate-90"
                  viewBox="0 0 76 76"
                >
                  <circle
                    cx="38" cy="38" r={RING_R}
                    fill="none"
                    stroke="rgba(52,211,153,0.8)"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeDasharray={RING_C}
                    strokeDashoffset={RING_C * (1 - autoCapProgress)}
                  />
                </svg>
              )}
            </div>

            {/* Gallery shortcut */}
            <button
              onClick={() => {
                closeCamera();
                requestAnimationFrame(() => fileInputRef.current?.click());
              }}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-md transition-all active:scale-90"
              aria-label="앨범"
            >
              <Image className="h-4 w-4" />
            </button>
          </div>
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
  }

  // ════════════════════════════════════════════════
  // ── Idle: Upload Selection ──
  // ════════════════════════════════════════════════

  return (
    <div className="mx-auto flex w-full max-w-sm flex-col items-center gap-3">
      {/* Camera */}
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

      {/* Gallery */}
      <button
        onClick={() => fileInputRef.current?.click()}
        className={cn(
          'group flex w-full items-center gap-4 rounded-2xl border px-5 py-4 transition-all active:scale-[0.98]',
          isDragOver
            ? 'border-foreground bg-foreground/5'
            : 'border-border bg-card hover:border-foreground/20',
        )}
        onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
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

      {/* File input — accept 명시적 MIME types (Android 갤러리 앱 호출 개선) */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif,image/*"
        onChange={handleFileChange}
        className="hidden"
      />
    </div>
  );
};
