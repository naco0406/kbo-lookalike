export type MbtiAxis = 'IE' | 'SN' | 'FT' | 'PJ';

export interface MbtiQuestion {
  id: number;
  axis: MbtiAxis;
  text: string;
  optionA: string;
  optionB: string;
  /** true면 A가 두 번째 성향(E/N/T/J)에 매핑됨 */
  reversed?: boolean;
}

export interface MbtiTypeInfo {
  code: string;
  name: string;
  emoji: string;
  traits: [string, string, string, string];
  description: string;
}

export interface MbtiAxisScore {
  first: number;
  second: number;
}

export interface MbtiResult {
  code: string;
  axes: Record<MbtiAxis, MbtiAxisScore>;
}

// ── Constants ────────────────────────────────────────────────────────────────

export const MBTI_SESSION_KEY = '643-mbti-result';

export const AXIS_LABELS: Record<MbtiAxis, [string, string]> = {
  IE: ['집관', '직관'],
  SN: ['팀', '선수'],
  FT: ['서사', '스탯'],
  PJ: ['타자', '투수'],
};

export const AXIS_EMOJIS: Record<MbtiAxis, [string, string]> = {
  IE: ['🏠', '⚾'],
  SN: ['🏟️', '🌟'],
  FT: ['🥹', '📊'],
  PJ: ['💥', '🎯'],
};

export const AXIS_SUBTITLES: Record<MbtiAxis, string> = {
  IE: '관람 방식',
  SN: '팬심 방향',
  FT: '야구 보는 눈',
  PJ: '경기 취향',
};

/** 바로 고르기 화면용 짧은 설명 */
export const AXIS_SHORT_DESC: Record<MbtiAxis, [string, string]> = {
  IE: ['편하게 중계로', '열심히 현장에서'],
  SN: ['팀이 먼저다', '선수가 먼저다'],
  FT: ['스토리에 감동', '데이터로 분석'],
  PJ: ['홈런이 최고', '투수전이 최고'],
};

export const AXES_ORDER: MbtiAxis[] = ['IE', 'SN', 'FT', 'PJ'];

// ── Questions (—다 체) ───────────────────────────────────────────────────────

