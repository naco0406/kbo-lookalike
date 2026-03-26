import type { FC } from 'react';
import { useEffect, useCallback } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router';
import { ChevronLeft } from 'lucide-react';
import { AppStateProvider, useAppState, useAppDispatch } from '@/context/app-state-context';
import { Toaster } from '@/components/ui/sonner';
import { useTheme } from '@/hooks/use-theme';
import { startPreload } from '@/ml/preload';
import { useScrollToTop } from '@/hooks/use-scroll-to-top';

/** AppStateProvider 내부에서 렌더되어 context 접근 가능 */
const LayoutHeader: FC = () => {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const state = useAppState();
  const dispatch = useAppDispatch();
  const isResult = pathname === '/lookalike/result';

  const handleBackFromResult = useCallback(() => {
    dispatch({ type: 'RESET' });
    navigate('/lookalike', { replace: true, viewTransition: true });
  }, [dispatch, navigate]);

  return (
    <header className="absolute inset-x-0 top-0 z-50">
      <div className="container mx-auto flex h-12 max-w-md items-center px-5">
        {/* Back — 컨텍스트 인식 */}
        {isResult && state.phase === 'result' ? (
          <button
            onClick={handleBackFromResult}
            className="flex items-center gap-1 text-[13px] text-muted-foreground transition-all hover:text-foreground active:opacity-60"
          >
            <ChevronLeft className="h-4 w-4" />
            <span>다시하기</span>
          </button>
        ) : (
          <Link
            to="/"
            viewTransition
            className="flex items-center gap-1 text-[13px] text-muted-foreground transition-all hover:text-foreground active:opacity-60"
          >
            <ChevronLeft className="h-4 w-4" />
            <span>홈</span>
          </Link>
        )}

        {/* Title — centered */}
        <Link
          to="/lookalike"
          viewTransition
          className="absolute left-1/2 -translate-x-1/2 text-sm font-bold tracking-tight opacity-60 transition-opacity hover:opacity-100"
        >
          혹시 선수세요?
        </Link>
      </div>
    </header>
  );
};

export const Layout: FC = () => {
  const { pathname } = useLocation();
  useTheme();
  useScrollToTop();

  // /lookalike 진입 시 ONNX 모델 + 임베딩 프리로드 시작
  useEffect(() => {
    startPreload();
  }, []);
  const isLookalike = pathname === '/lookalike';

  return (
    <AppStateProvider>
      <div className="flex min-h-dvh flex-col bg-background text-foreground">
        <LayoutHeader />

        <main className={isLookalike ? 'flex flex-1 flex-col' : 'flex-1 pt-12'}>
          <Outlet />
        </main>

        <Toaster position="bottom-center" richColors closeButton />
      </div>
    </AppStateProvider>
  );
};
