import { useRef, useState, useEffect, useCallback } from 'react';

export type PtrPhase = 'idle' | 'pulling' | 'armed' | 'refreshing' | 'done' | 'settling';

const THRESHOLD = 72;
const MAX_PULL = 128;
const RESISTANCE = 0.45;
const DEAD_ZONE = 10;
const MIN_REFRESH_MS = 800;  // 최소 로딩 표시 시간
const DONE_MS = 600;         // 완료 애니메이션 표시 시간

interface UsePullToRefreshOptions {
  onRefresh: () => Promise<void>;
}

interface UsePullToRefreshReturn {
  phase: PtrPhase;
  pullDistance: number;
  progress: number;
}

export const usePullToRefresh = ({
  onRefresh,
}: UsePullToRefreshOptions): UsePullToRefreshReturn => {
  const [, setTick] = useState(0);
  const bump = useCallback(() => setTick((n) => n + 1), []);

  const phaseRef = useRef<PtrPhase>('idle');
  const distRef = useRef(0);
  const startYRef = useRef(0);
  const trackingRef = useRef(false);
  const refreshRef = useRef(onRefresh);
  refreshRef.current = onRefresh;

  useEffect(() => {
    const isAtTop = () => Math.round(window.scrollY) <= 0;

    const onTouchStart = (e: TouchEvent) => {
      if (phaseRef.current === 'refreshing' || phaseRef.current === 'done' || phaseRef.current === 'settling') return;
      if (!isAtTop()) return;
      startYRef.current = e.touches[0].clientY;
      trackingRef.current = true;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!trackingRef.current) return;
      if (phaseRef.current === 'refreshing' || phaseRef.current === 'done' || phaseRef.current === 'settling') return;

      const delta = e.touches[0].clientY - startYRef.current;

      if (delta < 0) {
        trackingRef.current = false;
        if (distRef.current > 0) {
          distRef.current = 0;
          phaseRef.current = 'idle';
          bump();
        }
        return;
      }

      if (delta < DEAD_ZONE) return;

      e.preventDefault();

      const dist = Math.min((delta - DEAD_ZONE) * RESISTANCE, MAX_PULL);
      distRef.current = dist;
      phaseRef.current = dist >= THRESHOLD ? 'armed' : 'pulling';
      bump();
    };

    const onTouchEnd = async () => {
      if (!trackingRef.current) return;
      trackingRef.current = false;

      const p = phaseRef.current;

      if (p === 'armed') {
        phaseRef.current = 'refreshing';
        distRef.current = 64;
        bump();

        const start = Date.now();
        try {
          await refreshRef.current();
        } finally {
          // 최소 표시 시간 보장
          const elapsed = Date.now() - start;
          const remaining = Math.max(0, MIN_REFRESH_MS - elapsed);
          await new Promise((r) => setTimeout(r, remaining));

          // 완료 애니메이션
          phaseRef.current = 'done';
          bump();
          await new Promise((r) => setTimeout(r, DONE_MS));

          // 닫기
          phaseRef.current = 'settling';
          distRef.current = 0;
          bump();
          setTimeout(() => { phaseRef.current = 'idle'; bump(); }, 350);
        }
      } else if (distRef.current > 0) {
        phaseRef.current = 'settling';
        distRef.current = 0;
        bump();
        setTimeout(() => { phaseRef.current = 'idle'; bump(); }, 350);
      } else {
        phaseRef.current = 'idle';
        bump();
      }
    };

    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onTouchEnd, { passive: true });

    return () => {
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
    };
  }, [bump]);

  return {
    phase: phaseRef.current,
    pullDistance: distRef.current,
    progress: Math.min(distRef.current / THRESHOLD, 1),
  };
};
