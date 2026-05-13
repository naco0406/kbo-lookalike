import type { CSSProperties, FC, ReactNode } from 'react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import {
  Activity,
  BadgeCheck,
  CalendarDays,
  Camera,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  Layers3,
  Moon,
  Search,
  ShieldCheck,
  Sun,
  Trophy,
  Type,
  WandSparkles,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Slider } from '@/components/ui/slider';
import { ThemeToggle } from '@/components/theme-toggle';
import { TEAM_COLORS } from '@/constants/analysis-messages';
import { cn } from '@/lib/utils';

interface SectionProps {
  id: string;
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
}

const NAV_ITEMS = [
  { href: '#mood', label: 'Mood' },
  { href: '#colors', label: 'Colors' },
  { href: '#type', label: 'Type' },
  { href: '#components', label: 'UI' },
  { href: '#patterns', label: 'Scenes' },
] as const;

const COLOR_TOKENS = [
  { name: '낮 경기장', varName: '--background', usage: '따뜻한 첫인상' },
  { name: '잉크 블랙', varName: '--foreground', usage: '또렷한 정보' },
  { name: '카드 화이트', varName: '--card', usage: '콘텐츠 표면' },
  { name: '메인 액션', varName: '--accent', usage: '시작과 선택' },
  { name: '보조 표면', varName: '--secondary', usage: '차분한 구분' },
  { name: '라이브 레드', varName: '--destructive', usage: '경기 진행감' },
  { name: '스코어 블루', varName: '--stadium-blue', usage: '차트와 보조 강조' },
  { name: '더그아웃 브라운', varName: '--stadium-brown', usage: '야구장 온도감' },
] as const;

const RADIUS_TOKENS = [
  { label: 'sm', className: 'rounded-sm' },
  { label: 'md', className: 'rounded-md' },
  { label: 'lg', className: 'rounded-lg' },
  { label: 'xl', className: 'rounded-xl' },
  { label: '2xl', className: 'rounded-2xl' },
  { label: '3xl', className: 'rounded-3xl' },
] as const;

const TYPE_SAMPLES = [
  {
    label: 'Hero',
    className: 'text-[2.5rem] font-extrabold leading-[1.08] tracking-tight',
    sample: '혹시 선수세요?',
  },
  {
    label: 'Title',
    className: 'text-[22px] font-extrabold leading-tight tracking-tight',
    sample: '오늘의 매치업',
  },
  {
    label: 'Body',
    className: 'text-[15px] leading-relaxed',
    sample: '사진 한 장이면 AI가 닮은 선수를 찾아드립니다',
  },
  {
    label: 'Caption',
    className: 'text-[11px] font-medium uppercase tracking-[0.2em]',
    sample: 'KBO LOOKALIKE',
  },
  {
    label: 'Score',
    className: 'font-score text-[44px] leading-none tracking-wider',
    sample: '7 : 3',
  },
] as const;

const MOTION_SAMPLES = [
  { label: '부드럽게 등장', className: 'animate-reveal-up' },
  { label: '가볍게 확대', className: 'animate-scale-reveal' },
  { label: '살짝 호흡', className: 'animate-processing-breathe' },
] as const;

const EXPERIENCE_PRINCIPLES = [
  {
    title: '한 손으로 읽히는 밀도',
    label: 'Mobile first',
    description: '주요 화면은 휴대폰 폭을 기준으로 설계해 정보가 멀리 퍼지지 않게 유지합니다.',
  },
  {
    title: '숫자가 먼저 보이는 경기감',
    label: 'Score first',
    description: '점수, 순위, 확률처럼 바로 판단해야 하는 정보는 크기와 대비로 먼저 보이게 합니다.',
  },
  {
    title: '야구 맥락 안의 위트',
    label: 'Light humor',
    description:
      '문구와 모션은 가볍게 웃을 수 있을 만큼만 사용하고, 정보 흐름을 방해하지 않습니다.',
  },
] as const;

const Section: FC<SectionProps> = ({ id, eyebrow, title, description, children }) => (
  <section id={id} className="scroll-mt-6 py-10">
    <div className="mb-6">
      <p className="text-muted-foreground text-[11px] font-semibold tracking-[0.22em] uppercase">
        {eyebrow}
      </p>
      <h2 className="mt-2 text-[26px] leading-tight font-extrabold tracking-tight">{title}</h2>
      <p className="text-muted-foreground mt-3 text-[14px] leading-relaxed">{description}</p>
    </div>
    {children}
  </section>
);

