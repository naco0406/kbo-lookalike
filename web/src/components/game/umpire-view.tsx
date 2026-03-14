import type { FC } from 'react';
import { useId, useMemo } from 'react';
import { cn } from '@/lib/utils';
import type { ParsedPitch } from './pitch-utils';
import { computeTrajectoryPoints, PITCH_RESULT_COLOR } from './pitch-utils';

// ── Layout ──────────────────────────────────────────────────────────────────

const SVG_W = 400;
const SVG_H = 380;

// ── Palette ─────────────────────────────────────────────────────────────────

const SKY_TOP = '#2d6aa0';
const SKY_MID = '#5a9ac8';
const SKY_BOT = '#a8cce4';
const GRASS_DARK = '#1a5c14';
const GRASS_MID = '#237a1c';
const GRASS_LIGHT = '#2d9424';
const DIRT_CENTER = '#b09060';
const DIRT_EDGE = '#8a7048';
const CHALK = 'rgba(255,255,255,0.7)';
const CHALK_FAINT = 'rgba(255,255,255,0.35)';
const PLATE_TOP = '#e8e4d8';
const PLATE_SIDE = '#c8c0b0';
const GHOST_BALL_COLOR = '#f0ebe0';
const TRAIL_COLOR = '#d8d4ca';

// ── Camera & Physics ────────────────────────────────────────────────────────

const PLATE_HALF_W = 0.7083;
const PLATE_Y = 0.7;
const EYE_BACK = 5.0;
const EYE_HEIGHT = 2.8;
const D_PLATE = PLATE_Y + EYE_BACK;
const BALL_R = 7;
const TRAIL_COUNT = 10;
const TRAIL_STEP = 0.02;

// ── Unified Scale ───────────────────────────────────────────────────────────

const PX_PER_FT = 56;
const ZONE_CX = SVG_W / 2;
const HORIZON_Y = 145;

// ── Geometry ────────────────────────────────────────────────────────────────

type Proj = (wx: number, wy: number, wz: number) => { sx: number; sy: number; scale: number };
type ScreenPt = { sx: number; sy: number };

const computeZone = (topSz: number, bottomSz: number) => {
  const midZ = (topSz + bottomSz) / 2;
  const cy = HORIZON_Y + (EYE_HEIGHT - midZ) * PX_PER_FT;
  return { cx: ZONE_CX, cy, hw: PLATE_HALF_W * PX_PER_FT, hh: ((topSz - bottomSz) / 2) * PX_PER_FT };
};

const makeProject = (topSz: number, bottomSz: number): Proj => {
  const zone = computeZone(topSz, bottomSz);
  const midZ = (topSz + bottomSz) / 2;
  return (wx, wy, wz) => {
    const d = wy + EYE_BACK;
    const s = d > 0.05 ? D_PLATE / d : 0;
    return { sx: zone.cx + wx * PX_PER_FT * s, sy: zone.cy - (wz - midZ) * PX_PER_FT * s, scale: s };
  };
};

const plateToScreen = (x: number, z: number, topSz: number, bottomSz: number): ScreenPt => {
  const zone = computeZone(topSz, bottomSz);
  const midZ = (topSz + bottomSz) / 2;
  return { sx: zone.cx + x * PX_PER_FT, sy: zone.cy - (z - midZ) * PX_PER_FT };
};

// ── Helpers ─────────────────────────────────────────────────────────────────

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

const interpolatePoints = (
  pts: Array<{ x: number; y: number; z: number }>,
  progress: number,
) => {
  const idx = progress * (pts.length - 1);
  const i = Math.floor(idx);
  const f = idx - i;
  if (i >= pts.length - 1) return pts[pts.length - 1];
  return {
    x: lerp(pts[i].x, pts[i + 1].x, f),
    y: lerp(pts[i].y, pts[i + 1].y, f),
    z: lerp(pts[i].z, pts[i + 1].z, f),
  };
};

const ptsToStr = (pts: ScreenPt[]) =>
  pts.map(p => `${p.sx.toFixed(1)},${p.sy.toFixed(1)}`).join(' ');

// ── Stadium Backdrop ────────────────────────────────────────────────────────

