/**
 * 카카오 애드핏 광고 슬롯 설정
 * https://adfit.kakao.com → 광고 단위 관리
 */

export const AD_SLOTS = {
  /** 홈 화면 — 기능 카드 2×2 그리드 하단, 페이지 최하단 직전 */
  home: {
    type: '300x250' as const,
    unitId: 'DAN-jung8W8UEoQT3SQK',
  },

  /** 경기 일정 — 캘린더와 경기 목록 사이 */
  schedule: {
    type: '320x100' as const,
    unitId: 'DAN-KEHPPvPZHA8JqUfp',
  },

  /** 닮은꼴 결과 — 액션 버튼과 Top 5 리스트 사이 */
  lookalikeResult: {
    type: '300x250' as const,
    unitId: 'DAN-D1i9WhtCvH1Msc5R',
  },

  /** 스트라이크 콜 결과 — 등급 카드 직후, 상세 통계 위 */
  umpireResult: {
    type: '300x250' as const,
    unitId: 'DAN-5p1p8wrzctphzq5R',
  },
} as const;
