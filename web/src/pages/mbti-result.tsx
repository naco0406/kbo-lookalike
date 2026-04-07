import type { FC } from 'react';
import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router';
import { ChevronLeft, Copy, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  MBTI_SESSION_KEY,
  MBTI_TYPES,
  AXES_ORDER,
  AXIS_LABELS,
  AXIS_EMOJIS,
  AXIS_SUBTITLES,
} from '@/constants/mbti-data';
import type { MbtiAxis, MbtiAxisScore, MbtiResult } from '@/constants/mbti-data';

// ── Axis Bar ─────────────────────────────────────────────────────────────────

interface AxisBarProps {
  axis: MbtiAxis;
  score: MbtiAxisScore;
  index: number;
}

const AxisBar: FC<AxisBarProps> = ({ axis, score, index }) => {
  const [labelA, labelB] = AXIS_LABELS[axis];
  const [emojiA, emojiB] = AXIS_EMOJIS[axis];
  const subtitle = AXIS_SUBTITLES[axis];
  const total = score.first + score.second;
  const firstPercent = total > 0 ? Math.round((score.first / total) * 100) : 50;
  const secondPercent = 100 - firstPercent;
  const isFirstWinning = score.first >= score.second;

  // 50/50에서 실제 비율로 애니메이션
  const [animated, setAnimated] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setAnimated(true), 600 + index * 150);
    return () => clearTimeout(timer);
  }, [index]);

  const displayFirst = animated ? firstPercent : 50;

  return (
    <div className={cn('py-4', index > 0 && 'border-t border-border/30')}>
      {/* Subtitle */}
      <p className="mb-3 text-center text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">
        {subtitle}
      </p>

      {/* Labels + percentages */}
      <div className="mb-2.5 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="text-[18px] leading-none">{emojiA}</span>
          <span
            className={cn(
              'text-[14px] transition-colors duration-500',
              isFirstWinning && animated ? 'font-bold text-foreground' : 'font-medium text-muted-foreground/50',
            )}
          >
            {labelA}
          </span>
          <span
            className={cn(
              'text-[12px] tabular-nums transition-colors duration-500',
              isFirstWinning && animated ? 'font-semibold text-foreground' : 'text-muted-foreground/40',
            )}
          >
            {animated ? firstPercent : 50}%
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span
            className={cn(
              'text-[12px] tabular-nums transition-colors duration-500',
              !isFirstWinning && animated ? 'font-semibold text-foreground' : 'text-muted-foreground/40',
            )}
          >
            {animated ? secondPercent : 50}%
          </span>
          <span
            className={cn(
              'text-[14px] transition-colors duration-500',
              !isFirstWinning && animated ? 'font-bold text-foreground' : 'font-medium text-muted-foreground/50',
            )}
          >
            {labelB}
          </span>
          <span className="text-[18px] leading-none">{emojiB}</span>
        </div>
      </div>

      {/* Dual-color bar */}
      <div className="flex h-2.5 gap-[2px]">
        <div
          className={cn(
            'rounded-full transition-all duration-700 ease-out',
            isFirstWinning ? 'bg-accent' : 'bg-foreground/10',
          )}
          style={{ width: `${displayFirst}%` }}
        />
        <div
          className={cn(
            'flex-1 rounded-full transition-all duration-700 ease-out',
            !isFirstWinning ? 'bg-accent' : 'bg-foreground/10',
          )}
        />
      </div>
    </div>
  );
};

// ── Page ─────────────────────────────────────────────────────────────────────

