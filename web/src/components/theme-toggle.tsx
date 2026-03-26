import type { FC } from 'react';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from '@/hooks/use-theme';
import { cn } from '@/lib/utils';

export const ThemeToggle: FC<{ className?: string }> = ({ className }) => {
  const { theme, toggle } = useTheme();
  const isDark = theme === 'dark';

  return (
    <button
      onClick={toggle}
      className={cn(
        'relative flex h-11 w-11 items-center justify-center rounded-full',
        'text-muted-foreground transition-colors hover:text-foreground active:scale-90',
        className,
      )}
      aria-label={isDark ? '라이트 모드로 전환' : '다크 모드로 전환'}
    >
      <Sun
        className={cn(
          'h-4 w-4 transition-all duration-200',
          isDark ? 'rotate-90 scale-0 opacity-0' : 'rotate-0 scale-100 opacity-100',
        )}
        style={{ position: isDark ? 'absolute' : 'static' }}
      />
      <Moon
        className={cn(
          'h-4 w-4 transition-all duration-200',
          isDark ? 'rotate-0 scale-100 opacity-100' : '-rotate-90 scale-0 opacity-0',
        )}
        style={{ position: isDark ? 'static' : 'absolute' }}
      />
    </button>
  );
};
