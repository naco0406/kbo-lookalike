import type { FC } from 'react';
import { Outlet } from 'react-router';
import { Toaster } from '@/components/ui/sonner';
import { useTheme } from '@/hooks/use-theme';
import { useTeamTheme } from '@/hooks/use-team-theme';
import { useScrollToTop } from '@/hooks/use-scroll-to-top';

export const LandingLayout: FC = () => {
  useTheme();
  useTeamTheme();
  useScrollToTop();

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <Outlet />
      <Toaster position="bottom-center" richColors closeButton />
    </div>
  );
};
