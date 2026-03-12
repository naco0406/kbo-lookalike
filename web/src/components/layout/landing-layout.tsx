import type { FC } from 'react';
import { Outlet } from 'react-router';
import { Toaster } from '@/components/ui/sonner';

export const LandingLayout: FC = () => (
  <div className="bg-background min-h-dvh">
    <Outlet />
    <Toaster position="bottom-center" richColors closeButton />
  </div>
);
