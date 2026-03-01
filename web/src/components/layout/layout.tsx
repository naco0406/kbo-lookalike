import type { FC } from 'react';
import { Outlet, Link, useLocation } from 'react-router';
import { cn } from '@/lib/utils';

export const Layout: FC = () => {
  const { pathname } = useLocation();

  return (
    <div className="bg-background flex min-h-dvh flex-col">
      <header className="bg-background/80 sticky top-0 z-50 border-b backdrop-blur-sm">
        <div className="container mx-auto flex h-14 items-center justify-between px-4">
          <Link to="/" className="text-lg font-bold tracking-tight">
            KBO 닮은꼴
          </Link>
          <nav className="flex gap-4 text-sm">
            <Link
              to="/"
              className={cn(
                'hover:text-foreground transition-colors',
                pathname === '/' ? 'text-foreground' : 'text-muted-foreground',
              )}
            >
              홈
            </Link>
            <Link
              to="/about"
              className={cn(
                'hover:text-foreground transition-colors',
                pathname === '/about' ? 'text-foreground' : 'text-muted-foreground',
              )}
            >
              소개
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="border-t py-6">
        <div className="text-muted-foreground container mx-auto px-4 text-center text-sm">
          <p>모든 얼굴 분석은 브라우저에서 처리되며, 사진은 서버로 전송되지 않습니다.</p>
        </div>
      </footer>
    </div>
  );
};