const TokenSwatch: FC<(typeof COLOR_TOKENS)[number]> = ({ name, varName, usage }) => (
  <div className="bg-card rounded-2xl border p-3">
    <div
      className="h-16 rounded-xl border shadow-sm"
      style={{ backgroundColor: `var(${varName})` } as CSSProperties}
    />
    <div className="mt-3">
      <div className="min-w-0">
        <p className="text-[13px] leading-tight font-bold">{name}</p>
        <p className="text-muted-foreground mt-1 text-[11px]">{usage}</p>
      </div>
    </div>
  </div>
);

const TeamColorChip: FC<{ code: string; name: string; primary: string; secondary: string }> = ({
  code,
  name,
  primary,
  secondary,
}) => (
  <div className="bg-card flex items-center gap-3 rounded-2xl border p-3">
    <div
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[11px] font-black text-white"
      style={{ backgroundColor: primary }}
    >
      {code}
    </div>
    <div className="min-w-0 flex-1">
      <p className="truncate text-[13px] font-bold">{name}</p>
      <div className="mt-1 flex items-center gap-1.5">
        <span className="h-2.5 w-7 rounded-full" style={{ backgroundColor: primary }} />
        <span className="h-2.5 w-7 rounded-full" style={{ backgroundColor: secondary }} />
      </div>
    </div>
  </div>
);

const StatPill: FC<{ icon: ReactNode; label: string; value: string; tone?: string }> = ({
  icon,
  label,
  value,
  tone,
}) => (
  <div className="bg-card rounded-2xl border px-4 py-3">
    <div
      className={cn('bg-muted mb-3 flex h-8 w-8 items-center justify-center rounded-full', tone)}
    >
      {icon}
    </div>
    <p className="text-muted-foreground text-[11px]">{label}</p>
    <p className="mt-0.5 text-[20px] leading-none font-black tabular-nums">{value}</p>
  </div>
);

const GamePatternCard: FC = () => (
  <button
    type="button"
    className="bg-card hover:bg-card/80 w-full rounded-2xl border text-left transition-all active:scale-[0.99]"
  >
    <div className="bg-destructive/5 flex items-center gap-1.5 px-4 py-1.5">
      <span className="bg-destructive h-1.5 w-1.5 animate-pulse rounded-full" />
      <span className="text-destructive text-[10px] font-bold tracking-widest">7회말 진행중</span>
    </div>
    <div className="flex items-center gap-1 px-4 pt-4 pb-3">
      <div className="flex flex-1 flex-col items-center gap-2">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#C30452] text-[11px] font-bold text-white">
          LG
        </div>
        <span className="text-[11px] leading-tight font-semibold">LG</span>
      </div>
      <div className="flex min-w-[96px] flex-col items-center gap-2">
        <div className="grid w-full grid-cols-[1fr_auto_1fr] items-baseline">
          <span className="text-right text-[30px] leading-none font-black tabular-nums">7</span>
          <span className="text-muted-foreground/20 px-1.5 pb-0.5 text-[16px] leading-none font-light">
            :
          </span>
          <span className="text-muted-foreground/25 text-left text-[30px] leading-none font-black tabular-nums">
            3
          </span>
        </div>
        <Badge variant="secondary" className="h-[18px] px-1.5 text-[10px]">
          LIVE
        </Badge>
      </div>
      <div className="flex flex-1 flex-col items-center gap-2">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#041E42] text-[11px] font-bold text-white">
          롯데
        </div>
        <span className="text-muted-foreground text-[11px] leading-tight">롯데</span>
      </div>
    </div>
    <div className="border-border/50 flex items-center justify-between border-t px-4 py-2">
      <span className="text-muted-foreground/50 text-[10px]">잠실</span>
      <span className="text-muted-foreground/40 text-[10px]">KBS N SPORTS</span>
    </div>
  </button>
);

