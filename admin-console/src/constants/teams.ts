export const TEAM_COLORS: Record<string, { primary: string; name: string; shortName: string }> = {
  LG: { primary: '#C60C30', name: 'LG 트윈스', shortName: 'LG' },
  SK: { primary: '#CE0E2D', name: 'SSG 랜더스', shortName: 'SSG' },
  LT: { primary: '#002B5C', name: '롯데 자이언츠', shortName: '롯데' },
  HT: { primary: '#EA0029', name: 'KIA 타이거즈', shortName: 'KIA' },
  SS: { primary: '#074CA1', name: '삼성 라이온즈', shortName: '삼성' },
  NC: { primary: '#315288', name: 'NC 다이노스', shortName: 'NC' },
  WO: { primary: '#820024', name: '키움 히어로즈', shortName: '키움' },
  HH: { primary: '#FF6600', name: '한화 이글스', shortName: '한화' },
  KT: { primary: '#000000', name: 'KT WIZ', shortName: 'KT' },
  OB: { primary: '#131230', name: '두산 베어스', shortName: '두산' },
};

export const STATUS_LABELS: Record<string, string> = {
  upcoming: '예정',
  live: '진행중',
  completed: '종료',
  cancelled: '취소',
  suspended: '중단',
};