const ALL_QUESTIONS: MbtiQuestion[] = [
  // IE 집관(I) / 직관(E)
  { id: 1, axis: 'IE', text: '오늘 우리 팀 경기가 있다.', optionA: '집에서 본다. 중계가 더 잘 보인다', optionB: '야구장 간다. 현장이 진짜다' },
  { id: 2, axis: 'IE', text: '친구한테 갑자기 "오늘 직관 갈래?" 연락이 왔다.', optionA: '귀찮다. 집에서 본다', optionB: '당연히 간다. 몇 시에 만나냐' },
  { id: 3, axis: 'IE', text: '경기에 가장 집중이 잘 되는 환경은?', optionA: '혼자 집이다. 아무도 방해 안 하는 게 최고다', optionB: '야구장이다. 함성이 있어야 제 맛이다' },
  { id: 4, axis: 'IE', text: '우리 팀이 한국시리즈에 올라갔다.', optionA: '집에서 응원하는 게 오히려 더 간절하다', optionB: '무슨 일이 있어도 현장에 가야 한다' },
  { id: 5, axis: 'IE', text: '야구 보면서 가장 짜증나는 순간은?', optionA: '직관 갔는데 앞사람이 계속 시야를 막을 때다', optionB: '집에서 보는데 중계가 끊기거나 화질이 구릴 때다', reversed: true },

  // SN 팀(S) / 선수(N)
  { id: 6, axis: 'SN', text: '가장 좋아하던 선수가 FA로 라이벌 팀에 갔다.', optionA: '배신감이 든다. 그래도 팀 응원은 계속한다', optionB: '너무 힘들다. 그 팀 경기도 챙겨 보게 된다' },
  { id: 7, axis: 'SN', text: '야구를 처음 좋아하게 된 계기는?', optionA: '우리 지역 팀이니까, 분위기에 끌렸다', optionB: '특정 선수가 너무 멋있었다' },
  { id: 8, axis: 'SN', text: '팀이 리빌딩을 선언하며 주전을 대거 방출했다.', optionA: '힘들어도 팀을 믿고 기다린다', optionB: '내 선수가 없으면 볼 맛이 안 난다' },
  { id: 9, axis: 'SN', text: '응원하는 팀의 유니폼을 산다면?', optionA: '팀 로고만 있는 기본 유니폼이다', optionB: '무조건 최애 선수 이름 마킹이다' },
  { id: 10, axis: 'SN', text: '좋아하는 선수가 방출됐다.', optionA: '속상하지만 팀의 결정이다. 팀이 먼저다', optionB: '새 팀 찾으면 거기서 응원할 수도 있다' },

  // FT 서사(F) / 스탯(T)
  { id: 11, axis: 'FT', text: '부상에서 복귀한 선수가 첫 타석에서 안타를 쳤다.', optionA: '나도 모르게 눈물이 난다', optionB: '감동적이지만 타구 속도가 더 궁금하다' },
  { id: 12, axis: 'FT', text: '"그 선수 요즘 왜 이렇게 못 해?"라는 질문에', optionA: '"슬럼프가 있는 거다. 곧 돌아온다"', optionB: '"OPS가 .680 밑으로 떨어졌다"' },
  { id: 13, axis: 'FT', text: '해설위원이 "저 선수 눈빛이 오늘 다르다"고 했다.', optionA: '맞다. 나도 느꼈다', optionB: '눈빛 말고 구속이랑 회전수를 알려 달라' },
  { id: 14, axis: 'FT', text: '레전드 선수의 은퇴식.', optionA: '함께한 기억이 떠올라 울컥한다', optionB: '통산 스탯이 뜨자 새삼 대단하다고 느낀다' },
  { id: 15, axis: 'FT', text: '우리 팀 신인이 데뷔 첫 홈런을 쳤다.', optionA: '앞으로의 스토리가 기대된다', optionB: '타구 속도랑 발사각부터 확인한다' },

  // PJ 타자(P) / 투수(J)
  { id: 16, axis: 'PJ', text: '이상적인 경기 스코어는?', optionA: '8:7. 왔다 갔다 하는 난타전이다', optionB: '1:0. 한 점으로 갈리는 투수전이다' },
  { id: 17, axis: 'PJ', text: '7회까지 0:0 팽팽한 투수전이 이어지고 있다.', optionA: '지루하다. 언제 점수가 나냐', optionB: '이것이 진짜 야구다' },
  { id: 18, axis: 'PJ', text: '경기에서 가장 심장이 터지는 순간은?', optionA: '9회말 2사 만루 역전 끝내기 홈런이다', optionB: '8회 1:0 리드, 마무리 투수가 올라올 때다' },
  { id: 19, axis: 'PJ', text: '오늘의 하이라이트를 한 장면만 고른다면?', optionA: '3점 홈런이다. 담장을 넘는 그 순간', optionB: '풀카운트 삼진이다. 구종 싸움의 결말' },
  { id: 20, axis: 'PJ', text: '친구에게 야구의 매력을 설명한다면?', optionA: '"9회말까지 모르는 거다. 역전이 있으니까"', optionB: '"투수와 타자의 두뇌 싸움이다. 결국 심리전이다"' },
];

/** 같은 축이 연속되지 않도록 인터리브 배치 */
const DISPLAY_ORDER = [0, 5, 10, 15, 6, 11, 16, 1, 12, 17, 2, 7, 18, 3, 8, 13, 4, 9, 14, 19];
export const QUESTIONS: MbtiQuestion[] = DISPLAY_ORDER.map((i) => ALL_QUESTIONS[i]);

// ── 16 Types ─────────────────────────────────────────────────────────────────

