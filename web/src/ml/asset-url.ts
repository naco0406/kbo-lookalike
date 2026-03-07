const R2_BASE = import.meta.env.VITE_R2_BASE ?? '';

export const assetUrl = (path: string): string =>
  R2_BASE && path.startsWith('/') ? `${R2_BASE}${path}` : path;
