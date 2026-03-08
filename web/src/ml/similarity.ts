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

/**
 * 매칭 결과 기반 타일 그리드 URL 생성
 *
 * Top 5 매치에 등장하는 팀들의 선수로 타일을 구성하여
 * "후보군에서 찾는 중" 스토리텔링을 강화.
 * topMatch(1위)는 중앙(index 14)에 배치.
 * 동일 matches에 대해 캐시된 결과를 재사용.
 */
let _matchTileCache: { topId: string; urls: string[] } | null = null;

export const getMatchTileUrls = (matches: MatchResult[], count = 30): string[] => {
  if (!metadata || !playerIndex || matches.length === 0) return [];

  const topId = matches[0].player.id;
  if (_matchTileCache?.topId === topId) return _matchTileCache.urls;

  // 매치에 등장하는 팀 코드 (중복 제거, 순서 유지)
  const teamCodes = [...new Set(matches.map((m) => m.player.teamCode))];
  const matchIds = new Set(matches.map((m) => m.player.id));

  // 각 팀에서 후보 선수 수집 (매치 선수 본인 제외)
  const candidates: string[] = [];
  const perTeam = Math.ceil((count - 1) / teamCodes.length);

  for (const tc of teamCodes) {
    const teamPlayers = metadata.players
      .filter((p) => p.teamCode === tc && !matchIds.has(p.id))
      .sort(() => Math.random() - 0.5)
      .slice(0, perTeam);

    for (const p of teamPlayers) {
      const url = playerIndex!.get(p.id)?.imageUrl;
      if (url) candidates.push(url);
    }
  }

  // 셔플 후 count-1개 추출, 중앙에 topMatch 삽입
  const shuffled = candidates.sort(() => Math.random() - 0.5).slice(0, count - 1);
  const centerIdx = Math.min(14, shuffled.length);
  shuffled.splice(centerIdx, 0, matches[0].player.imageUrl);

  _matchTileCache = { topId, urls: shuffled };
  return shuffled;
};

/**
 * 매칭 타일 이미지를 blob URL로 프리로드 (fire-and-forget)
 *
 * fetch → blob → URL.createObjectURL 변환 후 캐시에 덮어쓰기.
 * <img> 태그에서 blob URL을 사용하면 추가 네트워크 요청이 발생하지 않음.
 * CORS 실패 시 <link rel="preload"> 로 브라우저 캐시에 저장 후 원본 URL 반환.
 */
export const preloadMatchTileImages = (matches: MatchResult[], count = 30): void => {
  const originalUrls = getMatchTileUrls(matches, count);
  const topId = matches[0].player.id;

  Promise.all(
    originalUrls.map(async (url) => {
      try {
        const res = await fetch(url);
        const blob = await res.blob();
        return URL.createObjectURL(blob);
      } catch {
        // CORS 실패 — <link rel="preload">로 브라우저 preload cache에 저장
        const link = document.createElement('link');
        link.rel = 'preload';
        link.as = 'image';
        link.href = url;
        document.head.appendChild(link);
        return url;
      }
    }),
  ).then((blobUrls) => {
    _matchTileCache = { topId, urls: blobUrls };
  });
};