export const MBTI_TYPES: Record<string, MbtiTypeInfo> = {
  ISFP: { code: 'ISFP', name: '12번째 선수', emoji: '🔥', traits: ['집관', '팀', '서사', '타자'], description: '야구장엔 없지만 우리 팀 승리에 가장 간절한 사람이다. 혼자 집에서 역전이 나오면 소리를 지르고, 지는 경기에는 같이 무너진다. 선수들은 모르겠지만, 이 팬의 간절함은 분명 어딘가에 닿아 있다.' },
  ISFJ: { code: 'ISFJ', name: '산증인', emoji: '📖', traits: ['집관', '팀', '서사', '투수'], description: '우리 팀이 몇 년도에 어떤 선수로 우승했는지 전부 기억하고 있다. 조용하지만 팀에 대한 역사와 애정만큼은 누구에게도 지지 않는다. 신입 팬에게 팀 역사를 알려 주는 순간이 은근히 좋다.' },
  ISTP: { code: 'ISTP', name: '재야의 고수', emoji: '🎯', traits: ['집관', '팀', '스탯', '타자'], description: '커뮤니티 어딘가에서 날카로운 분석글을 올리고 있는 사람이다. 현장엔 없지만 데이터와 눈야구를 동시에 구사하며 감독의 선택을 예측한다. 틀리는 경우는 드물다.' },
  ISTJ: { code: 'ISTJ', name: '전력분석관', emoji: '📊', traits: ['집관', '팀', '스탯', '투수'], description: '우리 팀 선발 로테이션, 불펜 구성, 타선 배치까지 머릿속에 전부 들어 있다. 팀의 약점을 가장 냉정하게 파악하고 있지만, 그래도 응원은 한다. 구단이 이 사람을 고용해야 한다.' },
  INFP: { code: 'INFP', name: 'FA 난민', emoji: '💔', traits: ['집관', '선수', '서사', '타자'], description: '매년 FA 시즌이 두렵다. 내 선수가 떠나면 다음 시즌이 완전히 달라 보인다. 이적 소식에 하루 종일 멍하고, 새 팀 유니폼을 사야 하나 고민한다. 그래도 결국 또 최애가 생긴다.' },
  INFJ: { code: 'INFJ', name: '퍼스트팬', emoji: '💫', traits: ['집관', '선수', '서사', '투수'], description: '이 선수가 뜨기 전부터 알고 있었다. 데뷔 첫 경기부터 지금까지 모든 순간을 함께했다. FA로 떠나도 "처음부터 내 선수였으니까"라며 끝까지 마음속 자리를 내어 준다.' },
  INTP: { code: 'INTP', name: '스카우터', emoji: '🔬', traits: ['집관', '선수', '스탯', '타자'], description: '좋아하는 선수의 스탯을 처음 봤을 때부터 가능성을 알아봤다. 데이터로 선수를 사랑하는 타입이다. 안티가 공격하면 수치로 논파한다. 내 선수의 WAR은 항상 업데이트되어 있다.' },
  INTJ: { code: 'INTJ', name: '평론가', emoji: '🧊', traits: ['집관', '선수', '스탯', '투수'], description: '최애 선수도 부진하면 냉정하게 말할 수 있다. 감정이 없는 게 아니라, 객관이 기본값인 타입이다. 주변이 실드 칠 때 혼자 "이번 시즌 수치가 안 좋은 건 사실이다"라고 말한다.' },
  ESFP: { code: 'ESFP', name: '도파민 중독자', emoji: '🎆', traits: ['직관', '팀', '서사', '타자'], description: '역전 끝내기가 나오면 옆사람이 누구든 같이 난리가 난다. 0-0 투수전보다 7-6 난타전이 훨씬 재밌다. 야구장 가는 날이 일 년 중 가장 행복한 날이다.' },
  ESFJ: { code: 'ESFJ', name: '터줏대감', emoji: '👑', traits: ['직관', '팀', '서사', '투수'], description: '이 구장, 이 자리, 이 팀. 몇 년째 같은 자리에서 같은 팀을 응원하고 있다. 옆자리 팬들과 얼굴을 알고, 매점 직원과도 인사를 나눈다. 이 사람이 없으면 그 구역 분위기가 달라진다.' },
  ESTP: { code: 'ESTP', name: '해설위원', emoji: '🎙️', traits: ['직관', '팀', '스탯', '타자'], description: '직관 중에도 스탯 앱은 켜져 있다. 동행에게 선수 타율과 OPS를 자연스럽게 알려 준다. 본인은 도움을 준다고 생각하고, 동행은 가끔 피곤하다. 그래도 같이 가고 싶은 사람이다.' },
  ESTJ: { code: 'ESTJ', name: '자칭감독', emoji: '📣', traits: ['직관', '팀', '스탯', '투수'], description: '"지금 바꿔야 한다"를 외친 지 30초 뒤 실제로 투수가 교체되면 하루가 뿌듯하다. 감독 인터뷰보다 내 판단이 맞다고 생각한다. 틀릴 때는 조용해진다.' },
  ENFP: { code: 'ENFP', name: '옆자리 친구', emoji: '🤗', traits: ['직관', '선수', '서사', '타자'], description: '직관 가면 옆자리 모르는 사람과 금방 친해진다. 최애 선수의 홈런에 같이 일어나고, 역전에 같이 소리를 지른다. 야구장이 사람 냄새 나는 건 이런 사람 덕분이다.' },
  ENFJ: { code: 'ENFJ', name: '원정대', emoji: '🗺️', traits: ['직관', '선수', '서사', '투수'], description: '최애 선수 등판 경기 일정은 시즌 시작 전에 전부 체크해 둔다. 홈이든 원정이든, 그 선수가 던지는 날에는 야구장에 있어야 직성이 풀린다. 원정 계획을 짜는 것 자체도 즐거움이다.' },
  ENTP: { code: 'ENTP', name: '도슨트', emoji: '🎓', traits: ['직관', '선수', '스탯', '타자'], description: '최애 선수의 타격 폼과 발사각을 현장에서 해설해 준다. 데이터와 감각을 동시에 구사하는 타입이다. 옆에 있으면 경기가 한층 풍성하게 느껴진다. 혼자 볼 때도 속으로 중계를 하고 있다.' },
  ENTJ: { code: 'ENTJ', name: '불펜코치', emoji: '🫡', traits: ['직관', '선수', '스탯', '투수'], description: '최애 투수의 구종 배합을 현장에서 눈으로 검증하는 사람이다. 직관 가서도 머릿속으로 사인 교환을 예측하고, 맞으면 혼자 고개를 끄덕인다. 이 선수가 어떤 공으로 삼진을 잡을지 이미 알고 있다.' },
};

