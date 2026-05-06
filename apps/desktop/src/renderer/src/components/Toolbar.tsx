import { Pause, Play, Search, ArrowDownToLine, ArrowUpToLine } from 'lucide-react';
import type { LogLevel } from '@owlscope/protocol';
import { useEventsStore } from '@/store/events';
import { useUIStore } from '@/store/ui';

const LEVELS: { key: LogLevel; label: string; color: string }[] = [
  { key: 'log', label: 'log', color: 'text-text-secondary' },
  { key: 'info', label: 'info', color: 'text-owl-info' },
  { key: 'warn', label: 'warn', color: 'text-owl-warn' },
  { key: 'error', label: 'error', color: 'text-owl-error' },
  { key: 'debug', label: 'debug', color: 'text-owl-debug' },
];

export function Toolbar() {
  const search = useEventsStore((s) => s.filters.search);
  const setSearch = useEventsStore((s) => s.setSearch);
  const isPaused = useEventsStore((s) => s.isPaused);
  const togglePause = useEventsStore((s) => s.togglePause);
  const events = useEventsStore((s) => s.events);
  const levels = useEventsStore((s) => s.filters.levels);
  const toggleLevel = useEventsStore((s) => s.toggleLevel);
  const order = useUIStore((s) => s.order);
  const toggleOrder = useUIStore((s) => s.toggleOrder);

  const counts: Record<string, number> = {};
  for (const e of events) {
    if (e.level) counts[e.level] = (counts[e.level] ?? 0) + 1;
  }

  return (
    <div className="h-11 shrink-0 bg-bg-surface border-b border-border-subtle flex items-center px-3 gap-3">
      <div className="relative flex-1 max-w-md">
        <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search… (use /regex/flags for regex)"
          className="w-full bg-bg-elevated rounded pl-8 pr-3 py-1.5 text-xs text-text-primary placeholder:text-text-muted border border-border-subtle focus:outline-none focus:border-blue-500/50"
        />
      </div>

      <div className="flex items-center gap-1">
        {LEVELS.map((l) => {
          const active = levels.has(l.key);
          const count = counts[l.key] ?? 0;
          return (
            <button
              key={l.key}
              onClick={() => toggleLevel(l.key)}
              className={`text-[11px] px-2 py-1 rounded border transition-colors ${
                active
                  ? 'border-blue-500/40 bg-blue-500/10 text-blue-300'
                  : 'border-border-subtle bg-bg-elevated text-text-secondary hover:bg-soft'
              }`}
            >
              <span className={l.color}>●</span> <span>{l.label}</span>
              {count > 0 && <span className="ml-1 text-text-muted">{count}</span>}
            </button>
          );
        })}
      </div>

      <div className="flex-1" />

      <button
        onClick={toggleOrder}
        className="flex items-center gap-1.5 text-[11px] px-2 py-1.5 rounded border border-border-subtle bg-bg-elevated text-text-secondary hover:bg-soft"
        title={
          order === 'newest-bottom'
            ? 'Newest at bottom — click to flip to newest at top'
            : 'Newest at top — click to flip to newest at bottom'
        }
      >
        {order === 'newest-bottom' ? (
          <ArrowDownToLine className="w-3.5 h-3.5" />
        ) : (
          <ArrowUpToLine className="w-3.5 h-3.5" />
        )}
        {order === 'newest-bottom' ? 'Newest ↓' : 'Newest ↑'}
      </button>

      <button
        onClick={togglePause}
        className={`flex items-center gap-1.5 text-[11px] px-2.5 py-1.5 rounded border ${
          isPaused
            ? 'border-amber-500/40 bg-amber-500/10 text-amber-300'
            : 'border-border-subtle bg-bg-elevated text-text-secondary hover:bg-soft'
        }`}
      >
        {isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
        {isPaused ? 'Resume' : 'Pause'}
      </button>
    </div>
  );
}