const readResult = (): MbtiResult | null => {
  try {
    const raw = sessionStorage.getItem(MBTI_SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as MbtiResult;
  } catch {
    return null;
  }
};

export const MbtiResultPage: FC = () => {
  const navigate = useNavigate();
  const result = useMemo(readResult, []);

  const handleRetry = useCallback(() => {
    sessionStorage.removeItem(MBTI_SESSION_KEY);
    navigate('/mbti', { replace: true, viewTransition: true });
  }, [navigate]);

  const type = result ? MBTI_TYPES[result.code] : null;

  const handleShare = useCallback(async () => {
    if (!result || !type) return;

    const lines = [
      '643 — 야구 MBTI',
      '',
      `나의 야구 성향은 ${result.code}`,
      `"${type.name}"`,
      '',
      type.traits.join(' · '),
      '',
      type.description,
      '',
      '나도 해보기',
      'https://puttheballinthebox.com/mbti',
    ];
    const text = lines.join('\n');

    if (navigator.share) {
      try {
        await navigator.share({ title: '643 — 야구 MBTI', text });
        return;
      } catch (e) {
        if (e instanceof Error && e.name === 'AbortError') return;
      }
    }

    try {
      await navigator.clipboard.writeText(text);
      toast.success('결과가 클립보드에 복사되었습니다');
    } catch {
      toast.error('복사에 실패했습니다');
    }
  }, [result, type]);

  if (!result || !type) {
    return <Navigate to="/mbti" replace />;
  }

  return (
    <div className="flex min-h-dvh flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-12 max-w-md items-center px-5">
          <Link
            to="/"
            viewTransition
            className="flex items-center gap-1 text-[13px] text-muted-foreground transition-all hover:text-foreground active:opacity-60"
          >
            <ChevronLeft className="h-4 w-4" />
            <span>홈</span>
          </Link>
          <span className="absolute left-1/2 -translate-x-1/2 text-sm font-bold tracking-tight opacity-60">
            야구 MBTI
          </span>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto w-full max-w-md px-5">
        {/* ── Type Hero ── */}
        <div className="flex flex-col items-center pt-10 pb-10">
          {/* Emoji */}
          <p className="text-[52px] leading-none animate-scale-reveal">{type.emoji}</p>

          {/* Type code */}
          <p
            className="mt-4 font-score text-[4rem] leading-none tracking-wider animate-reveal-up"
            style={{ animationDelay: '150ms' }}
          >
            {result.code}
          </p>

          {/* Type name */}
          <p
            className="mt-2 text-[24px] font-extrabold tracking-tight animate-reveal-up"
            style={{ animationDelay: '280ms' }}
          >
            {type.name}
          </p>

          {/* Trait tags */}
          <div
            className="mt-3 flex items-center gap-2 animate-reveal-up"
            style={{ animationDelay: '400ms' }}
          >
            {type.traits.map((trait, i) => (
              <Fragment key={trait}>
                {i > 0 && (
                  <span className="text-[8px] text-muted-foreground/25">·</span>
                )}
                <span className="rounded-full bg-card px-3 py-1 text-[12px] font-semibold text-muted-foreground">
                  {trait}
                </span>
              </Fragment>
            ))}
          </div>
        </div>

        {/* ── Description ── */}
        <div
          className="rounded-2xl bg-card p-5 animate-reveal-up"
          style={{ animationDelay: '500ms' }}
        >
          <p className="text-[15px] leading-[1.8] text-foreground/90">
            {type.description}
          </p>
        </div>

        {/* ── Axis Breakdown ── */}
        <div
          className="mt-3 rounded-2xl bg-card px-5 py-2 animate-reveal-up"
          style={{ animationDelay: '600ms' }}
        >
          {AXES_ORDER.map((axis, i) => (
            <AxisBar key={axis} axis={axis} score={result.axes[axis]} index={i} />
          ))}
        </div>

        {/* ── Action Buttons ── */}
        <div
          className="mt-6 grid grid-cols-2 gap-2.5 animate-reveal-up"
          style={{ animationDelay: '750ms' }}
        >
          <button
            onClick={handleShare}
            className="flex h-14 items-center justify-center gap-2 rounded-2xl bg-accent text-accent-foreground transition-all active:scale-[0.96]"
          >
            <Copy className="h-4 w-4" />
            <span className="text-[14px] font-bold">공유</span>
          </button>
          <button
            onClick={handleRetry}
            className="flex h-14 items-center justify-center gap-2 rounded-2xl bg-card text-foreground transition-all active:scale-[0.96]"
          >
            <RotateCcw className="h-4 w-4" />
            <span className="text-[14px] font-semibold">다시하기</span>
          </button>
        </div>
        {/* 하단 여백 */}
        <div className="h-10 safe-bottom" />
      </main>
    </div>
  );
};
