import { useEffect } from 'react';
import { useProfile } from './use-profile';
import { useTheme } from './use-theme';
import { TEAM_COLORS } from '@/constants/analysis-messages';

// ── Design Principles ──
//
// 1. 캔버스는 중립 — card, foreground, muted-foreground, border는 건드리지 않는다.
//    콘텐츠 가독성이 최우선.
// 2. 팀 컬러는 인터랙션에 집중 — accent, ring에 팀 컬러를 원색(또는 밝은 변형)으로
//    풀 채도로 넣는다. 버튼, 뱃지, 프로그레스, 링크 등 "누르는/강조하는" 곳.
// 3. 분위기는 background 한 곳 — 배경에만 낮은 채도(S:20, L 미세 조정)로
//    팀 hue를 깔아서 "다른 공간" 인상을 준다. 나머지 surface는 neutral.
// 4. 텍스트 가독성은 절대 — foreground, card-foreground, muted-foreground는
//    항상 neutral. 팀 색으로 물들이지 않는다.

// ── HSL utilities ──

const hexToHsl = (hex: string): [number, number, number] => {
  const c = hex.replace('#', '');
  let r = parseInt(c.slice(0, 2), 16) / 255;
  let g = parseInt(c.slice(2, 4), 16) / 255;
  let b = parseInt(c.slice(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }

  return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
};

const hslToHex = (h: number, s: number, l: number): string => {
  s = Math.max(0, Math.min(100, s)) / 100;
  l = Math.max(0, Math.min(100, l)) / 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
};

// ── Palette generation ──

// accent: 다크모드에서 가독성을 위해 L을 55~60으로 올리되, 채도는 최대한 유지
const brightAccent = (h: number, s: number): string =>
  hslToHex(h, Math.max(s, 80), 58);

// accent: 라이트모드에서는 원색에 가깝게, 살짝 어둡게만
const boldAccent = (h: number, s: number): string =>
  hslToHex(h, Math.max(s, 80), 44);

// 오버라이드하는 CSS 변수 목록 (제거 시에도 사용)
const OVERRIDE_VARS = [
  '--background',
  '--accent',
  '--accent-foreground',
  '--ring',
  '--chart-1',
  '--stadium-green',
] as const;

/**
 * 응원팀이 설정되어 있으면:
 * - accent/ring/chart-1/stadium-green → 팀 컬러 (원색, 쨍하게)
 * - background → 팀 hue 아주 살짝 (분위기만)
 * - 나머지 (card, border, text 등) → 건드리지 않음 (neutral 유지)
 */
export const useTeamTheme = () => {
  const { profile } = useProfile();
  const { theme } = useTheme();
  const teamCode = profile.favoriteTeam;

  useEffect(() => {
    const root = document.documentElement;
    const team = teamCode ? TEAM_COLORS[teamCode] : null;

    if (!team) {
      for (const v of OVERRIDE_VARS) root.style.removeProperty(v);
      return;
    }

    const [h, s] = hexToHsl(team.primary);
    const [secH, secS] = hexToHsl(team.secondary);

    // 저채도 팀(KT 블랙): accent에 secondary 사용
    const isNeutral = s < 15;
    const acH = isNeutral ? secH : h;
    const acS = isNeutral ? secS : s;

    if (theme === 'dark') {
      // 배경: 팀 hue를 아주 살짝만 (S:20 고정, L:7)
      // neutral 팀은 그냥 기본 다크 배경 유지
      const bg = isNeutral ? '#0f1923' : hslToHex(h, 20, 7);
      const accent = brightAccent(acH, acS);

      root.style.setProperty('--background', bg);
      root.style.setProperty('--accent', accent);
      root.style.setProperty('--accent-foreground', '#ffffff');
      root.style.setProperty('--ring', accent);
      root.style.setProperty('--chart-1', accent);
      root.style.setProperty('--stadium-green', accent);
    } else {
      // 배경: 팀 hue를 아주 살짝만 (S:15 고정, L:96)
      const bg = isNeutral ? '#f7f5f0' : hslToHex(h, 15, 96);
      const accent = boldAccent(acH, acS);

      root.style.setProperty('--background', bg);
      root.style.setProperty('--accent', accent);
      root.style.setProperty('--accent-foreground', '#ffffff');
      root.style.setProperty('--ring', accent);
      root.style.setProperty('--chart-1', accent);
      root.style.setProperty('--stadium-green', accent);
    }

    // theme-color meta
    const bg = root.style.getPropertyValue('--background');
    document.querySelectorAll('meta[name="theme-color"]').forEach((meta) => {
      meta.setAttribute('content', bg);
    });
  }, [teamCode, theme]);
};