const StadiumBackdrop: FC<{ uid: string }> = ({ uid }) => (
  <g>
    {/* Outfield wall */}
    <rect x={0} y={HORIZON_Y - 22} width={SVG_W} height={22}
      fill="rgba(20,50,20,0.18)" />
    {/* Scoreboard glow */}
    <rect x={SVG_W * 0.35} y={HORIZON_Y - 30} width={SVG_W * 0.3} height={12} rx={2}
      fill="rgba(40,70,40,0.12)" />
    {/* Light towers */}
    {[65, SVG_W - 65].map((tx, i) => (
      <g key={i}>
        <rect x={tx - 1.5} y={HORIZON_Y - 45} width={3} height={30}
          fill="rgba(80,80,80,0.08)" />
        <rect x={tx - 6} y={HORIZON_Y - 48} width={12} height={5} rx={1}
          fill="rgba(255,255,220,0.06)" />
      </g>
    ))}
    {/* Crowd texture */}
    <defs>
      <pattern id={`${uid}-crowd`} width={6} height={4} patternUnits="userSpaceOnUse">
        <circle cx={1.5} cy={2} r={0.6} fill="rgba(180,120,80,0.08)" />
        <circle cx={4.5} cy={1} r={0.5} fill="rgba(60,80,160,0.06)" />
        <circle cx={3} cy={3} r={0.5} fill="rgba(200,60,60,0.05)" />
      </pattern>
    </defs>
    <rect x={0} y={HORIZON_Y - 20} width={SVG_W} height={20}
      fill={`url(#${uid}-crowd)`} />
  </g>
);

// ── 3D Field ────────────────────────────────────────────────────────────────

