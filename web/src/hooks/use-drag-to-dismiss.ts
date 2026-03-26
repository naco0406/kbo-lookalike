import type { RefObject } from 'react';
import { useEffect, useRef } from 'react';

interface DragToDismissOptions {
  /** 닫기 트리거 최소 드래그 거리 (px, 기본 150) */
  threshold?: number;
  /** 스크롤 가능한 컨텐츠의 ref — 스크롤이 맨 위일 때만 드래그 활성화 */
  scrollRef?: RefObject<HTMLElement | null>;
}

/**
 * 모바일 bottom-sheet 패턴: 아래로 스와이프하여 닫기.
 * 드래그 중 translateY + opacity를 직접 적용하며, threshold 초과 시 onDismiss 호출.
 */
export const useDragToDismiss = (
  ref: RefObject<HTMLElement | null>,
  onDismiss: () => void,
  options: DragToDismissOptions = {},
) => {
  const { threshold = 150, scrollRef } = options;
  const dismissRef = useRef(onDismiss);
  dismissRef.current = onDismiss;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let startY = 0;
    let startTime = 0;
    let currentY = 0;
    let isDragging = false;

    const onTouchStart = (e: TouchEvent) => {
      // 스크롤 컨테이너가 맨 위가 아니면 무시
      const scrollEl = scrollRef?.current ?? el;
      if (scrollEl.scrollTop > 0) return;

      startY = e.touches[0].clientY;
      startTime = Date.now();
      currentY = 0;
      isDragging = false;
    };

    const onTouchMove = (e: TouchEvent) => {
      const dy = e.touches[0].clientY - startY;

      // 위로 스와이프는 무시 (스크롤로 동작해야 함)
      if (dy < 0) {
        if (isDragging) {
          el.style.transform = '';
          el.style.opacity = '';
          isDragging = false;
        }
        return;
      }

      // 10px 이상 움직여야 드래그 시작 (스크롤과 구분)
      if (!isDragging && dy < 10) return;

      isDragging = true;
      currentY = dy;

      // 저항감 있는 드래그 (rubberband)
      const dampened = dy * 0.6;
      el.style.transform = `translateY(${dampened}px)`;
      el.style.opacity = String(Math.max(0.4, 1 - dy / 600));
      el.style.transition = 'none';
    };

    const onTouchEnd = () => {
      if (!isDragging) return;

      const velocity = currentY / (Date.now() - startTime) * 1000;
      const shouldDismiss = currentY > threshold || velocity > 800;

      if (shouldDismiss) {
        el.style.transition = 'transform 0.25s ease-out, opacity 0.25s ease-out';
        el.style.transform = 'translateY(100%)';
        el.style.opacity = '0';
        setTimeout(() => {
          dismissRef.current();
          el.style.transform = '';
          el.style.opacity = '';
          el.style.transition = '';
        }, 250);
      } else {
        // 원위치 복귀
        el.style.transition = 'transform 0.3s cubic-bezier(0.19, 1, 0.22, 1), opacity 0.3s ease-out';
        el.style.transform = '';
        el.style.opacity = '';
        setTimeout(() => {
          el.style.transition = '';
        }, 300);
      }

      isDragging = false;
    };

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: true });
    el.addEventListener('touchend', onTouchEnd, { passive: true });

    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
    };
  }, [ref, scrollRef, threshold]);
};
