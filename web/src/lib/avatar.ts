const AVATAR_SIZE = 200;

/**
 * 이미지 파일을 200×200 정사각형 center-crop JPEG data URL로 변환.
 * localStorage에 저장 가능한 크기로 압축.
 */
export const processAvatarFile = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const s = Math.min(img.width, img.height);
      const sx = (img.width - s) / 2;
      const sy = (img.height - s) / 2;

      const canvas = document.createElement('canvas');
      canvas.width = AVATAR_SIZE;
      canvas.height = AVATAR_SIZE;

      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('Canvas not supported')); return; }

      ctx.drawImage(img, sx, sy, s, s, 0, 0, AVATAR_SIZE, AVATAR_SIZE);
      resolve(canvas.toDataURL('image/jpeg', 0.85));

      URL.revokeObjectURL(img.src);
    };
    img.onerror = () => {
      URL.revokeObjectURL(img.src);
      reject(new Error('Failed to load image'));
    };
    img.src = URL.createObjectURL(file);
  });