// ── Scoring ──────────────────────────────────────────────────────────────────

export const calculateMbtiResult = (answers: ('A' | 'B')[]): MbtiResult => {
  const axes: Record<MbtiAxis, MbtiAxisScore> = {
    IE: { first: 0, second: 0 },
    SN: { first: 0, second: 0 },
    FT: { first: 0, second: 0 },
    PJ: { first: 0, second: 0 },
  };

  QUESTIONS.forEach((q, i) => {
    const answer = answers[i];
    if (!answer) return;
    const isFirst = q.reversed ? answer === 'B' : answer === 'A';
    if (isFirst) axes[q.axis].first++;
    else axes[q.axis].second++;
  });

  const code = [
    axes.IE.first >= axes.IE.second ? 'I' : 'E',
    axes.SN.first >= axes.SN.second ? 'S' : 'N',
    axes.FT.first >= axes.FT.second ? 'F' : 'T',
    axes.PJ.first >= axes.PJ.second ? 'P' : 'J',
  ].join('');

  return { code, axes };
};

/** 바로 고르기 결과 계산 (각 축 100%) */
export const calculateQuickResult = (
  picks: Partial<Record<MbtiAxis, 'first' | 'second'>>,
): MbtiResult => {
  const axes: Record<MbtiAxis, MbtiAxisScore> = {
    IE: { first: 0, second: 0 },
    SN: { first: 0, second: 0 },
    FT: { first: 0, second: 0 },
    PJ: { first: 0, second: 0 },
  };

  for (const axis of AXES_ORDER) {
    const pick = picks[axis];
    if (pick === 'first') axes[axis] = { first: 5, second: 0 };
    else axes[axis] = { first: 0, second: 5 };
  }

  const code = [
    axes.IE.first > 0 ? 'I' : 'E',
    axes.SN.first > 0 ? 'S' : 'N',
    axes.FT.first > 0 ? 'F' : 'T',
    axes.PJ.first > 0 ? 'P' : 'J',
  ].join('');

  return { code, axes };
};
