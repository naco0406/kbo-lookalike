import type { FC } from 'react';
import { Outlet, Link, useLocation } from 'react-router';
import { AppStateProvider } from '@/context/app-state-context';
import { Toaster } from '@/components/ui/sonner';

export const Layout: FC = () => {
  const { pathname } = useLocation();
  const isHome = pathname === '/';

  return (
    <AppStateProvider>
      <div className="bg-background flex min-h-dvh flex-col">
        {/* 헤더: 홈에서는 투명, 결과에서는 glass 효과 */}
        <header className="absolute inset-x-0 top-0 z-50">
          <div className="container mx-auto flex h-12 items-center justify-center px-5">
            <Link
              to="/"
              className="text-sm font-bold tracking-tight opacity-60 transition-opacity hover:opacity-100"
            >
              KBO 닮은꼴
            </Link>
          </div>
        </header>

        {/* 메인: 홈은 수직 중앙 정렬 */}
        <main className={isHome ? 'flex flex-1 flex-col' : 'flex-1 pt-12'}>
          <Outlet />
        </main>

        <Toaster position="bottom-center" richColors closeButton />
      </div>
    </AppStateProvider>
  );
};
