// ── Stage별 랜덤 메시지 ──

export const STAGE_MESSAGES = {
  faceDetection: [
    '얼굴을 찾고 있어요...',
    '어디 한번 볼까요...',
    '관상을 살펴보는 중...',
    '좋은 사진이네요, 분석해볼게요',
    '흠, 좋은 인상이네요',
    '야구인의 기운이 느껴지는데요?',
  ],
  aiAnalysis: [
    '당신의 야구 관상을 분석 중...',
    '얼굴에서 512개의 특징을 추출하는 중...',
    'AI가 당신의 얼굴을 읽고 있어요...',
    '야구인의 눈빛이 보이는 것 같기도...',
    '특징점이 하나둘 포착되고 있어요',
    '흥미로운 얼굴이네요, 잠시만요',
  ],
  positionClassify: [
    '타석에 설 상인지, 마운드에 오를 상인지...',
    '투수의 눈매인가, 타자의 눈매인가...',
    '포지션 적성을 감별하는 중...',
    '직구를 던질 상인가, 홈런을 칠 상인가...',
    '스트라이크존을 보는 눈이 예사롭지 않은데...',
    '이 눈빛... 에이스의 기운이?',
  ],
  teamClassify: [
    '어떤 유니폼이 어울릴지 보는 중...',
    '당신의 야구 DNA를 분석하는 중...',
    '소속 구단을 찾고 있어요...',
    '어울리는 유니폼이 보이기 시작했어요',
    '어떤 팀 모자가 어울릴까요...',
    '운명의 구단을 찾는 중...',
  ],
} as const;

export const NOT_BASEBALL_FACE_MESSAGES = [
  '음... 야구보다는 다른 분야가 어울리실지도?',
  '야구 관상은 아니지만, 매력은 충분해요!',
  '야구선수 상은 아닌 것 같지만...',
] as const;

export const NOT_BASEBALL_FACE_CONTINUE = '그래도 가장 닮은 선수를 찾아볼게요!';

// ── 팀 컬러 매핑 ──
// key: 레거시 DB 코드 (SK, OB, HT 등) → shortName: 현재 공식 약자

export const TEAM_COLORS: Record<string, { primary: string; bg: string; name: string; shortName: string }> = {
  LG: { primary: '#C60C30', bg: '#C60C30', name: 'LG 트윈스', shortName: 'LG' },
  SK: { primary: '#CE0E2D', bg: '#CE0E2D', name: 'SSG 랜더스', shortName: 'SSG' },
  LT: { primary: '#002B5C', bg: '#002B5C', name: '롯데 자이언츠', shortName: '롯데' },
  HT: { primary: '#EA0029', bg: '#EA0029', name: 'KIA 타이거즈', shortName: 'KIA' },
  SS: { primary: '#074CA1', bg: '#074CA1', name: '삼성 라이온즈', shortName: '삼성' },
  NC: { primary: '#315288', bg: '#315288', name: 'NC 다이노스', shortName: 'NC' },
  WO: { primary: '#820024', bg: '#820024', name: '키움 히어로즈', shortName: '키움' },
  HH: { primary: '#FF6600', bg: '#FF6600', name: '한화 이글스', shortName: '한화' },
  KT: { primary: '#000000', bg: '#000000', name: 'KT WIZ', shortName: 'KT' },
  OB: { primary: '#131230', bg: '#131230', name: '두산 베어스', shortName: '두산' },
};

/** 레거시 DB teamCode → 현재 공식 팀 풀네임 */
export const getTeamDisplayName = (teamCode: string): string =>
  TEAM_COLORS[teamCode]?.name ?? teamCode;

/** 레거시 DB teamCode → 현재 공식 약자 */
export const getTeamShortName = (teamCode: string): string =>
  TEAM_COLORS[teamCode]?.shortName ?? teamCode;

// ── 팀 순서 (원형 배치용) ──
export const TEAM_ORDER = ['LG', 'SK', 'LT', 'HT', 'SS', 'NC', 'WO', 'HH', 'KT', 'OB'] as const;

// ── 유틸: 랜덤 메시지 선택 ──
export const pickRandom = <T>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)];
