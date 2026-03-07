import type { FC } from 'react';
import { Outlet, Link } from 'react-router';
import { AppStateProvider } from '@/context/app-state-context';
import { Toaster } from '@/components/ui/sonner';

export const Layout: FC = () => {
  return (
    <AppStateProvider>
      <div className="bg-background flex min-h-dvh flex-col">
        <header className="bg-background/80 sticky top-0 z-50 border-b backdrop-blur-sm">
          <div className="container mx-auto flex h-14 items-center justify-center px-4">
            <Link to="/" className="text-lg font-bold tracking-tight">
              KBO 닮은꼴
            </Link>
          </div>
        </header>

        <main className="flex-1">
          <Outlet />
        </main>

        <footer className="border-t py-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <div className="text-muted-foreground container mx-auto px-4 text-center text-xs">
            <p>모든 분석은 브라우저에서 처리되며, 사진은 서버로 전송되지 않습니다.</p>
          </div>
        </footer>
        <Toaster position="bottom-center" richColors closeButton />
      </div>
    </AppStateProvider>
  );
};
