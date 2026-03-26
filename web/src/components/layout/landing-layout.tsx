import type { FC } from 'react';
import { Outlet } from 'react-router';
import { Toaster } from '@/components/ui/sonner';
import { useTheme } from '@/hooks/use-theme';

export const LandingLayout: FC = () => {
  // Initialize theme on mount (applies .dark class to <html>)
  useTheme();

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <Outlet />
      <Toaster position="bottom-center" richColors closeButton />
    </div>
  );
};