const Field3D: FC<{ project: Proj; uid: string }> = ({ project, uid }) => {
  const el = useMemo(() => {
    const toScreen = (x: number, y: number, z = 0): ScreenPt => {
      const { sx, sy } = project(x, y, z);
      return { sx, sy };
    };

    // Grass mowing stripes
    const stripes: ScreenPt[][] = [];
    const stripeYs = [1, 4, 8, 14, 22, 32, 44, 58];
    for (let i = 0; i < stripeYs.length - 1; i++) {
      const y1 = stripeYs[i], y2 = stripeYs[i + 1], hw = 30;
      stripes.push([toScreen(-hw, y1), toScreen(hw, y1), toScreen(hw, y2), toScreen(-hw, y2)]);
    }

    // Infield dirt
    const dirtPts: ScreenPt[] = [];
    for (let angle = -15; angle <= 100; angle += 5) {
      const rad = (angle * Math.PI) / 180;
      const r = 28 + Math.sin(rad * 0.8) * 4;
      dirtPts.push(toScreen(Math.cos(rad) * r * 0.4, Math.max(PLATE_Y + Math.sin(rad) * r, -0.3)));
    }
    for (let angle = 100; angle >= -15; angle -= 5) {
      const rad = (angle * Math.PI) / 180;
      const r = 28 + Math.sin(rad * 0.8) * 4;
      dirtPts.push(toScreen(-Math.cos(rad) * r * 0.4, Math.max(PLATE_Y + Math.sin(rad) * r, -0.3)));
    }

    // Plate area dirt
    const plateDirt: ScreenPt[] = [];
    for (let a = 0; a < 360; a += 10) {
      const rad = (a * Math.PI) / 180;
      plateDirt.push(toScreen(Math.cos(rad) * 6.5, PLATE_Y + Math.sin(rad) * 5));
    }

    // Home plate
    const PW = PLATE_HALF_W;
    const plate = [
      toScreen(-PW, PLATE_Y + 0.708), toScreen(PW, PLATE_Y + 0.708),
      toScreen(PW, PLATE_Y + 0.354), toScreen(0, PLATE_Y), toScreen(-PW, PLATE_Y + 0.354),
    ];
    const PB = PW + 0.03;
    const plateBorder = [
      toScreen(-PB, PLATE_Y + 0.738), toScreen(PB, PLATE_Y + 0.738),
      toScreen(PB, PLATE_Y + 0.334), toScreen(0, PLATE_Y - 0.03), toScreen(-PB, PLATE_Y + 0.334),
    ];

    // Batter's boxes
    const boxGap = 0.5, boxW = 4, boxH = 6, boxNear = PLATE_Y - 0.5, boxFar = boxNear + boxH;
    const lBox = [toScreen(-(PW + boxGap), boxFar), toScreen(-(PW + boxGap + boxW), boxFar), toScreen(-(PW + boxGap + boxW), boxNear), toScreen(-(PW + boxGap), boxNear)];
    const rBox = [toScreen(PW + boxGap, boxFar), toScreen(PW + boxGap + boxW, boxFar), toScreen(PW + boxGap + boxW, boxNear), toScreen(PW + boxGap, boxNear)];

    // Catcher's box
    const cBW = 3.6;
    const cBox = [toScreen(-cBW / 2, PLATE_Y - 0.1), toScreen(cBW / 2, PLATE_Y - 0.1), toScreen(cBW / 2, PLATE_Y - 4), toScreen(-cBW / 2, PLATE_Y - 4)];

    // Foul lines
    const foulL: ScreenPt[] = [], foulR: ScreenPt[] = [];
    for (let d = 0; d <= 60; d += 1.5) {
      const off = d * 0.7071;
      foulL.push(toScreen(-off, PLATE_Y + off));
      foulR.push(toScreen(off, PLATE_Y + off));
    }

    // Mound
    const mound = project(0, 60.5, 0.83);
    const moundDirt: ScreenPt[] = [];
    for (let a = 0; a < 360; a += 15) {
      const rad = (a * Math.PI) / 180;
      moundDirt.push(toScreen(Math.cos(rad) * 4.5, 60.5 + Math.sin(rad) * 4.5));
    }

    return { stripes, dirtPts, plateDirt, plate, plateBorder, lBox, rBox, cBox, foulL, foulR, mound, moundDirt };
  }, [project]);

  return (
    <g>
      {/* Grass stripes */}
      {el.stripes.map((pts, i) => (
        <polygon key={i} points={ptsToStr(pts)}
          fill={i % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)'} />
      ))}

      {/* Infield dirt */}
      <defs>
        <radialGradient id={`${uid}-dirt`} cx="50%" cy="30%" r="60%">
          <stop offset="0%" stopColor={DIRT_CENTER} />
          <stop offset="100%" stopColor={DIRT_EDGE} />
        </radialGradient>
      </defs>
      <polygon points={ptsToStr(el.dirtPts)} fill={`url(#${uid}-dirt)`} opacity={0.85} />
      <polygon points={ptsToStr(el.plateDirt)} fill={DIRT_CENTER} opacity={0.5} />
      <polygon points={ptsToStr(el.moundDirt)} fill={DIRT_EDGE} opacity={0.4} />

      {/* Foul lines */}
      <polyline points={ptsToStr(el.foulL)} fill="none" stroke={CHALK} strokeWidth={1.2} />
      <polyline points={ptsToStr(el.foulR)} fill="none" stroke={CHALK} strokeWidth={1.2} />

      {/* Boxes */}
      <polygon points={ptsToStr(el.lBox)} fill="none" stroke={CHALK_FAINT} strokeWidth={0.9} />
      <polygon points={ptsToStr(el.rBox)} fill="none" stroke={CHALK_FAINT} strokeWidth={0.9} />
      <polygon points={ptsToStr(el.cBox)} fill="none" stroke={CHALK_FAINT} strokeWidth={0.6} />

      {/* Mound */}
      <ellipse cx={el.mound.sx} cy={el.mound.sy}
        rx={Math.max(4, 18 * el.mound.scale)} ry={Math.max(1.5, 5 * el.mound.scale)}
        fill="rgba(160,130,80,0.15)" />
      <rect x={el.mound.sx - Math.max(2, 6 * el.mound.scale)} y={el.mound.sy - 1}
        width={Math.max(4, 12 * el.mound.scale)} height={2} rx={0.5}
        fill="rgba(255,255,255,0.3)" />

      {/* Home plate */}
      <polygon points={ptsToStr(el.plateBorder)} fill="#222" />
      <polygon points={ptsToStr(el.plate)} fill={PLATE_TOP}
        stroke={PLATE_SIDE} strokeWidth={0.5} strokeLinejoin="round" />
    </g>
  );
};

// ── Baseball (emoji) ────────────────────────────────────────────────────────

