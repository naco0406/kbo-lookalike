import type { FC } from 'react';
import { useEffect } from 'react';
import { Outlet, Link, useLocation } from 'react-router';
import { ChevronLeft } from 'lucide-react';
import { AppStateProvider } from '@/context/app-state-context';
import { Toaster } from '@/components/ui/sonner';
import { startPreload } from '@/ml/preload';

export const Layout: FC = () => {
  const { pathname } = useLocation();

  // /lookalike 진입 시 ONNX 모델 + 임베딩 프리로드 시작
  useEffect(() => {
    startPreload();
  }, []);
  const isLookalike = pathname === '/lookalike';

  return (
    <AppStateProvider>
      <div className="bg-background flex min-h-dvh flex-col">
        <header className="absolute inset-x-0 top-0 z-50">
          <div className="container mx-auto flex h-12 max-w-md items-center px-5">
            {/* Back to platform home */}
            <Link
              to="/"
              className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-[13px] transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
              <span>홈</span>
            </Link>

            {/* Title — centered */}
            <Link
              to="/lookalike"
              className="absolute left-1/2 -translate-x-1/2 text-sm font-bold tracking-tight opacity-60 transition-opacity hover:opacity-100"
            >
              닮은꼴 찾기
            </Link>
          </div>
        </header>

        <main className={isLookalike ? 'flex flex-1 flex-col' : 'flex-1 pt-12'}>
          <Outlet />
        </main>

        <Toaster position="bottom-center" richColors closeButton />
      </div>
    </AppStateProvider>
  );
};
