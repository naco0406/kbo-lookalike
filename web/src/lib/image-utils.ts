/**
 * objectURL 또는 blob URL을 data URL로 변환.
 * data URL은 sessionStorage에 저장 가능하고 새로고침 후에도 유지됨.
 */
export const blobUrlToDataUrl = (blobUrl: string): Promise<string> => {
  // 이미 data URL이면 그대로 반환
  if (blobUrl.startsWith('data:')) return Promise.resolve(blobUrl);

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas context not available'));
        return;
      }
      ctx.drawImage(img, 0, 0);
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = blobUrl;
  });
};
