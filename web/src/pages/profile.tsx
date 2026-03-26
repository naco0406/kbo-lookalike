import type { FC } from 'react';
import { useRef, useCallback } from 'react';
import { Link } from 'react-router';
import { ChevronLeft, User, Sun, Moon, Camera } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useProfile } from '@/hooks/use-profile';
import { useTheme } from '@/hooks/use-theme';
import { processAvatarFile } from '@/lib/avatar';
import { TEAM_COLORS, TEAM_ORDER } from '@/constants/analysis-messages';

// ── Avatar ───────────────────────────────────────────────────────────────────

const AvatarSection: FC<{
  avatarUrl: string | null;
  onAvatarChange: (url: string | null) => void;
}> = ({ avatarUrl, onAvatarChange }) => {
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        const dataUrl = await processAvatarFile(file);
        onAvatarChange(dataUrl);
      } catch {
        toast.error('이미지를 처리할 수 없습니다');
      }
      if (e.target) e.target.value = '';
    },
    [onAvatarChange],
  );

  return (
    <div className="flex flex-col items-center gap-3">
      <button
        onClick={() => fileRef.current?.click()}
        className="group relative h-24 w-24 overflow-hidden rounded-full transition-transform active:scale-95"
      >
        {avatarUrl ? (
          <img src={avatarUrl} alt="프로필" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-muted">
            <User className="h-8 w-8 text-muted-foreground/40" />
          </div>
        )}
        {/* 호버/탭 오버레이 */}
        <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/30 group-active:bg-black/30">
          <Camera className="h-5 w-5 text-white opacity-0 transition-opacity group-hover:opacity-100 group-active:opacity-100" />
        </div>
      </button>

      <div className="flex items-center gap-3">
        <button
          onClick={() => fileRef.current?.click()}
          className="text-[12px] text-muted-foreground transition-colors active:text-foreground"
        >
          {avatarUrl ? '변경' : '사진 추가'}
        </button>
        {avatarUrl && (
          <>
            <span className="text-[10px] text-muted-foreground/20">|</span>
            <button
              onClick={() => onAvatarChange(null)}
              className="text-[12px] text-muted-foreground/50 transition-colors active:text-destructive"
            >
              삭제
            </button>
          </>
        )}
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        onChange={handleFile}
        className="hidden"
      />
    </div>
  );
};

// ── Nickname ─────────────────────────────────────────────────────────────────

const NicknameSection: FC<{
  value: string;
  onChange: (v: string) => void;
}> = ({ value, onChange }) => {
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange(e.target.value.slice(0, 12));
    },
    [onChange],
  );

  return (
    <section>
      <h3 className="mb-2.5 text-[13px] font-semibold">닉네임</h3>
      <input
        type="text"
        value={value}
        onChange={handleChange}
        placeholder="닉네임을 입력하세요"
        maxLength={12}
        className="h-12 w-full rounded-2xl border border-border bg-card px-4 text-[15px] outline-none transition-colors placeholder:text-muted-foreground/40 focus:border-foreground/30"
      />
      <p className="mt-1.5 text-right text-[11px] text-muted-foreground/40">
        {value.length}/12
      </p>
    </section>
  );
};

// ── Team Selector ────────────────────────────────────────────────────────────

const TeamSelector: FC<{
  selected: string | null;
  onSelect: (teamCode: string | null) => void;
}> = ({ selected, onSelect }) => (
  <section>
    <h3 className="mb-2.5 text-[13px] font-semibold">응원 팀</h3>
    <div className="grid grid-cols-5 gap-2">
      {TEAM_ORDER.map((code) => {
        const team = TEAM_COLORS[code];
        const isSelected = selected === code;
        return (
          <button
            key={code}
            onClick={() => onSelect(isSelected ? null : code)}
            className={cn(
              'flex flex-col items-center gap-1.5 rounded-2xl py-3 transition-all active:scale-95',
              isSelected
                ? 'bg-card shadow-sm'
                : 'bg-transparent hover:bg-card/60',
            )}
            style={isSelected ? { boxShadow: `0 0 0 2px ${team.primary}` } : undefined}
          >
            <div
              className={cn(
                'flex h-10 w-10 items-center justify-center rounded-full text-[10px] font-extrabold text-white transition-all',
                !isSelected && 'opacity-50 grayscale-[0.3]',
              )}
              style={{ backgroundColor: team.primary }}
            >
              {team.shortName}
            </div>
            <span
              className={cn(
                'text-[11px] transition-colors',
                isSelected ? 'font-semibold text-foreground' : 'text-muted-foreground',
              )}
            >
              {team.shortName}
            </span>
          </button>
        );
      })}
    </div>
  </section>
);

// ── Theme Selector ───────────────────────────────────────────────────────────

const ThemeSelector: FC = () => {
  const { theme, setTheme } = useTheme();

  return (
    <section>
      <h3 className="mb-2.5 text-[13px] font-semibold">화면 모드</h3>
      <div className="flex gap-2">
        {([
          { value: 'light' as const, icon: Sun, label: '라이트' },
          { value: 'dark' as const, icon: Moon, label: '다크' },
        ]).map(({ value, icon: Icon, label }) => {
          const active = theme === value;
          return (
            <button
              key={value}
              onClick={() => setTheme(value)}
              className={cn(
                'flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl text-[14px] font-medium transition-all active:scale-[0.97]',
                active
                  ? 'bg-foreground text-background shadow-sm'
                  : 'bg-card text-muted-foreground hover:text-foreground',
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          );
        })}
      </div>
    </section>
  );
};

// ── Page ─────────────────────────────────────────────────────────────────────

export const ProfilePage: FC = () => {
  const { profile, setNickname, setFavoriteTeam, setAvatar } = useProfile();

  return (
    <div className="flex min-h-dvh flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/90 backdrop-blur-lg">
        <div className="mx-auto flex h-12 max-w-md items-center px-5">
          <Link
            to="/"
            viewTransition
            className="flex items-center gap-1 text-[13px] text-muted-foreground transition-all hover:text-foreground active:opacity-60"
          >
            <ChevronLeft className="h-4 w-4" />
            <span>홈</span>
          </Link>
          <span className="absolute left-1/2 -translate-x-1/2 text-sm font-bold tracking-tight opacity-60">
            프로필
          </span>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto w-full max-w-md flex-1 px-5 pb-16">
        {/* Avatar */}
        <div className="mt-8 mb-10">
          <AvatarSection avatarUrl={profile.avatarUrl} onAvatarChange={setAvatar} />
        </div>

        {/* Sections */}
        <div className="flex flex-col gap-8">
          <NicknameSection value={profile.nickname} onChange={setNickname} />
          <TeamSelector selected={profile.favoriteTeam} onSelect={setFavoriteTeam} />
          <ThemeSelector />
        </div>

        {/* Server sync notice */}
        <p className="mt-12 text-center text-[11px] leading-relaxed text-muted-foreground/40">
          추후 업데이트를 통해 계정 연동이 지원될 예정이에요
        </p>
      </main>
    </div>
  );
};
