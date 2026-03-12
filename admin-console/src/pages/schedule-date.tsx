import type { FC } from 'react';
import { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router';
import { ArrowLeft, Check, Loader2, Save, Trash2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { fetchGames, saveGames, type Game } from '@/lib/cloudflare';
import { TEAM_COLORS, STATUS_LABELS } from '@/constants/teams';

// ── Types ────────────────────────────────────────────────────────────────────

type GameStatus = Game['status'];
const STATUSES: GameStatus[] = ['upcoming', 'live', 'completed', 'cancelled', 'suspended'];

// ── Sub-components ───────────────────────────────────────────────────────────

const TeamBadge: FC<{ code: string; size?: 'sm' | 'md' }> = ({ code, size = 'md' }) => {
  const team = TEAM_COLORS[code];
  const dims = size === 'sm' ? 'h-7 w-7 text-[9px]' : 'h-9 w-9 text-[10px]';
  return (
    <div
      className={cn('flex shrink-0 items-center justify-center rounded-full font-bold text-white', dims)}
      style={{ backgroundColor: team?.primary ?? '#888' }}
    >
      {team?.shortName ?? code}
    </div>
  );
};

const GameRow: FC<{
  game: Game;
  editing: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSave: (updated: Game) => void;
  onDelete: () => void;
}> = ({ game, editing, onEdit, onCancel, onSave, onDelete }) => {
  const [form, setForm] = useState(game);

  useEffect(() => {
    setForm(game);
  }, [game, editing]);

  const handleField = <K extends keyof Game>(key: K, value: Game[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleScore = (side: 'away' | 'home', value: string) => {
    const num = value === '' ? undefined : Number(value);
    setForm((prev) => ({
      ...prev,
      [side]: { ...prev[side], score: num },
    }));
  };

  if (!editing) {
    const hasScore = game.away.score !== undefined;
    return (
      <button
        type="button"
        onClick={onEdit}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-accent"
      >
        <TeamBadge code={game.away.code} />
        <div className="flex flex-1 items-center justify-center gap-2">
          {hasScore ? (
            <span className="text-[16px] font-bold tabular-nums">
              {game.away.score} : {game.home.score}
            </span>
          ) : (
            <span className="text-[14px] font-semibold tabular-nums">{game.time}</span>
          )}
        </div>
        <TeamBadge code={game.home.code} />
        <div className="ml-2 flex w-20 flex-col items-end">
          <span className="text-[11px] text-muted-foreground">{game.venue}</span>
          <span
            className={cn(
              'text-[10px] font-medium',
              game.status === 'live' ? 'text-red-500' : 'text-muted-foreground/60',
            )}
          >
            {STATUS_LABELS[game.status] ?? game.status}
          </span>
        </div>
      </button>
    );
  }

  // ── Edit mode ──
  return (
    <div className="space-y-3 border-l-2 border-primary bg-accent/50 px-4 py-3">
      <div className="flex items-center justify-between">
        <span className="text-[12px] font-semibold text-muted-foreground">
          {game.id}
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onSave(form)}
            className="flex items-center gap-1 rounded-md bg-primary px-2.5 py-1 text-[11px] font-medium text-primary-foreground"
          >
            <Check className="h-3 w-3" /> 적용
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="flex items-center gap-1 rounded-md bg-muted px-2.5 py-1 text-[11px] font-medium"
          >
            <X className="h-3 w-3" /> 취소
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="flex items-center gap-1 rounded-md bg-destructive/10 px-2.5 py-1 text-[11px] font-medium text-destructive"
          >
            <Trash2 className="h-3 w-3" /> 삭제
          </button>
        </div>
      </div>

      {/* Teams + Score */}
      <div className="flex items-center gap-3">
        <TeamBadge code={form.away.code} size="sm" />
        <input
          type="number"
          value={form.away.score ?? ''}
          onChange={(e) => handleScore('away', e.target.value)}
          placeholder="—"
          className="w-14 rounded-md border bg-background px-2 py-1 text-center text-[14px] font-bold tabular-nums"
        />
        <span className="text-muted-foreground/40">:</span>
        <input
          type="number"
          value={form.home.score ?? ''}
          onChange={(e) => handleScore('home', e.target.value)}
          placeholder="—"
          className="w-14 rounded-md border bg-background px-2 py-1 text-center text-[14px] font-bold tabular-nums"
        />
        <TeamBadge code={form.home.code} size="sm" />
      </div>

      {/* Fields */}
      <div className="grid grid-cols-3 gap-2">
        <label className="space-y-1">
          <span className="text-[11px] font-medium text-muted-foreground">상태</span>
          <select
            value={form.status}
            onChange={(e) => handleField('status', e.target.value as GameStatus)}
            className="w-full rounded-md border bg-background px-2 py-1.5 text-[12px]"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>{STATUS_LABELS[s]}</option>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          <span className="text-[11px] font-medium text-muted-foreground">시간</span>
          <input
            type="text"
            value={form.time}
            onChange={(e) => handleField('time', e.target.value)}
            className="w-full rounded-md border bg-background px-2 py-1.5 text-[12px] tabular-nums"
          />
        </label>
        <label className="space-y-1">
          <span className="text-[11px] font-medium text-muted-foreground">경기장</span>
          <input
            type="text"
            value={form.venue}
            onChange={(e) => handleField('venue', e.target.value)}
            className="w-full rounded-md border bg-background px-2 py-1.5 text-[12px]"
          />
        </label>
      </div>
    </div>
  );
};

// ── Page ─────────────────────────────────────────────────────────────────────

export const ScheduleDatePage: FC = () => {
  const { date } = useParams<{ date: string }>();
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!date) return;
    fetchGames(date)
      .then((g) => {
        setGames(g);
        setDirty(false);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [date]);

  const handleGameSave = useCallback((updated: Game) => {
    setGames((prev) => prev.map((g) => (g.id === updated.id ? updated : g)));
    setEditingId(null);
    setDirty(true);
  }, []);

  const handleGameDelete = useCallback((id: string) => {
    setGames((prev) => prev.filter((g) => g.id !== id));
    setEditingId(null);
    setDirty(true);
  }, []);

  const handleSaveAll = useCallback(async () => {
    if (!date) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await saveGames(date, games);
      setDirty(false);
      setSuccess('저장 완료');
      setTimeout(() => setSuccess(null), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }, [date, games]);

  const d = date ? new Date(date + 'T00:00:00') : null;
  const dateLabel = d
    ? new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' }).format(d)
    : date;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="animate-reveal-up">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            to="/"
            className="flex h-8 w-8 items-center justify-center rounded-lg border transition-colors hover:bg-accent"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-[18px] font-bold">{dateLabel}</h1>
            <p className="text-[12px] text-muted-foreground">{games.length}경기</p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleSaveAll}
          disabled={!dirty || saving}
          className={cn(
            'flex items-center gap-1.5 rounded-lg px-4 py-2 text-[13px] font-medium transition-all',
            dirty
              ? 'bg-primary text-primary-foreground shadow-sm hover:opacity-90'
              : 'bg-muted text-muted-foreground',
          )}
        >
          {saving ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Save className="h-3.5 w-3.5" />
          )}
          KV에 저장
        </button>
      </div>

      {/* Status messages */}
      {error && (
        <div className="mb-4 rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-2.5 text-[13px] text-destructive">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-2.5 text-[13px] text-green-700">
          {success}
        </div>
      )}

      {/* Games */}
      {games.length === 0 ? (
        <div className="rounded-xl border bg-card py-12 text-center text-[13px] text-muted-foreground">
          이 날짜에 경기가 없습니다
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card">
          {games.map((game, i) => (
            <div
              key={game.id}
              style={i > 0 ? { borderTop: '1px solid var(--border)' } : undefined}
            >
              <GameRow
                game={game}
                editing={editingId === game.id}
                onEdit={() => setEditingId(game.id)}
                onCancel={() => setEditingId(null)}
                onSave={handleGameSave}
                onDelete={() => handleGameDelete(game.id)}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
