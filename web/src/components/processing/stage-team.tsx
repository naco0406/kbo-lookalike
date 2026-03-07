import type { FC } from 'react';
import { useMemo, useState, useEffect, useRef } from 'react';
import type { TeamClassification } from '@/types/player';
import {
  STAGE_MESSAGES,
  NOT_BASEBALL_FACE_MESSAGES,
  NOT_BASEBALL_FACE_CONTINUE,
  TEAM_COLORS,
  TEAM_ORDER,
  getTeamShortName,
  pickRandom,
} from '@/constants/analysis-messages';
import { cn } from '@/lib/utils';

interface StageTeamProps {
  teamResult?: TeamClassification;
  isBaseballFace?: boolean;
}

export const StageTeam: FC<StageTeamProps> = ({ teamResult, isBaseballFace }) => {
  const message = useMemo(() => pickRandom(STAGE_MESSAGES.teamClassify), []);
  const notBaseballMsg = useMemo(() => pickRandom(NOT_BASEBALL_FACE_MESSAGES), []);
  const decided = !!teamResult;

  // 감속 룰렛: 150ms → 점진적 감속 → 500ms
  const [highlightIdx, setHighlightIdx] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const speedRef = useRef(150);

  useEffect(() => {
    if (decided) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }

    const tick = () => {
      setHighlightIdx((prev) => (prev + 1) % TEAM_ORDER.length);
      // 점진적 감속
      speedRef.current = Math.min(speedRef.current + 8, 500);
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = setInterval(tick, speedRef.current);
    };

    intervalRef.current = setInterval(tick, speedRef.current);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [decided]);

  // 결과에서 상위 팀 코드 Set
  const topTeamSet = useMemo(() => {
    if (!teamResult) return new Set<string>();
    return new Set(teamResult.topTeams.map((t) => t.teamCode));
  }, [teamResult]);

  const topTeamCode = teamResult?.topTeams[0]?.teamCode;

  return (
    <div className="flex flex-col items-center gap-5">
      {/* 원형 팀 배치 */}
      <div className="relative h-52 w-52 sm:h-60 sm:w-60">
        {TEAM_ORDER.map((tc, i) => {
          const angle = (i / TEAM_ORDER.length) * Math.PI * 2 - Math.PI / 2;
          const radius = 42;
          const x = 50 + radius * Math.cos(angle);
          const y = 50 + radius * Math.sin(angle);
          const colors = TEAM_COLORS[tc];
          const isHighlighted = !decided && i === highlightIdx;
          const isTop = decided && topTeamSet.has(tc);
          const isFirst = decided && tc === topTeamCode;
          const isNotTop = decided && !isTop;

          return (
            <div
              key={tc}
              className={cn(
                'absolute flex flex-col items-center gap-0.5 transition-all duration-500',
                isNotTop && 'opacity-15',
                isFirst && 'z-10',
              )}
              style={{
                left: `${x}%`,
                top: `${y}%`,
                transform: `translate(-50%, -50%) scale(${isFirst ? 1.15 : isNotTop ? 0.85 : 1})`,
              }}
            >
              <div
                className={cn(
                  'flex items-center justify-center rounded-full text-[10px] font-bold text-white transition-all duration-500',
                  isFirst
                    ? 'h-11 w-11 text-xs ring-2 ring-offset-2 ring-offset-background sm:h-12 sm:w-12'
                    : 'h-8 w-8 sm:h-9 sm:w-9 sm:text-[11px]',
                  isHighlighted && 'ring-2 ring-offset-1 ring-offset-background',
                )}
                style={{
                  backgroundColor: colors?.bg ?? '#666',
                  ...(isHighlighted || isFirst ? { ringColor: colors?.primary } : {}),
                }}
              >
                {getTeamShortName(tc)}
              </div>
              {(isHighlighted || isTop) && (
                <span className={cn(
                  'text-[9px] font-medium whitespace-nowrap transition-all duration-300',
                  isFirst ? 'text-foreground font-bold text-[10px]' : 'text-muted-foreground',
                )}>
                  {colors?.shortName ?? tc}
                </span>
              )}
            </div>
          );
        })}

        {/* 중앙 텍스트 */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            {decided && topTeamCode ? (
              <div className="animate-scale-reveal">
                <p className="text-lg font-bold sm:text-xl">
                  {TEAM_COLORS[topTeamCode]?.shortName}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {TEAM_COLORS[topTeamCode]?.name}
                </p>
              </div>
            ) : (
              <div className="h-1.5 w-1.5 animate-ping rounded-full bg-foreground/20" />
            )}
          </div>
        </div>
      </div>

      {/* 비야구선수상 메시지 — 말풍선 스타일 */}
      {decided && isBaseballFace === false && (
        <div className="relative max-w-[260px] animate-reveal-up rounded-2xl bg-muted/40 px-4 py-3 text-center">
          <div className="absolute -top-1.5 left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 bg-muted/40" />
          <p className="text-[13px] font-medium">{notBaseballMsg}</p>
          <p className="text-muted-foreground mt-1 text-[11px]">{NOT_BASEBALL_FACE_CONTINUE}</p>
        </div>
      )}

      {/* 메시지 */}
      <p className="text-muted-foreground text-center text-sm font-medium">
        {message}
      </p>
    </div>
  );
};
