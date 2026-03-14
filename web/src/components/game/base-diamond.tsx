import type { FC } from 'react';
import { cn } from '@/lib/utils';

interface BaseDiamondProps {
  /** [1루, 2루, 3루] 주자 유무 */
  bases: [boolean, boolean, boolean];
  /** BSO 카운트 */
  ball?: number;
  strike?: number;
  out?: number;
  className?: string;
}

/**
 * 야구 다이아몬드 + BSO 인디케이터.
 * 주자가 있는 베이스는 팀 컬러(amber)로 채워진다.
 */
export const BaseDiamond: FC<BaseDiamondProps> = ({
  bases,
  ball = 0,
  strike = 0,
  out = 0,
  className,
}) => {
  // 다이아몬드 좌표 (viewBox 64×64 기준, 중심 32,28)
  const cx = 32;
  const cy = 28;
  const r = 18; // 홈→베이스 거리

  // 베이스 위치: 홈(하), 1루(우), 2루(상), 3루(좌)
  const basePos = [
    { x: cx + r, y: cy, label: '1B' },      // 1루
    { x: cx, y: cy - r, label: '2B' },      // 2루
    { x: cx - r, y: cy, label: '3B' },      // 3루
  ];

  const homePos = { x: cx, y: cy + r };
  const baseSize = 7;

  return (
    <div className={cn('flex flex-col items-center gap-1', className)}>
      <svg viewBox="0 0 64 64" className="h-14 w-14">
        {/* 베이스 라인 */}
        <path
          d={`M${homePos.x},${homePos.y} L${basePos[0].x},${basePos[0].y} L${basePos[1].x},${basePos[1].y} L${basePos[2].x},${basePos[2].y} Z`}
          fill="none"
          stroke="currentColor"
          strokeWidth={0.8}
          opacity={0.15}
        />

        {/* 각 베이스 (다이아몬드 모양 45도 회전 사각형) */}
        {basePos.map((pos, i) => {
          const occupied = bases[i];
          const half = baseSize / 2;
          const pts = [
            `${pos.x},${pos.y - half}`,
            `${pos.x + half},${pos.y}`,
            `${pos.x},${pos.y + half}`,
            `${pos.x - half},${pos.y}`,
          ].join(' ');

          return (
            <polygon
              key={i}
              points={pts}
              fill={occupied ? '#f59e0b' : 'currentColor'}
              opacity={occupied ? 0.9 : 0.08}
              stroke={occupied ? '#f59e0b' : 'currentColor'}
              strokeWidth={occupied ? 0 : 0.5}
              strokeOpacity={0.2}
              className={cn(occupied && 'drop-shadow-[0_0_4px_rgba(245,158,11,0.4)]')}
            />
          );
        })}

        {/* 홈플레이트 (오각형) */}
        {(() => {
          const h = homePos;
          const s = 4;
          const pts = [
            `${h.x - s},${h.y - s * 0.4}`,
            `${h.x + s},${h.y - s * 0.4}`,
            `${h.x + s},${h.y + s * 0.3}`,
            `${h.x},${h.y + s * 0.8}`,
            `${h.x - s},${h.y + s * 0.3}`,
          ].join(' ');
          return <polygon points={pts} fill="currentColor" opacity={0.15} />;
        })()}
      </svg>

      {/* BSO 카운트 */}
      <div className="flex items-center gap-2.5 text-[9px]">
        {/* Ball */}
        <div className="flex items-center gap-0.5">
          <span className="font-medium text-muted-foreground/40">B</span>
          {Array.from({ length: 4 }, (_, i) => (
            <span
              key={i}
              className={cn(
                'h-[5px] w-[5px] rounded-full transition-colors',
                i < ball ? 'bg-blue-400' : 'bg-muted-foreground/10',
              )}
            />
          ))}
        </div>

        {/* Strike */}
        <div className="flex items-center gap-0.5">
          <span className="font-medium text-muted-foreground/40">S</span>
          {Array.from({ length: 3 }, (_, i) => (
            <span
              key={i}
              className={cn(
                'h-[5px] w-[5px] rounded-full transition-colors',
                i < strike ? 'bg-amber-400' : 'bg-muted-foreground/10',
              )}
            />
          ))}
        </div>

        {/* Out */}
        <div className="flex items-center gap-0.5">
          <span className="font-medium text-muted-foreground/40">O</span>
          {Array.from({ length: 3 }, (_, i) => (
            <span
              key={i}
              className={cn(
                'h-[5px] w-[5px] rounded-full transition-colors',
                i < out ? 'bg-red-400' : 'bg-muted-foreground/10',
              )}
            />
          ))}
        </div>
      </div>
    </div>
  );
};
