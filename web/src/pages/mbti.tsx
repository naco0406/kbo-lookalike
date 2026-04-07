import type { FC } from 'react';
import { memo, useState, useEffect, useCallback, useRef } from 'react';
import { Link, useNavigate } from 'react-router';
import { ChevronLeft, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  QUESTIONS,
  AXES_ORDER,
  AXIS_LABELS,
  AXIS_EMOJIS,
  AXIS_SUBTITLES,
  AXIS_SHORT_DESC,
  calculateMbtiResult,
  calculateQuickResult,
  MBTI_SESSION_KEY,
} from '@/constants/mbti-data';
import type { MbtiAxis, MbtiQuestion } from '@/constants/mbti-data';

// ── Intro Screen ─────────────────────────────────────────────────────────────

interface IntroProps {
  onStart: () => void;
  onQuickPick: () => void;
}

const IntroScreen: FC<IntroProps> = ({ onStart, onQuickPick }) => (
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
      </div>
    </header>

    {/* Content */}
    <div className="flex flex-1 flex-col items-center justify-center px-5 pb-12">
      <div className="max-w-xs text-center sm:max-w-sm">
        <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground animate-reveal-up">
          야구 MBTI
        </p>
        <h1
          className="mt-3 text-[2rem] font-extrabold leading-[1.2] tracking-tight animate-reveal-up sm:text-[2.5rem]"
          style={{ animationDelay: '80ms' }}
        >
          나는 어떤
          <br />
          야구팬일까?
        </h1>
        <p
          className="mt-3 text-balance text-[15px] leading-relaxed text-muted-foreground animate-reveal-up"
          style={{ animationDelay: '160ms' }}
        >
          질문에 답하고, 내 유형을 확인하세요
        </p>
      </div>

      {/* Buttons */}
      <div
        className="mt-10 flex w-full max-w-[220px] flex-col gap-2.5 animate-reveal-up"
        style={{ animationDelay: '280ms' }}
      >
        <button
          onClick={onStart}
          className="flex h-12 items-center justify-center rounded-full bg-accent text-[14px] font-bold text-accent-foreground transition-all active:scale-[0.97]"
        >
          시작하기
        </button>
        <button
          onClick={onQuickPick}
          className="flex h-12 items-center justify-center rounded-full border border-border text-[14px] font-bold text-muted-foreground transition-all hover:text-foreground active:scale-[0.97]"
        >
          한번에 고르기
        </button>
      </div>

      <p
        className="mt-6 text-[11px] text-muted-foreground/50 animate-reveal-up"
        style={{ animationDelay: '400ms' }}
      >
        약 2분 소요
      </p>
    </div>
  </div>
);

// ── Quick Pick Screen ────────────────────────────────────────────────────────

interface QuickPickProps {
  onClose: () => void;
}

const QuickPickScreen: FC<QuickPickProps> = ({ onClose }) => {
  const navigate = useNavigate();
  const [picks, setPicks] = useState<Partial<Record<MbtiAxis, 'first' | 'second'>>>({});
  const navigatingRef = useRef(false);
  const pickedCount = Object.keys(picks).length;

  const handlePick = useCallback(
    (axis: MbtiAxis, side: 'first' | 'second') => {
      if (navigatingRef.current) return;

      const newPicks = { ...picks, [axis]: side };
      setPicks(newPicks);

      // 4개 다 골랐으면 결과로 이동
      if (Object.keys(newPicks).length === 4) {
        navigatingRef.current = true;
        setTimeout(() => {
          const result = calculateQuickResult(newPicks);
          sessionStorage.setItem(MBTI_SESSION_KEY, JSON.stringify(result));
          navigate('/mbti/result', { replace: true, viewTransition: true });
        }, 500);
      }
    },
    [picks, navigate],
  );

  return (
    <div className="flex min-h-dvh flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-12 max-w-md items-center justify-between px-5">
          <button
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-all hover:text-foreground active:scale-90"
          >
            <X className="h-5 w-5" />
          </button>
          <span className="text-[12px] font-medium tabular-nums text-muted-foreground">
            {pickedCount} / 4
          </span>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto w-full max-w-md flex-1 px-5 pb-16">
        <p className="mb-6 text-center text-[14px] text-muted-foreground animate-reveal-up">
          나에게 가까운 쪽을 골라주세요
        </p>

        <div className="flex flex-col gap-5">
          {AXES_ORDER.map((axis, axisIdx) => (
            <QuickPickRow
              key={axis}
              axis={axis}
              delay={axisIdx * 80}
              picked={picks[axis]}
              onPick={handlePick}
            />
          ))}
        </div>
      </main>
    </div>
  );
};

