import type { FC } from 'react';
import type { Classification } from '@/types/player';
import { TEAM_COLORS } from '@/constants/analysis-messages';
import { cn } from '@/lib/utils';

interface BaseballProfileProps {
  classification: Classification;
}

interface GradeInfo {
  grade: string;
  label: string;
  bgColor: string;
  textColor: string;
}

const getBaseballGrade = (zScore: number): GradeInfo => {
  if (zScore >= 0.5) return { grade: 'S', label: '에이스급 야구인 상', bgColor: 'bg-amber-400', textColor: 'text-amber-950' };
  if (zScore >= -0.5) return { grade: 'A', label: '야구선수 상', bgColor: 'bg-zinc-300', textColor: 'text-zinc-800' };
  if (zScore >= -1.5) return { grade: 'B', label: '야구 느낌 있는 상', bgColor: 'bg-orange-300', textColor: 'text-orange-900' };
  if (zScore >= -2.5) return { grade: 'C', label: '야구장은 관중석으로', bgColor: 'bg-muted', textColor: 'text-muted-foreground' };
  return { grade: 'D', label: '야구보다는 다른 분야!', bgColor: 'bg-muted/60', textColor: 'text-muted-foreground/70' };
};

export const BaseballProfile: FC<BaseballProfileProps> = ({ classification }) => {
  const { position, team, baseballFaceScore } = classification;
  const grade = getBaseballGrade(baseballFaceScore);
  const topTeam = team.topTeams[0];
  const teamColor = topTeam ? TEAM_COLORS[topTeam.teamCode] : null;

  return (
    <div className="flex items-center gap-3 rounded-xl border bg-card/60 px-4 py-3">
      {/* Grade badge */}
      <div className={cn(
        'flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-extrabold',
        grade.bgColor, grade.textColor,
      )}>
        {grade.grade}
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold leading-snug">{grade.label}</p>
        <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <span>{position.position}</span>
          <span className="text-border">·</span>
          {teamColor && (
            <span className="flex items-center gap-1">
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ backgroundColor: teamColor.bg }}
              />
              {teamColor.shortName}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
