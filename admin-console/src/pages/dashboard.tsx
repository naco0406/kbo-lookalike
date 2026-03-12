import type { FC } from 'react';
import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router';
import { CalendarDays, ChevronRight, Loader2 } from 'lucide-react';
import { fetchDates } from '@/lib/cloudflare';

// ── Helpers ──────────────────────────────────────────────────────────────────

const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'] as const;

const formatDate = (dateStr: string) => {
  const d = new Date(dateStr + 'T00:00:00');
  const month = d.getMonth() + 1;
  const day = d.getDate();
  const dow = DAY_NAMES[d.getDay()];
  return { month, day, dow, monthKey: `${d.getFullYear()}-${String(month).padStart(2, '0')}` };
};

const MONTH_LABELS: Record<string, string> = {
  '01': '1월', '02': '2월', '03': '3월', '04': '4월',
  '05': '5월', '06': '6월', '07': '7월', '08': '8월',
  '09': '9월', '10': '10월', '11': '11월', '12': '12월',
};

// ── Page ─────────────────────────────────────────────────────────────────────

export const DashboardPage: FC = () => {
  const [dates, setDates] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDates(2026)
      .then(setDates)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const grouped = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const date of dates) {
      const { monthKey } = formatDate(date);
      const arr = map.get(monthKey) ?? [];
      arr.push(date);
      map.set(monthKey, arr);
    }
    return map;
  }, [dates]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-[13px] text-destructive">
        {error}
      </div>
    );
  }

  return (
    <div className="animate-reveal-up">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-[20px] font-bold">경기 일정 관리</h1>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            2026 시즌 · {dates.length}일 · KV 저장됨
          </p>
        </div>
        <div className="flex items-center gap-1.5 rounded-lg bg-muted px-3 py-1.5">
          <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-[12px] font-medium text-muted-foreground">{dates.length}일</span>
        </div>
      </div>

      {/* Month groups */}
      <div className="space-y-6">
        {[...grouped.entries()].map(([monthKey, monthDates]) => {
          const monthNum = monthKey.split('-')[1];
          return (
            <section key={monthKey}>
              <h2 className="mb-2 text-[13px] font-semibold text-muted-foreground">
                {MONTH_LABELS[monthNum]} ({monthDates.length}일)
              </h2>
              <div className="overflow-hidden rounded-xl border bg-card">
                {monthDates.map((date, i) => {
                  const { day, dow } = formatDate(date);
                  const isWeekend = dow === '토' || dow === '일';
                  return (
                    <Link
                      key={date}
                      to={`/schedule/${date}`}
                      className="flex items-center justify-between px-4 py-3 transition-colors hover:bg-accent"
                      style={i > 0 ? { borderTop: '1px solid var(--border)' } : undefined}
                    >
                      <div className="flex items-center gap-3">
                        <span className="w-8 text-center text-[15px] font-bold tabular-nums">
                          {day}
                        </span>
                        <span
                          className={`text-[12px] font-medium ${
                            isWeekend ? 'text-red-500' : 'text-muted-foreground'
                          }`}
                        >
                          {dow}
                        </span>
                        <span className="text-[13px]">{date}</span>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground/40" />
                    </Link>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
};
