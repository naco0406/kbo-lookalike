import type { FC } from 'react';
import { Outlet, Link, useLocation } from 'react-router';
import { CalendarDays, Database, LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { href: '/', label: '일정 관리', icon: CalendarDays },
] as const;

export const AdminLayout: FC = () => {
  const { pathname } = useLocation();

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-50 border-b bg-background/90 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-6">
          <div className="flex items-center gap-4">
            <Link to="/" className="flex items-center gap-2">
              <Database className="h-4.5 w-4.5 text-muted-foreground" />
              <span className="text-[15px] font-bold tracking-tight">KBO Admin</span>
            </Link>
            <nav className="flex items-center gap-1">
              {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  to={href}
                  className={cn(
                    'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors',
                    pathname === href
                      ? 'bg-accent text-accent-foreground'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </Link>
              ))}
            </nav>
          </div>

          <a
            href="/cdn-cgi/access/logout"
            className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <LogOut className="h-3.5 w-3.5" />
            로그아웃
          </a>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-6">
        <Outlet />
      </main>
    </div>
  );
};
