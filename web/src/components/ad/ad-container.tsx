import type { FC } from 'react';
import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

// ── Types ───────────────────────────────────────────────────────────────────

type AdSize = '300x250' | '320x100' | '320x480' | '320x50';

const SIZE_MAP: Record<AdSize, { width: number; height: number }> = {
  '300x250': { width: 300, height: 250 },
  '320x100': { width: 320, height: 100 },
  '320x480': { width: 320, height: 480 },
  '320x50': { width: 320, height: 50 },
};

interface AdContainerProps {
  /** 광고 사이즈 */
  type: AdSize;
  /** 카카오 애드핏 광고 단위 ID (DAN-XXXXXXXXXX) */
  unitId: string;
  className?: string;
}

// ── Script URL ──────────────────────────────────────────────────────────────

const ADFIT_SCRIPT_SRC = '//t1.daumcdn.net/kas/static/ba.min.js';

// ── Component ───────────────────────────────────────────────────────────────
//
// 카카오 애드핏 SPA 통합 핵심:
//   ba.min.js는 실행 시점에 DOM 내 <ins class="kakao_ad_area" style="display:none">
//   를 탐색하여 광고를 렌더링한다.
//   React SPA에서는 컴포넌트 mount 후에 <ins>가 추가되므로, 이미 로드된
//   스크립트가 새 <ins>를 인식하지 못한다.
//
//   해결: mount마다 <ins> + <script> 쌍을 imperative하게 DOM에 삽입한다.
//   <script>는 브라우저 캐시에서 즉시 로드되므로 네트워크 비용 없이
//   재실행 → 새 <ins> 발견 → 광고 렌더링의 흐름이 보장된다.
//   unmount 시 삽입한 모든 노드를 제거하여 메모리 누수를 방지한다.
//
// 렌더링 전략:
//   광고 로드 전에는 아무것도 보이지 않는다 (height: 0, overflow: hidden).
//   광고가 실제로 렌더링된 후에만 "광고" 라벨 + 콘텐츠를 fade-in한다.
//   → 로컬 개발, 광고 차단기 사용자: 아무 일도 안 일어남 (CLS 0)
//   → 프로덕션 정상: 부드러운 전개 애니메이션
//
//   "skeleton으로 CLS 방지" 접근을 사용하지 않는 이유:
//   광고가 안 뜰 때 skeleton이 5초간 보이다 사라지면 역방향 CLS가 발생한다.
//   광고 영역은 항상 섹션 사이/페이지 하단에 위치하므로
//   광고 등장 시 약간의 CLS는 허용 가능하다.

export const AdContainer: FC<AdContainerProps> = ({ type, unitId, className }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [adLoaded, setAdLoaded] = useState(false);
  const [adFailed, setAdFailed] = useState(false);
  const { width, height } = SIZE_MAP[type];

  useEffect(() => {
    const wrapper = containerRef.current;
    if (!wrapper) return;

    // ── 1. <ins> 요소 생성 ──
    const ins = document.createElement('ins');
    ins.className = 'kakao_ad_area';
    ins.style.display = 'none';
    ins.setAttribute('data-ad-unit', unitId);
    ins.setAttribute('data-ad-width', String(width));
    ins.setAttribute('data-ad-height', String(height));

    // ── 2. <script> 요소 생성 ──
    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.src = ADFIT_SCRIPT_SRC;
    script.async = true;

    // ── 3. DOM에 삽입 — 순서 중요: ins 먼저, script 나중 ──
    wrapper.appendChild(ins);
    wrapper.appendChild(script);

    // ── 4. 광고 렌더링 감지 ──
    // ba.min.js가 <ins>를 처리하면 display:none → display:block으로 변경한다.
    // MutationObserver로 이 변화를 감지하여 컨테이너를 열어준다.
    const observer = new MutationObserver(() => {
      if (ins.style.display !== 'none') {
        setAdLoaded(true);
        observer.disconnect();
      }
    });
    observer.observe(ins, { attributes: true, attributeFilter: ['style'] });

    // ── 5. 타임아웃 — 광고 미렌더링 시 조용히 정리 ──
    const failTimer = window.setTimeout(() => {
      if (ins.style.display === 'none') {
        setAdFailed(true);
        observer.disconnect();
      }
    }, 5000);

    // ── 6. Cleanup ──
    return () => {
      observer.disconnect();
      window.clearTimeout(failTimer);

      if (wrapper.contains(script)) wrapper.removeChild(script);
      if (wrapper.contains(ins)) wrapper.removeChild(ins);
    };
  }, [unitId, width, height]);

  // 광고 로드 실패 → DOM에서 완전 제거
  if (adFailed) return null;

  return (
    <div
      className={cn(
        'flex flex-col items-center overflow-hidden transition-all duration-500 ease-out',
        adLoaded ? 'py-6 opacity-100' : 'h-0 py-0 opacity-0',
        className,
      )}
    >
      {/* "광고" 라벨 — 광고가 실제로 렌더링된 후에만 보인다 */}
      <span className="mb-1.5 text-[10px] text-muted-foreground">광고</span>

      {/* 광고 래퍼 */}
      <div
        ref={containerRef}
        className="overflow-hidden rounded-[20px] border border-border bg-card"
        style={{ width, minHeight: adLoaded ? height : 0 }}
      />
    </div>
  );
};
