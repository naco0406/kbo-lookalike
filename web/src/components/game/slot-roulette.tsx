import type { FC } from 'react';
import { useEffect, useRef, useState } from 'react';
import { TEAM_COLORS } from '@/constants/analysis-messages';
import { cn } from '@/lib/utils';

interface SlotRouletteProps {
  dateLabel: string;
  matchLabel: string;
  awayCode: string;
  homeCode: string;
  inningLabel: string;
  onComplete: () => void;
}

// ── Reel ──

interface ReelProps {
  items: string[];
  finalValue: string;
  delay: number;
  duration: number;
  onStop?: () => void;
}

const ITEM_H = 40;

const Reel: FC<ReelProps> = ({ items, finalValue, delay, duration, onStop }) => {
  const [phase, setPhase] = useState<'waiting' | 'spinning' | 'stopped'>('waiting');
  const onStopRef = useRef(onStop);
  onStopRef.current = onStop;

  const reelItems = [...items, finalValue];
  const finalOffset = -(reelItems.length - 1) * ITEM_H;

  useEffect(() => {
    const t1 = setTimeout(() => {
      setPhase('spinning');
      const t2 = setTimeout(() => {
        setPhase('stopped');
        onStopRef.current?.();
      }, duration);
      return () => clearTimeout(t2);
    }, delay);
    return () => clearTimeout(t1);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="relative h-[40px] overflow-hidden">
      <div
        className="flex flex-col items-center"
        style={{
          transform: phase === 'waiting' ? 'translateY(0)' : `translateY(${finalOffset}px)`,
          transition: phase === 'spinning'
            ? `transform ${duration}ms cubic-bezier(0.2, 0.8, 0.2, 1)`
            : 'none',
        }}
      >
        {reelItems.map((item, i) => (
          <div
            key={`${item}-${i}`}
            className={cn(
              'flex h-[40px] shrink-0 items-center justify-center whitespace-nowrap text-[15px] font-bold',
              i === reelItems.length - 1 ? 'text-foreground' : 'text-muted-foreground/30',
            )}
          >
            {item}
          </div>
        ))}
      </div>
    </div>
  );
};

// ── SlotRoulette ──

const DUMMY_DATES = ['3/22 토', '3/23 일', '3/24 월', '3/25 화', '3/26 수', '3/27 목'];
const DUMMY_MATCHES = ['KIA vs 삼성', 'LG vs SSG', '한화 vs NC', '롯데 vs 두산', '키움 vs KT'];
const DUMMY_INNINGS = ['1회초', '2회말', '3회초', '4회말', '5회초', '6회말', '7회초', '8회말', '9회초'];

export const SlotRoulette: FC<SlotRouletteProps> = ({
  dateLabel,
  matchLabel,
  awayCode,
  homeCode,
  inningLabel,
  onComplete,
}) => {
  const [stoppedCount, setStoppedCount] = useState(0);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const away = TEAM_COLORS[awayCode];
  const home = TEAM_COLORS[homeCode];

  const handleStop = () => setStoppedCount((n) => n + 1);

  useEffect(() => {
    if (stoppedCount >= 3) {
      const t = setTimeout(() => onCompleteRef.current(), 800);
      return () => clearTimeout(t);
    }
  }, [stoppedCount]);

  return (
    <div className="flex flex-col items-center gap-6 py-8">
      <p className="animate-reveal-up text-[13px] font-medium text-muted-foreground">
        경기를 고르는 중...
      </p>

      {/* 슬롯머신 */}
      <div className="w-full max-w-[280px] overflow-hidden rounded-2xl border border-border/40 bg-card">
        <div className="border-b border-border/20 px-5">
          <div className="flex items-center gap-3">
            <span className="w-10 shrink-0 text-[11px] font-semibold text-muted-foreground/50">날짜</span>
            <Reel
              items={DUMMY_DATES.filter((d) => d !== dateLabel).slice(0, 5)}
              finalValue={dateLabel}
              delay={200}
              duration={1200}
              onStop={handleStop}
            />
          </div>
        </div>
        <div className="border-b border-border/20 px-5">
          <div className="flex items-center gap-3">
            <span className="w-10 shrink-0 text-[11px] font-semibold text-muted-foreground/50">경기</span>
            <Reel
              items={DUMMY_MATCHES.filter((m) => m !== matchLabel).slice(0, 6)}
              finalValue={matchLabel}
              delay={600}
              duration={1600}
              onStop={handleStop}
            />
          </div>
        </div>
        <div className="px-5">
          <div className="flex items-center gap-3">
            <span className="w-10 shrink-0 text-[11px] font-semibold text-muted-foreground/50">이닝</span>
            <Reel
              items={DUMMY_INNINGS.filter((inn) => inn !== inningLabel).slice(0, 7)}
              finalValue={inningLabel}
              delay={1200}
              duration={1800}
              onStop={handleStop}
            />
          </div>
        </div>
      </div>

      {/* 진행 도트 — 팀 컬러 사용 */}
      <div className="flex items-center gap-2">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-2 w-2 rounded-full transition-all duration-500"
            style={{
              backgroundColor: stoppedCount > i
                ? (i === 1 ? away?.primary : i === 2 ? home?.primary : 'var(--accent)')
                : undefined,
              opacity: stoppedCount > i ? 1 : 0.15,
              transform: stoppedCount > i ? 'scale(1)' : 'scale(0.7)',
            }}
          />
        ))}
      </div>
    </div>
  );
};