const Baseball: FC<{
  cx: number; cy: number; r: number; uid: string;
  rotation?: number; number?: number;
}> = ({ cx, cy, r, rotation = 0, number }) => {
  const fs = r * 2.15;

  return (
    <g>
      <ellipse cx={cx} cy={cy + r + 2} rx={r * 0.4} ry={r * 0.07}
        fill="rgba(0,0,0,0.1)" />
      <text
        x={cx} y={cy}
        textAnchor="middle" dominantBaseline="central"
        fontSize={fs}
        transform={`rotate(${rotation},${cx},${cy})`}
      >⚾</text>
      {number != null && (
        <text x={cx} y={cy + 0.5} textAnchor="middle" dominantBaseline="middle"
          fill="white" fontSize={Math.max(5, r * 0.85)} fontWeight={700}
          style={{ textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>{number}</text>
      )}
    </g>
  );
};

// ── Main Component ──────────────────────────────────────────────────────────

interface UmpireViewProps {
  pitches: ParsedPitch[];
  currentPitchIndex: number;
  phase: 'intro' | 'flying' | 'landed';
  progress: number;
  showZone?: boolean;
  className?: string;
}

export const UmpireView: FC<UmpireViewProps> = ({
  pitches,
  currentPitchIndex,
  phase,
  progress,
  showZone = true,
  className,
}) => {
  const uid = useId().replace(/:/g, '');
  const pitch = pitches[currentPitchIndex];
  const topSz = pitch?.topSz ?? pitches[0]?.topSz ?? 3.4;
  const bottomSz = pitch?.bottomSz ?? pitches[0]?.bottomSz ?? 1.6;
  const impactColor = pitch ? PITCH_RESULT_COLOR[pitch.result] : '#888';

  const zone = useMemo(() => computeZone(topSz, bottomSz), [topSz, bottomSz]);
  const project = useMemo(() => makeProject(topSz, bottomSz), [topSz, bottomSz]);

  const trajPoints = useMemo(
    () => (pitch?.trajectory ? computeTrajectoryPoints(pitch.trajectory, 60) : []),
    // pitch identity changes with currentPitchIndex; trajectory object ref may be stable
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentPitchIndex, pitch?.trajectory],
  );

  const zoneLeft = zone.cx - zone.hw;
  const zoneRight = zone.cx + zone.hw;
  const zoneTop = zone.cy - zone.hh;
  const zoneBottom = zone.cy + zone.hh;

  const ballRotation = progress * 720;

  // ── Trail path ──
  const trailData = useMemo(() => {
    if (trajPoints.length < 2 || phase === 'intro') return null;
    const end = phase === 'landed' ? 1 : progress;
    const steps = Math.max(2, Math.ceil(end * 40));
    const parts: string[] = [];
    let sx0 = 0, sy0 = 0, sx1 = 0, sy1 = 0;
    for (let i = 0; i <= steps; i++) {
      const p = (i / steps) * end;
      const pos = interpolatePoints(trajPoints, p);
      const { sx, sy } = project(pos.x, pos.y, pos.z);
      parts.push(`${i === 0 ? 'M' : 'L'}${sx.toFixed(1)},${sy.toFixed(1)}`);
      if (i === 0) { sx0 = sx; sy0 = sy; }
      sx1 = sx; sy1 = sy;
    }
    return { path: parts.join(' '), sx0, sy0, sx1, sy1 };
  }, [trajPoints, phase, progress, project]);

  // ── Ghost balls (trail afterimages) ──
  const ghosts = useMemo(() => {
    if (phase !== 'flying' || trajPoints.length < 2) return [];
    const out: Array<{ sx: number; sy: number; r: number; opacity: number }> = [];
    for (let i = 1; i <= TRAIL_COUNT; i++) {
      const p = progress - i * TRAIL_STEP;
      if (p < 0) break;
      const pos = interpolatePoints(trajPoints, p);
      const { sx, sy, scale } = project(pos.x, pos.y, pos.z);
      out.push({ sx, sy, r: Math.max(1.5, BALL_R * scale), opacity: 0.3 * (1 - i / (TRAIL_COUNT + 1)) });
    }
    return out;
  }, [phase, progress, trajPoints, project]);

  // ── Flying ball projection ──
  const flyingBall = useMemo(() => {
    if (phase !== 'flying' || trajPoints.length === 0) return null;
    const pos = interpolatePoints(trajPoints, progress);
    const projected = project(pos.x, pos.y, pos.z);
    return {
      ...projected,
      r: Math.max(2, BALL_R * projected.scale),
      intensity: Math.min(1, progress * 1.5),
    };
  }, [phase, trajPoints, progress, project]);

  // ── Landed ball screen position ──
  const landedPos = useMemo(() => {
    if (phase !== 'landed' || !pitch) return null;
    const last = trajPoints.length > 0 ? trajPoints[trajPoints.length - 1] : null;
    const loc = last ? { x: last.x, z: last.z } : pitch.location;
    if (!loc) return null;
    return plateToScreen(loc.x, loc.z, topSz, bottomSz);
  }, [phase, pitch, trajPoints, topSz, bottomSz]);

  return (
    <div className={cn('flex flex-col items-center', className)}>
      <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} className="w-full" role="img" aria-label="심판 시점">
        <defs>
          <linearGradient id={`${uid}-sky`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={SKY_TOP} />
            <stop offset="45%" stopColor={SKY_MID} />
            <stop offset="100%" stopColor={SKY_BOT} />
          </linearGradient>
          <linearGradient id={`${uid}-grass`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={GRASS_DARK} />
            <stop offset="40%" stopColor={GRASS_MID} />
            <stop offset="100%" stopColor={GRASS_LIGHT} />
          </linearGradient>
          <linearGradient id={`${uid}-haze`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={SKY_BOT} stopOpacity={0.5} />
            <stop offset="100%" stopColor={SKY_BOT} stopOpacity={0} />
          </linearGradient>
          <filter id={`${uid}-glow`}>
            <feGaussianBlur stdDeviation="4" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id={`${uid}-bglow`}>
            <feGaussianBlur stdDeviation="1.5" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          {trailData && (
            <linearGradient id={`${uid}-trail`} gradientUnits="userSpaceOnUse"
              x1={trailData.sx0} y1={trailData.sy0} x2={trailData.sx1} y2={trailData.sy1}>
              <stop offset="0%" stopColor={TRAIL_COLOR} stopOpacity={0} />
              <stop offset="20%" stopColor={TRAIL_COLOR} stopOpacity={0.25} />
              <stop offset="100%" stopColor={TRAIL_COLOR} stopOpacity={0.9} />
            </linearGradient>
          )}
          {trailData && (
            <linearGradient id={`${uid}-trail-outer`} gradientUnits="userSpaceOnUse"
              x1={trailData.sx0} y1={trailData.sy0} x2={trailData.sx1} y2={trailData.sy1}>
              <stop offset="0%" stopColor={TRAIL_COLOR} stopOpacity={0} />
              <stop offset="30%" stopColor={TRAIL_COLOR} stopOpacity={0.08} />
              <stop offset="100%" stopColor={TRAIL_COLOR} stopOpacity={0.25} />
            </linearGradient>
          )}
          {showZone && (
            <linearGradient id={`${uid}-zbg`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="white" stopOpacity={0.03} />
              <stop offset="100%" stopColor="white" stopOpacity={0.07} />
            </linearGradient>
          )}
        </defs>

        {/* Sky */}
        <rect x={0} y={0} width={SVG_W} height={HORIZON_Y + 8} fill={`url(#${uid}-sky)`} />

        {/* Stadium backdrop */}
        <StadiumBackdrop uid={uid} />

        {/* Grass */}
        <rect x={0} y={HORIZON_Y} width={SVG_W} height={SVG_H - HORIZON_Y}
          fill={`url(#${uid}-grass)`} />

        {/* Horizon haze */}
        <rect x={0} y={HORIZON_Y} width={SVG_W} height={18}
          fill={`url(#${uid}-haze)`} />

        {/* 3D Field */}
        <Field3D project={project} uid={uid} />

        {/* Strike Zone */}
        {showZone && (
          <g>
            <rect x={zoneLeft - 1} y={zoneTop - 1}
              width={zone.hw * 2 + 2} height={zone.hh * 2 + 2}
              fill="none" stroke="rgba(0,0,0,0.12)" strokeWidth={2} rx={1} />
            <rect x={zoneLeft} y={zoneTop} width={zone.hw * 2} height={zone.hh * 2}
              fill={`url(#${uid}-zbg)`} rx={1} />
            <rect x={zoneLeft} y={zoneTop} width={zone.hw * 2} height={zone.hh * 2}
              fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth={1.2} rx={1} />
            {[1, 2].map(i => (
              <line key={`h${i}`}
                x1={zoneLeft} y1={zoneTop + ((zone.hh * 2) / 3) * i}
                x2={zoneRight} y2={zoneTop + ((zone.hh * 2) / 3) * i}
                stroke="rgba(255,255,255,0.15)" strokeWidth={0.5} strokeDasharray="3 4" />
            ))}
            {[1, 2].map(i => (
              <line key={`v${i}`}
                x1={zoneLeft + ((zone.hw * 2) / 3) * i} y1={zoneTop}
                x2={zoneLeft + ((zone.hw * 2) / 3) * i} y2={zoneBottom}
                stroke="rgba(255,255,255,0.15)" strokeWidth={0.5} strokeDasharray="3 4" />
            ))}
          </g>
        )}

        {/* Previous pitches */}
        {pitches.slice(0, currentPitchIndex).map((p, i) => {
          if (!p.location) return null;
          const { sx, sy } = plateToScreen(p.location.x, p.location.z, topSz, bottomSz);
          const c = PITCH_RESULT_COLOR[p.result];
          return (
            <g key={i} opacity={0.35}>
              <circle cx={sx} cy={sy} r={4.5} fill={c} stroke="rgba(0,0,0,0.2)" strokeWidth={0.4} />
              <text x={sx} y={sy + 0.3} textAnchor="middle" dominantBaseline="middle"
                fill="white" fontSize={4.5} fontWeight={700}>{p.number}</text>
            </g>
          );
        })}

        {/* Trail */}
        {trailData && (
          <g>
            <path d={trailData.path} fill="none" stroke={TRAIL_COLOR}
              strokeWidth={12} opacity={0.08} strokeLinecap="round"
              filter={`url(#${uid}-glow)`} />
            <path d={trailData.path} fill="none" stroke={`url(#${uid}-trail-outer)`}
              strokeWidth={5} strokeLinecap="round" />
            <path d={trailData.path} fill="none" stroke={`url(#${uid}-trail)`}
              strokeWidth={2.5} strokeLinecap="round" />
          </g>
        )}

        {/* Ghost balls */}
        {ghosts.map((ghost, i) => (
          <circle key={i} cx={ghost.sx} cy={ghost.sy} r={ghost.r}
            fill={GHOST_BALL_COLOR} opacity={ghost.opacity} />
        ))}

        {/* Flying ball */}
        {flyingBall && (
          <g filter={`url(#${uid}-bglow)`}>
            <circle cx={flyingBall.sx} cy={flyingBall.sy} r={flyingBall.r * 3}
              fill="white" opacity={flyingBall.intensity * 0.08} />
            <circle cx={flyingBall.sx} cy={flyingBall.sy} r={flyingBall.r * 2}
              fill="white" opacity={flyingBall.intensity * 0.14} />
            <Baseball cx={flyingBall.sx} cy={flyingBall.sy} r={flyingBall.r} uid={uid}
              rotation={ballRotation} />
          </g>
        )}

        {/* Impact flash */}
        {phase === 'landed' && (
          <rect x={0} y={0} width={SVG_W} height={SVG_H} fill="white" opacity={0}>
            <animate attributeName="opacity" from="0.2" to="0" dur="0.3s" fill="freeze" />
          </rect>
        )}

        {/* Landed ball with impact burst */}
        {landedPos && (
          <g>
            {[0, 1, 2].map(i => (
              <circle key={`burst-${i}`} cx={landedPos.sx} cy={landedPos.sy} fill="none"
                stroke={impactColor} strokeWidth={2 - i * 0.5} opacity={0}>
                <animate attributeName="r" from="6" to={28 + i * 16}
                  dur={`${0.4 + i * 0.1}s`} fill="freeze" />
                <animate attributeName="opacity" from={0.45 - i * 0.1} to="0"
                  dur={`${0.4 + i * 0.1}s`} fill="freeze" />
              </circle>
            ))}
            <circle cx={landedPos.sx} cy={landedPos.sy} r={10} fill={impactColor} opacity={0}>
              <animate attributeName="opacity" from="0.3" to="0.06" dur="0.6s" fill="freeze" />
              <animate attributeName="r" from="8" to="22" dur="0.6s" fill="freeze" />
            </circle>
            <Baseball cx={landedPos.sx} cy={landedPos.sy} r={10} uid={uid}
              number={pitch?.number} />
          </g>
        )}

        {/* Zone flash on reveal */}
        {showZone && (
          <rect x={zoneLeft} y={zoneTop} width={zone.hw * 2} height={zone.hh * 2}
            fill="white" rx={1} opacity={0}>
            <animate attributeName="opacity" from="0.25" to="0" dur="0.35s" fill="freeze" />
          </rect>
        )}
      </svg>
    </div>
  );
};