/** 바로 고르기 — 축 한 줄 (memo로 불필요한 리렌더 방지) */
const QuickPickRow = memo<{
  axis: MbtiAxis;
  delay: number;
  picked: 'first' | 'second' | undefined;
  onPick: (axis: MbtiAxis, side: 'first' | 'second') => void;
}>(({ axis, delay, picked, onPick }) => {
  const [labelA, labelB] = AXIS_LABELS[axis];
  const [emojiA, emojiB] = AXIS_EMOJIS[axis];
  const [descA, descB] = AXIS_SHORT_DESC[axis];
  const subtitle = AXIS_SUBTITLES[axis];

  return (
    <div className="animate-reveal-up" style={{ animationDelay: `${delay}ms` }}>
      <p className="mb-2.5 text-center text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/60">
        {subtitle}
      </p>
      <div className="grid grid-cols-2 gap-2.5">
        {([
          { side: 'first' as const, emoji: emojiA, label: labelA, desc: descA },
          { side: 'second' as const, emoji: emojiB, label: labelB, desc: descB },
        ]).map((opt) => {
          const isSelected = picked === opt.side;
          const isOther = picked !== undefined && !isSelected;

          return (
            <button
              key={opt.side}
              onClick={() => onPick(axis, opt.side)}
              className={cn(
                'flex flex-col items-center gap-1.5 rounded-2xl py-5 transition-all duration-200 active:scale-[0.96]',
                isSelected
                  ? 'bg-accent text-accent-foreground ring-2 ring-accent scale-[0.97]'
                  : isOther
                    ? 'bg-card/50 opacity-40'
                    : 'bg-card',
              )}
            >
              <span className="text-[28px] leading-none">{opt.emoji}</span>
              <span className="text-[16px] font-extrabold">{opt.label}</span>
              <span
                className={cn(
                  'text-[11px]',
                  isSelected ? 'text-accent-foreground/70' : 'text-muted-foreground',
                )}
              >
                {opt.desc}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
});

// ── Quiz Screen ──────────────────────────────────────────────────────────────

interface QuizScreenProps {
  question: MbtiQuestion;
  questionIndex: number;
  total: number;
  selectedAnswer: 'A' | 'B' | null;
  onAnswer: (answer: 'A' | 'B') => void;
  onClose: () => void;
}

const QuizScreen = memo<QuizScreenProps>(({
  question,
  questionIndex,
  total,
  selectedAnswer,
  onAnswer,
  onClose,
}) => {
  const progress = ((questionIndex + (selectedAnswer ? 1 : 0)) / total) * 100;

  return (
    <div className="flex min-h-dvh flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-12 max-w-md items-center justify-between px-5">
          <button
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-all hover:text-foreground active:scale-90"
          >
            <X className="h-5 w-5" />
          </button>
          <span className="text-[12px] font-medium tabular-nums text-muted-foreground">
            {questionIndex + 1} / {total}
          </span>
        </div>
        {/* Progress bar */}
        <div className="mx-auto max-w-md px-5 pb-2">
          <div className="h-[3px] rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-accent transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto flex flex-1 flex-col w-full max-w-md px-5 pb-10">
        {/* Question */}
        <div key={questionIndex} className="flex flex-1 items-center py-8">
          <h2 className="text-[20px] font-extrabold leading-snug tracking-tight animate-reveal-up sm:text-[22px]">
            {question.text}
          </h2>
        </div>

        {/* Options */}
        <div key={`opts-${questionIndex}`} className="flex flex-col gap-3">
          <OptionButton
            text={question.optionA}
            state={selectedAnswer === 'A' ? 'selected' : selectedAnswer !== null ? 'dimmed' : 'idle'}
            delay={80}
            onClick={() => onAnswer('A')}
            disabled={selectedAnswer !== null}
          />
          <OptionButton
            text={question.optionB}
            state={selectedAnswer === 'B' ? 'selected' : selectedAnswer !== null ? 'dimmed' : 'idle'}
            delay={140}
            onClick={() => onAnswer('B')}
            disabled={selectedAnswer !== null}
          />
        </div>
      </main>
    </div>
  );
});

/** 퀴즈 선택지 버튼 (memo) */
const OptionButton = memo<{
  text: string;
  state: 'idle' | 'selected' | 'dimmed';
  delay: number;
  onClick: () => void;
  disabled: boolean;
}>(({ text, state, delay, onClick, disabled }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={cn(
      'rounded-2xl px-5 py-4.5 text-left text-[15px] font-medium leading-snug transition-all duration-200 active:scale-[0.97] animate-reveal-up',
      state === 'selected' && 'bg-accent text-accent-foreground scale-[0.97]',
      state === 'dimmed' && 'bg-card opacity-35',
      state === 'idle' && 'bg-card',
    )}
    style={{ animationDelay: `${delay}ms` }}
  >
    {text}
  </button>
));

// ── Analyzing Screen ─────────────────────────────────────────────────────────

const AnalyzingScreen: FC = () => (
  <div className="flex min-h-dvh flex-col items-center justify-center px-5">
    <div className="text-center">
      <p className="text-[48px] animate-processing-breathe">⚾</p>
      <p
        className="mt-4 text-[15px] font-medium text-muted-foreground animate-reveal-up"
        style={{ animationDelay: '100ms' }}
      >
        야구 성향 분석 중
      </p>
      <div className="mt-3 flex items-center justify-center gap-1.5">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-1.5 w-1.5 rounded-full bg-accent animate-mbti-dot"
            style={{ animationDelay: `${i * 200}ms` }}
          />
        ))}
      </div>
    </div>
  </div>
);

// ── Page ─────────────────────────────────────────────────────────────────────

export const MbtiPage: FC = () => {
  const navigate = useNavigate();
  const [phase, setPhase] = useState<'intro' | 'quickpick' | 'quiz' | 'analyzing'>('intro');
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<('A' | 'B')[]>([]);
  const [selectedAnswer, setSelectedAnswer] = useState<'A' | 'B' | null>(null);

  // ref로 최신 값 참조 (handleAnswer 재생성 방지)
  const answersRef = useRef(answers);
  answersRef.current = answers;
  const questionIndexRef = useRef(questionIndex);
  questionIndexRef.current = questionIndex;

  const handleStart = useCallback(() => setPhase('quiz'), []);
  const handleQuickPick = useCallback(() => setPhase('quickpick'), []);

  // X 버튼: 퀴즈/바로고르기 모두 인트로로 돌아가기 + 상태 리셋
  const handleClose = useCallback(() => {
    setPhase('intro');
    setQuestionIndex(0);
    setAnswers([]);
    setSelectedAnswer(null);
  }, []);

  // handleAnswer: ref 기반으로 deps 최소화 → 리렌더 시 재생성 방지
  const handleAnswer = useCallback((answer: 'A' | 'B') => {
    setSelectedAnswer((prev) => {
      if (prev !== null) return prev; // 이미 선택됨 — 무시

      setTimeout(() => {
        const newAnswers = [...answersRef.current, answer];
        setAnswers(newAnswers);
        setSelectedAnswer(null);

        const idx = questionIndexRef.current;
        if (idx < QUESTIONS.length - 1) {
          setQuestionIndex(idx + 1);
        } else {
          const result = calculateMbtiResult(newAnswers);
          sessionStorage.setItem(MBTI_SESSION_KEY, JSON.stringify(result));
          setPhase('analyzing');
        }
      }, 300);

      return answer;
    });
  }, []);

  // 분석 애니메이션 후 결과 페이지로 이동
  useEffect(() => {
    if (phase !== 'analyzing') return;
    const timer = setTimeout(() => {
      navigate('/mbti/result', { replace: true, viewTransition: true });
    }, 1800);
    return () => clearTimeout(timer);
  }, [phase, navigate]);

  if (phase === 'intro') {
    return <IntroScreen onStart={handleStart} onQuickPick={handleQuickPick} />;
  }

  if (phase === 'quickpick') {
    return <QuickPickScreen onClose={handleClose} />;
  }

  if (phase === 'analyzing') {
    return <AnalyzingScreen />;
  }

  return (
    <QuizScreen
      question={QUESTIONS[questionIndex]}
      questionIndex={questionIndex}
      total={QUESTIONS.length}
      selectedAnswer={selectedAnswer}
      onAnswer={handleAnswer}
      onClose={handleClose}
    />
  );
};
