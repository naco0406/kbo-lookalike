/**
 * 투구 궤적 물리 계산 및 데이터 변환 유틸리티
 *
 * PTS (Pitch Tracking System) 데이터는 Trackman급 등가속도 모델:
 *   pos(t) = pos0 + vel0·t + ½·acc·t²
 *   y축: 투수판(50ft) → 홈플레이트(≈0.7ft)
 */

// ── Types ────────────────────────────────────────────────────────────────────

export interface PtsOption {
  pitchId: string;
  inn: number;
  ballcount: number;
  crossPlateX: number;
  crossPlateY: number;
  topSz: number;
  bottomSz: number;
  x0: number;
  y0: number;
  z0: number;
  vx0: number;
  vy0: number;
  vz0: number;
  ax: number;
  ay: number;
  az: number;
  stance: 'L' | 'R';
}

export interface MetricOption {
  homeTeamWinRate: number;
  awayTeamWinRate: number;
  wpaByPlate: number;
}

export interface RawTextOption {
  seqno: number;
  type: number;
  text: string;
  speed: string | null;
  stuff: string | null;
  pitchResult: string | null;
  ptsPitchId: string | null;
  pitchNum: number | null;
  currentGameState?: Record<string, unknown>;
  batterRecord?: {
    name: string;
    pcode: string;
    pos: string;
    posName: string;
    batOrder: number;
    hitType: string;
    backnum: string;
    seasonHra: string;
    todayHra: string;
    ab: number;
    hit: number;
    hr: number;
    rbi: number;
    bb: number;
    so: number;
  };
  playerChange?: {
    type: string;
    inPlayer?: Record<string, unknown>;
    outPlayer?: Record<string, unknown>;
  };
}

export interface RawTextRelay {
  title: string;
  titleStyle?: string;
  inn: number;
  no?: number;
  homeOrAway?: string;
  statusCode?: number;
  ptsOptions?: PtsOption[];
  metricOption?: MetricOption;
  textOptions?: RawTextOption[];
}

// ── Parsed Output Types ─────────────────────────────────────────────────────

export type PitchResult = 'B' | 'S' | 'T' | 'F' | 'H';

export interface TrajectoryParams {
  x0: number; y0: number; z0: number;
  vx0: number; vy0: number; vz0: number;
  ax: number; ay: number; az: number;
  crossPlateY: number;
}

export interface ParsedPitch {
  number: number;
  type: string;        // 구종: 직구, 슬라이더, ...
  speed: number;       // km/h
  result: PitchResult;
  text: string;        // "1구 볼"
  location: { x: number; z: number } | null;
  topSz: number;
  bottomSz: number;
  trajectory: TrajectoryParams | null;
  stance: 'L' | 'R' | null;
}

export interface ParsedAtBat {
  title: string;
  batterName: string;
  batterBacknum: string;
  batterPos: string;
  batterHitType: string;   // 좌타, 우타, 양타
  seasonAvg: string;       // .321
  inning: number;
  isHome: boolean;
  pitches: ParsedPitch[];
  result: string;          // "삼진 아웃", "좌익수 앞 1루타"
  resultType: 'out' | 'hit' | 'walk' | 'other';
  wpa: number | null;      // Win Probability Added
  homeWinRate: number | null;
  awayWinRate: number | null;
  events: Array<{ type: number; text: string }>;
}

// ── Physics ─────────────────────────────────────────────────────────────────

/**
 * PTS 데이터에서 홈플레이트 통과 높이(z)를 계산한다.
 *
 * 등가속도 모델로 y(t) = crossPlateY가 되는 시간 t를 구한 뒤,
 * 그 시간에서의 z(t)를 반환.
 */
export const computePlateHeight = (pts: PtsOption): number => {
  const a = 0.5 * pts.ay;
  const b = pts.vy0;
  const c = pts.y0 - pts.crossPlateY;

  const disc = b * b - 4 * a * c;
  if (disc < 0) return (pts.topSz + pts.bottomSz) / 2;

  const sqrtDisc = Math.sqrt(disc);
  const t1 = (-b + sqrtDisc) / (2 * a);
  const t2 = (-b - sqrtDisc) / (2 * a);

  // 더 작은 양수 근 = 공이 처음으로 홈플레이트에 도달하는 시간
  const t = Math.min(
    t1 > 0 ? t1 : Infinity,
    t2 > 0 ? t2 : Infinity,
  );

  if (!isFinite(t)) return (pts.topSz + pts.bottomSz) / 2;

  const z = pts.z0 + pts.vz0 * t + 0.5 * pts.az * t * t;

  // 바운스 투구 등 극단값 클램핑 (표시 영역: 0 ~ 5ft)
  return Math.max(0, Math.min(5, z));
};

/**
 * PTS 궤적 데이터 → 릴리즈~홈플레이트 구간의 3D 좌표 배열.
 * numPoints 개의 등간격 시간 스텝으로 보간한다.
 */