const MatchPatternCard: FC = () => (
  <div className="flex flex-col gap-2">
    {[
      { rank: 1, name: '김도영', team: 'KIA 타이거즈 · 내야수', percent: '91.8%', active: true },
      { rank: 2, name: '구자욱', team: '삼성 라이온즈 · 외야수', percent: '87.4%' },
      { rank: 3, name: '문동주', team: '한화 이글스 · 투수', percent: '84.1%' },
    ].map((player) => (
      <button
        key={player.rank}
        type="button"
        className={cn(
          'active:bg-muted/30 relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors',
          player.active && 'bg-card ring-border shadow-sm ring-1',
        )}
      >
        <div className="relative shrink-0">
          <div className={cn('bg-muted rounded-xl', player.active ? 'h-12 w-12' : 'h-10 w-10')} />
          <span
            className={cn(
              'absolute -top-1.5 -left-1.5 flex items-center justify-center rounded-md text-[10px] leading-none font-bold',
              player.active
                ? 'bg-foreground text-background h-5 w-5 shadow-sm'
                : 'bg-muted-foreground/60 text-background h-4.5 w-4.5',
            )}
          >
            {player.rank}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <p
            className={cn('truncate font-semibold', player.active ? 'text-[15px]' : 'text-[13px]')}
          >
            {player.name}
          </p>
          <p className="text-muted-foreground truncate text-[11px]">{player.team}</p>
        </div>
        <span
          className={cn(
            'shrink-0 tabular-nums',
            player.active
              ? 'text-[15px] font-bold'
              : 'text-muted-foreground text-[13px] font-medium',
          )}
        >
          {player.percent}
        </span>
      </button>
    ))}
  </div>
);

