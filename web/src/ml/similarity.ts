import type {
  Player,
  PlayerMetadata,
  GalleryEmbeddings,
  MatchResult,
  PositionClassification,
  TeamClassification,
} from '@/types/player';
import { assetUrl } from './asset-url';
import { getTeamDisplayName } from '@/constants/analysis-messages';

let metadata: PlayerMetadata | null = null;
let embeddingMatrix: Float32Array[][] | null = null;
let playerIndex: Map<string, Player> | null = null;
let _loadPromise: Promise<{ count: number }> | null = null;

export const loadPlayerData = async (): Promise<{ count: number }> => {
  if (metadata && embeddingMatrix) {
    return { count: metadata.count };
  }

  // 이미 로딩 중인 프라미스가 있으면 재사용 (중복 fetch 방지)
  if (_loadPromise) return _loadPromise;

  _loadPromise = (async () => {
    const [metaRes, embRes] = await Promise.all([
      fetch(assetUrl('/data/player_metadata.json')),
      fetch(assetUrl('/data/player_embeddings_gallery.json')),
    ]);

    metadata = (await metaRes.json()) as PlayerMetadata;
    const gallery = (await embRes.json()) as GalleryEmbeddings;

    // 이미지 URL을 R2 절대 경로로 변환
    playerIndex = new Map(
      metadata.players.map((p) => [p.id, { ...p, imageUrl: assetUrl(p.imageUrl) }]),
    );

    // 선수별 임베딩 배열 (복수) — 갤러리 포맷
    embeddingMatrix = metadata.players.map((p) => {
      const entry = gallery.players[p.id];
      return entry ? entry.embeddings.map((e) => new Float32Array(e)) : [];
    });

    return { count: metadata.count };
  })().catch((e) => {
    _loadPromise = null; // 실패 시 재시도 허용
    throw e;
  });

  return _loadPromise;
};

/**
 * 선형 스트레칭: raw + 0.25 오프셋, clamp [0.30, 0.99]
 * cosine 0.30→55%, 0.40→65%, 0.50→75%, 0.55→80%, 0.60→85%, 0.70→95%
 * 자연스러운 상대 격차가 그대로 보존됨
 */
const stretchScore = (raw: number): number =>
  Math.max(0.30, Math.min(0.99, raw + 0.25));

/**
 * 순수 코사인 유사도 기반 Top K 검색 (보너스 없음)
 * bonusBreakdown.cosine에 원본 코사인 유사도 보존
 */
export const findTopMatches = (
  queryEmbedding: Float32Array,
  topK = 5,
): MatchResult[] => {
  if (!metadata || !embeddingMatrix || !playerIndex) {
    throw new Error('Player data not loaded');
  }

  const scores: Array<{ idx: number; sim: number; cosine: number }> = [];

  for (let i = 0; i < embeddingMatrix.length; i++) {
    const embeddings = embeddingMatrix[i];
    if (embeddings.length === 0) continue;

    // 선수의 여러 임베딩 중 최대 유사도를 대표값으로 사용
    let maxSim = -Infinity;
    for (const db of embeddings) {
      let dot = 0;
      for (let j = 0; j < db.length; j++) {
        dot += queryEmbedding[j] * db[j];
      }
      if (dot > maxSim) maxSim = dot;
    }

    scores.push({
      idx: i,
      sim: stretchScore(maxSim),
      cosine: maxSim,
    });
  }

  scores.sort((a, b) => b.sim - a.sim);

  return scores.slice(0, topK).map((s) => {
    const original = metadata!.players[s.idx];
    return {
      player: playerIndex!.get(original.id) ?? original,
      similarity: s.sim,
      bonusBreakdown: { cosine: s.cosine, positionBonus: 0, teamBonus: 0 },
    };
  });
};

/**
 * 상위 N명의 매치 결과에서 포지션/팀 분류를 역산
 *
 * 핵심 규칙: top1 매치의 포지션/팀이 반드시 1위로 표시
 * → 중간 단계에서 보여주는 포지션/팀이 최종 결과와 일맥상통하게 보장
 * 나머지 순위는 top N 집계 기반, 수치는 참고용
 */
export const deriveClassificationFromMatches = (
  matches: MatchResult[],
): { position: PositionClassification; team: TeamClassification } => {
  const total = matches.length || 1;
  const top1 = matches[0];

  // ── 포지션: top1의 포지션이 반드시 승리 ──
  const top1Pos = (top1?.player.position === '투수' ? '투수' : '타자') as '투수' | '타자';
  const otherPos = top1Pos === '투수' ? '타자' : '투수';

  let top1PosCount = 0;
  for (const m of matches) {
    if ((m.player.position === '투수' ? '투수' : '타자') === top1Pos) top1PosCount++;
  }

  // top1 포지션이 소수파여도 최소 55%로 표시 (속여서 보여주기)
  const posConfidence = Math.max(top1PosCount / total, 0.55);
  const posScores: Record<string, number> = {
    [top1Pos]: posConfidence,
    [otherPos]: 1 - posConfidence,
  };

  // ── 팀: top1의 팀이 반드시 1위 ──
  const top1TeamCode = top1?.player.teamCode ?? '';
  const teamCount: Record<string, { count: number; name: string }> = {};
  for (const m of matches) {
    const tc = m.player.teamCode;
    if (!teamCount[tc]) teamCount[tc] = { count: 0, name: getTeamDisplayName(tc) };
    teamCount[tc].count++;
  }

  // top1 팀을 무조건 1위로 정렬, 나머지는 집계 순
  const sortedTeams = Object.entries(teamCount)
    .sort((a, b) => {
      if (a[0] === top1TeamCode) return -1;
      if (b[0] === top1TeamCode) return 1;
      return b[1].count - a[1].count;
    })
    .slice(0, 3)
    .map(([teamCode, data]) => ({
      teamCode,
      name: data.name,
      similarity: data.count / total,
    }));

  const teamScores: Record<string, number> = {};
  for (const [tc, data] of Object.entries(teamCount)) {
    teamScores[tc] = data.count / total;
  }

  return {
    position: {
      position: top1Pos,
      confidence: posConfidence,
      scores: posScores,
    },
    team: {
      topTeams: sortedTeams,
      scores: teamScores,
    },
  };
};

export const isDataLoaded = (): boolean => {
  return metadata !== null && embeddingMatrix !== null;
};

/** 프리로드된 샘플 URL 캐시 */
let _cachedSampleUrls: string[] | null = null;

/** 매칭 스테이지 타일 그리드용 랜덤 선수 이미지 URL 추출 (캐시 재사용) */
export const getSamplePlayerImageUrls = (count = 30): string[] => {
  if (_cachedSampleUrls && _cachedSampleUrls.length >= count) return _cachedSampleUrls.slice(0, count);
  if (!metadata || !playerIndex) return [];
  const shuffled = [...metadata.players].sort(() => Math.random() - 0.5);
  _cachedSampleUrls = shuffled.slice(0, count).map((p) => playerIndex!.get(p.id)?.imageUrl ?? '').filter(Boolean);
  return _cachedSampleUrls;
};

/** 샘플 선수 이미지를 브라우저 캐시에 프리로드 (fire-and-forget) */
export const preloadSamplePlayerImages = (count = 30): void => {
  const urls = getSamplePlayerImageUrls(count);
  for (const url of urls) {
    const img = new Image();
    img.src = url;
  }
};