export const computeTrajectoryPoints = (
  traj: TrajectoryParams,
  numPoints = 30,
): Array<{ x: number; y: number; z: number; t: number }> => {
  const a = 0.5 * traj.ay;
  const b = traj.vy0;
  const c = traj.y0 - traj.crossPlateY;

  const disc = b * b - 4 * a * c;
  if (disc < 0) return [];

  const sqrtDisc = Math.sqrt(disc);
  const t1 = (-b + sqrtDisc) / (2 * a);
  const t2 = (-b - sqrtDisc) / (2 * a);
  const tFinal = Math.min(
    t1 > 0 ? t1 : Infinity,
    t2 > 0 ? t2 : Infinity,
  );
  if (!isFinite(tFinal)) return [];

  const points = [];
  for (let i = 0; i <= numPoints; i++) {
    const t = (i / numPoints) * tFinal;
    points.push({
      x: traj.x0 + traj.vx0 * t + 0.5 * traj.ax * t * t,
      y: traj.y0 + traj.vy0 * t + 0.5 * traj.ay * t * t,
      z: traj.z0 + traj.vz0 * t + 0.5 * traj.az * t * t,
      t,
    });
  }
  return points;
};

// ── Color & Label Maps ──────────────────────────────────────────────────────

export const PITCH_RESULT_COLOR: Record<PitchResult, string> = {
  B: '#60a5fa', // blue-400
  T: '#ef4444', // red-500     (루킹 스트라이크)
  S: '#f87171', // red-400     (헛스윙)
  F: '#fb923c', // orange-400  (파울)
  H: '#4ade80', // green-400   (인플레이)
};

export const PITCH_RESULT_LABEL: Record<PitchResult, string> = {
  B: '볼',
  T: '루킹',
  S: '스윙',
  F: '파울',
  H: '타격',
};

export const PITCH_TYPE_SHORT: Record<string, string> = {
  '직구': 'FF',
  '투심': 'FT',
  '커터': 'FC',
  '슬라이더': 'SL',
  '스위퍼': 'SW',
  '커브': 'CU',
  '체인지업': 'CH',
  '포크': 'FS',
};

// ── Parsing ─────────────────────────────────────────────────────────────────

const classifyResult = (text: string): ParsedAtBat['resultType'] => {
  if (/아웃|삼진|병살|실책/.test(text)) return 'out';
  if (/안타|루타|홈런|내야안타/.test(text)) return 'hit';
  if (/볼넷|사구|몸에/.test(text)) return 'walk';
  return 'other';
};

/**
 * 원시 textRelays 배열 → 파싱된 AtBat 배열로 변환.
 * PTS 데이터를 매칭하여 투구 위치를 계산한다.
 */
export const parseAtBats = (relays: RawTextRelay[]): ParsedAtBat[] => {
  return relays
    .filter(r => r.textOptions?.some(to => to.type === 8))
    .map(relay => {
      const ptsMap = new Map(
        (relay.ptsOptions ?? []).map(p => [p.pitchId, p]),
      );

      const batterIntro = relay.textOptions?.find(to => to.type === 8);
      const br = batterIntro?.batterRecord;
      const resultEvent = relay.textOptions?.find(
        to => to.type === 13 || to.type === 23,
      );

      const pitches: ParsedPitch[] = (relay.textOptions ?? [])
        .filter(to => to.type === 1 && to.pitchResult)
        .map((to, i) => {
          const pts = to.ptsPitchId ? ptsMap.get(to.ptsPitchId) : null;
          let location: { x: number; z: number } | null = null;
          let trajectory: TrajectoryParams | null = null;

          if (pts) {
            location = {
              x: pts.crossPlateX,
              z: computePlateHeight(pts),
            };
            trajectory = {
              x0: pts.x0, y0: pts.y0, z0: pts.z0,
              vx0: pts.vx0, vy0: pts.vy0, vz0: pts.vz0,
              ax: pts.ax, ay: pts.ay, az: pts.az,
              crossPlateY: pts.crossPlateY,
            };
          }

          return {
            number: i + 1,
            type: to.stuff ?? '',
            speed: Number(to.speed) || 0,
            result: to.pitchResult as PitchResult,
            text: to.text,
            location,
            topSz: pts?.topSz ?? 3.4,
            bottomSz: pts?.bottomSz ?? 1.6,
            trajectory,
            stance: pts?.stance ?? null,
          };
        });

      const rawHra = br?.seasonHra;
      const avgStr = rawHra != null
        ? (Number(rawHra) >= 1 ? String(rawHra) : `.${String(rawHra).replace('0.', '').replace('.', '')}`)
        : '';

      return {
        title: relay.title,
        batterName: br?.name ?? relay.title.replace(/^\d+번타자\s*/, ''),
        batterBacknum: br?.backnum ?? '',
        batterPos: br?.posName ?? '',
        batterHitType: br?.hitType ?? '',
        seasonAvg: avgStr,
        inning: relay.inn,
        isHome: relay.homeOrAway === '1',
        pitches,
        result: resultEvent?.text ?? '',
        resultType: classifyResult(resultEvent?.text ?? ''),
        wpa: relay.metricOption?.wpaByPlate ?? null,
        homeWinRate: relay.metricOption?.homeTeamWinRate ?? null,
        awayWinRate: relay.metricOption?.awayTeamWinRate ?? null,
        events: (relay.textOptions ?? [])
          .filter(to => ![1, 8].includes(to.type))
          .map(to => ({ type: to.type, text: to.text })),
      };
    });
};