export const DesignSystemPage: FC = () => {
  const [quality, setQuality] = useState([78]);
  const teams = useMemo(() => Object.entries(TEAM_COLORS), []);

  return (
    <div className="bg-background text-foreground min-h-dvh">
      <header className="bg-background">
        <div className="mx-auto flex h-14 max-w-md items-center justify-between px-5">
          <Link
            to="/"
            viewTransition
            className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-[13px] transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
            <span>홈</span>
          </Link>
          <span className="font-score absolute left-1/2 -translate-x-1/2 text-[24px] leading-none tracking-widest opacity-70">
            643
          </span>
          <ThemeToggle className="h-10 w-10" />
        </div>
      </header>

      <main>
        <section className="border-b">
          <div className="mx-auto max-w-md px-5 py-10">
            <div className="animate-reveal-up">
              <div className="bg-card text-muted-foreground mb-5 inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[12px] font-semibold">
                <Layers3 className="text-accent h-3.5 w-3.5" />
                643 Design System
              </div>
              <h1 className="text-[38px] leading-[1.08] font-extrabold tracking-tight">
                야구를 닮은
                <br />
                화면의 규칙
              </h1>
              <p className="text-muted-foreground mt-4 text-[15px] leading-relaxed">
                643은 빠르게 웃고, 바로 이해하고, 편하게 다시 쓰는 야구 서비스를 목표로 합니다. 이
                페이지는 그 감각을 이루는 색, 글자, 화면 요소를 정리합니다.
              </p>
              <nav className="mt-6 flex gap-1.5 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {NAV_ITEMS.map((item) => (
                  <a
                    key={item.href}
                    href={item.href}
                    className="bg-card text-muted-foreground hover:bg-muted hover:text-foreground shrink-0 rounded-full border px-3 py-1.5 text-[11px] font-semibold transition-colors"
                  >
                    {item.label}
                  </a>
                ))}
              </nav>
            </div>

            <div className="animate-scale-reveal mt-8 grid grid-cols-2 gap-3">
              <StatPill
                icon={<Sun className="h-4 w-4" />}
                label="Light theme"
                value="낮 경기장"
                tone="bg-stadium-green/10 text-stadium-green"
              />
              <StatPill
                icon={<Moon className="h-4 w-4" />}
                label="Dark theme"
                value="야간 경기장"
                tone="bg-stadium-blue/10 text-stadium-blue"
              />
              <StatPill
                icon={<Trophy className="h-4 w-4" />}
                label="Players"
                value="763"
                tone="bg-stadium-brown/10 text-stadium-brown"
              />
              <StatPill
                icon={<Activity className="h-4 w-4" />}
                label="Motion"
                value="0.7s"
                tone="bg-destructive/10 text-destructive"
              />
            </div>
          </div>
        </section>

        <div className="mx-auto max-w-md px-5">
          <Section
            id="mood"
            eyebrow="Mood"
            title="분위기"
            description="낮 경기장의 따뜻함, 야간 경기장의 선명함, 야구 팬 서비스 특유의 가벼운 농담을 한 화면 안에서 균형 있게 섞습니다."
          >
            <div className="grid gap-3">
              {EXPERIENCE_PRINCIPLES.map((item, index) => (
                <div key={item.title} className="bg-card rounded-3xl border p-5">
                  <div className="mb-5 flex items-center justify-between">
                    <div className="bg-accent/10 text-accent flex h-10 w-10 items-center justify-center rounded-full">
                      <Layers3 className="h-4 w-4" />
                    </div>
                    <span className="font-score text-muted-foreground/35 text-[34px] leading-none">
                      0{index + 1}
                    </span>
                  </div>
                  <p className="text-[17px] leading-tight font-extrabold tracking-tight">
                    {item.title}
                  </p>
                  <span className="bg-muted text-muted-foreground mt-2 inline-flex rounded-full px-2 py-1 text-[10px] font-semibold">
                    {item.label}
                  </span>
                  <p className="text-muted-foreground mt-4 text-[13px] leading-relaxed">
                    {item.description}
                  </p>
                </div>
              ))}
            </div>
          </Section>

          <Section
            id="colors"
            eyebrow="Colors"
            title="컬러"
            description="기본 색은 따뜻하고 차분하게 유지하고, 액션·라이브·팀 컬러처럼 의미가 있는 순간에만 강한 색을 사용합니다."
          >
            <div className="grid grid-cols-2 gap-3">
              {COLOR_TOKENS.map((token) => (
                <TokenSwatch key={token.varName} {...token} />
              ))}
            </div>

            <div className="mt-8 grid gap-8">
              <div>
                <h3 className="text-[16px] font-extrabold">Radius Scale</h3>
                <p className="text-muted-foreground mt-1 text-[13px]">
                  제품 화면은 12-24px 사이의 부드러운 모서리를 주로 사용합니다.
                </p>
                <div className="mt-4 grid grid-cols-3 gap-3">
                  {RADIUS_TOKENS.map((radius) => (
                    <div key={radius.label} className="bg-card rounded-2xl border p-3">
                      <div
                        className={cn('bg-accent/15 ring-accent/20 h-16 ring-1', radius.className)}
                      />
                      <p className="text-muted-foreground mt-2 text-center text-[11px] font-semibold">
                        {radius.label}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-[16px] font-extrabold">Team Colors</h3>
                <p className="text-muted-foreground mt-1 text-[13px]">
                  경기 일정, 선호 구단, 결과 맥락에서만 강하게 노출합니다.
                </p>
                <div className="mt-4 grid gap-2">
                  {teams.map(([code, team]) => (
                    <TeamColorChip
                      key={code}
                      code={team.shortName}
                      name={team.name}
                      primary={team.primary}
                      secondary={team.secondary}
                    />
                  ))}
                </div>
              </div>
            </div>
          </Section>

          <Section
            id="type"
            eyebrow="Type"
            title="타이포그래피"
            description="큰 문장은 명확하게, 보조 문장은 짧게, 점수와 시간은 스포츠 중계처럼 힘 있게 보이도록 구분합니다."
          >
            <div className="grid gap-3">
              {TYPE_SAMPLES.map((type) => (
                <div key={type.label} className="bg-card rounded-2xl border p-5">
                  <div className="text-muted-foreground mb-3 flex items-center gap-2 text-[11px] font-semibold tracking-[0.18em] uppercase">
                    <Type className="h-3.5 w-3.5" />
                    {type.label}
                  </div>
                  <p className={cn(type.className)}>{type.sample}</p>
                </div>
              ))}
            </div>
          </Section>

          <Section
            id="components"
            eyebrow="UI Elements"
            title="화면 요소"
            description="버튼, 배지, 진행률, 로딩 상태는 모두 작고 빠르게 읽히는 모바일 밀도를 기준으로 맞춥니다."
          >
            <div className="grid gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>버튼</CardTitle>
                  <CardDescription>
                    시작, 선택, 다시 시도처럼 행동이 필요한 순간에 분명하게 보입니다.
                  </CardDescription>
                  <CardAction>
                    <Badge variant="secondary">UI</Badge>
                  </CardAction>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                  <Button>
                    <Search className="h-4 w-4" />
                    분석하기
                  </Button>
                  <Button variant="secondary">
                    <Camera className="h-4 w-4" />
                    사진 선택
                  </Button>
                  <Button variant="outline">다른 사진</Button>
                  <Button variant="ghost" size="icon" aria-label="상세 보기">
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>배지</CardTitle>
                  <CardDescription>상태와 맥락은 작고 명확한 라벨로 표현합니다.</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                  <Badge>MY</Badge>
                  <Badge variant="secondary">종료</Badge>
                  <Badge variant="outline">예정</Badge>
                  <Badge variant="destructive">LIVE</Badge>
                  <Badge
                    variant="outline"
                    className="border-amber-400/50 text-amber-600 dark:text-amber-400"
                  >
                    취소
                  </Badge>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>진행률</CardTitle>
                  <CardDescription>
                    진행률은 얇고 차분하게 유지하되 결과 수치는 선명하게 표시합니다.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div>
                    <div className="mb-2 flex justify-between text-[12px]">
                      <span className="font-medium">얼굴 특징 추출</span>
                      <span className="text-muted-foreground tabular-nums">{quality[0]}%</span>
                    </div>
                    <Progress value={quality[0]} />
                  </div>
                  <Slider value={quality} onValueChange={setQuality} max={100} step={1} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>로딩</CardTitle>
                  <CardDescription>
                    스켈레톤은 실제 레이아웃의 밀도와 비율을 유지합니다.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-12 w-12 rounded-xl" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-2/3" />
                      <Skeleton className="h-3 w-1/2" />
                    </div>
                    <Skeleton className="h-6 w-12 rounded-full" />
                  </div>
                </CardContent>
              </Card>
            </div>
          </Section>

          <Section
            id="patterns"
            eyebrow="Scenes"
            title="주요 장면"
            description="일정, 결과, 분석 과정처럼 서비스에서 반복되는 순간을 같은 리듬으로 보여줍니다."
          >
            <div className="grid gap-4">
              <div className="bg-muted/25 rounded-3xl border p-4">
                <div className="mb-4 flex items-center gap-2">
                  <CalendarDays className="text-accent h-4 w-4" />
                  <h3 className="text-[14px] font-extrabold">경기 카드</h3>
                </div>
                <GamePatternCard />
              </div>

              <div className="bg-muted/25 rounded-3xl border p-4">
                <div className="mb-4 flex items-center gap-2">
                  <BadgeCheck className="text-accent h-4 w-4" />
                  <h3 className="text-[14px] font-extrabold">닮은꼴 순위</h3>
                </div>
                <MatchPatternCard />
              </div>

              <div className="bg-muted/25 rounded-3xl border p-4">
                <div className="mb-4 flex items-center gap-2">
                  <WandSparkles className="text-accent h-4 w-4" />
                  <h3 className="text-[14px] font-extrabold">움직임</h3>
                </div>
                <div className="grid gap-2">
                  {MOTION_SAMPLES.map((motion, index) => (
                    <div
                      key={motion.label}
                      className={cn(
                        'bg-card flex items-center gap-3 rounded-2xl p-3',
                        motion.className,
                      )}
                      style={{ animationDelay: `${index * 120}ms` }}
                    >
                      <div className="bg-accent/10 text-accent flex h-10 w-10 items-center justify-center rounded-full">
                        <CircleDot className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-[13px] font-bold">{motion.label}</p>
                        <p className="text-muted-foreground text-[11px]">가볍고 짧은 전환</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="bg-card mt-8 rounded-3xl border p-5">
              <div>
                <div className="text-muted-foreground mb-3 flex items-center gap-2 text-[11px] font-semibold tracking-[0.18em] uppercase">
                  <ShieldCheck className="text-accent h-3.5 w-3.5" />
                  Tone
                </div>
                <h3 className="text-[22px] leading-tight font-extrabold tracking-tight">
                  가볍고, 빠르고, 야구 맥락 안에서만 장난스럽게
                </h3>
                <p className="text-muted-foreground mt-2 max-w-2xl text-[14px] leading-relaxed">
                  안내 문구는 짧게 유지하고, 점수·순위·진행 상태처럼 사용자가 바로 판단해야 하는
                  정보는 숫자와 대비를 우선합니다.
                </p>
              </div>
            </div>
          </Section>
        </div>
      </main>
    </div>
  );
};
