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
  nickname: string;
  onAvatarChange: (url: string | null) => void;
}> = ({ avatarUrl, nickname, onAvatarChange }) => {
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
    <div className="flex flex-col items-center">
      <button
        onClick={() => fileRef.current?.click()}
        className="group relative h-28 w-28 overflow-hidden rounded-full shadow-lg ring-2 ring-border transition-transform active:scale-95"
      >
        {avatarUrl ? (
          <img src={avatarUrl} alt="프로필" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-muted">
            <User className="h-10 w-10 text-muted-foreground/30" />
          </div>
        )}
        <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-active:bg-black/30">
          <Camera className="h-5 w-5 text-white opacity-0 transition-opacity group-active:opacity-100" />
        </div>
      </button>

      {/* 이름 or 안내 */}
      {nickname ? (
        <p className="mt-4 text-[17px] font-bold">{nickname}</p>
      ) : (
        <p className="mt-4 text-[14px] text-muted-foreground/50">이름을 설정해주세요</p>
      )}

      {/* 사진 액션 */}
      <div className="mt-2 flex items-center gap-2.5">
        <button
          onClick={() => fileRef.current?.click()}
          className="text-[12px] font-medium text-muted-foreground transition-colors active:text-foreground"
        >
          {avatarUrl ? '사진 변경' : '사진 추가'}
        </button>
        {avatarUrl && (
          <>
            <span className="text-[10px] text-border">·</span>
            <button
              onClick={() => onAvatarChange(null)}
              className="text-[12px] text-muted-foreground/40 transition-colors active:text-destructive"
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
      <h3 className="mb-2.5 text-[13px] font-semibold tracking-tight">닉네임</h3>
      <div className="relative">
        <input
          type="text"
          value={value}
          onChange={handleChange}
          placeholder="닉네임을 입력하세요"
          maxLength={12}
          className="h-12 w-full rounded-2xl border border-border bg-card px-4 pr-14 text-[15px] outline-none transition-colors placeholder:text-muted-foreground/30 focus:border-foreground/20 focus:ring-1 focus:ring-foreground/10"
        />
        <span className="absolute top-1/2 right-4 -translate-y-1/2 text-[11px] tabular-nums text-muted-foreground/30">
          {value.length}/12
        </span>
      </div>
    </section>
  );
};

// ── Team Selector ────────────────────────────────────────────────────────────

const TeamSelector: FC<{
  selected: string | null;
  onSelect: (teamCode: string | null) => void;
}> = ({ selected, onSelect }) => (
  <section>
    <h3 className="mb-2.5 text-[13px] font-semibold tracking-tight">응원 팀</h3>
    <div className="grid grid-cols-5 gap-1.5">
      {TEAM_ORDER.map((code) => {
        const team = TEAM_COLORS[code];
        const isSelected = selected === code;
        return (
          <button
            key={code}
            onClick={() => onSelect(isSelected ? null : code)}
            className={cn(
              'flex flex-col items-center gap-1.5 rounded-xl py-2.5 transition-all active:scale-95',
              isSelected ? 'bg-card' : 'bg-transparent',
            )}
            style={isSelected ? { boxShadow: `inset 0 0 0 2px ${team.primary}` } : undefined}
          >
            <div
              className={cn(
                'flex h-11 w-11 items-center justify-center rounded-full text-[10px] font-extrabold text-white transition-all',
                isSelected ? 'scale-110 shadow-md' : 'opacity-40',
              )}
              style={{ backgroundColor: team.primary }}
            >
              {team.shortName}
            </div>
            <span
              className={cn(
                'text-[10px] transition-colors',
                isSelected ? 'font-bold text-foreground' : 'text-muted-foreground/60',
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
      <h3 className="mb-2.5 text-[13px] font-semibold tracking-tight">화면 모드</h3>
      <div className="flex gap-2 rounded-2xl bg-card p-1">
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
                'flex h-11 flex-1 items-center justify-center gap-2 rounded-xl text-[13px] font-medium transition-all active:scale-[0.97]',
                active
                  ? 'bg-foreground text-background shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
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
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-md items-center px-5">
          <Link
            to="/"
            viewTransition
            className="flex items-center gap-1 text-[13px] text-muted-foreground transition-all hover:text-foreground active:opacity-60"
          >
            <ChevronLeft className="h-4 w-4" />
            <span>홈</span>
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto w-full max-w-md flex-1 px-5 pb-16">
        {/* Avatar */}
        <div className="mt-6 mb-10">
          <AvatarSection
            avatarUrl={profile.avatarUrl}
            nickname={profile.nickname}
            onAvatarChange={setAvatar}
          />
        </div>

        {/* Sections */}
        <div className="flex flex-col gap-8">
          <NicknameSection value={profile.nickname} onChange={setNickname} />
          <TeamSelector selected={profile.favoriteTeam} onSelect={setFavoriteTeam} />
          <ThemeSelector />
        </div>

        {/* Server sync notice */}
        <p className="mt-16 text-center text-[11px] leading-relaxed text-muted-foreground/30">
          추후 업데이트를 통해 계정 연동이 지원될 예정이에요
        </p>
      </main>
    </div>
  );
};
