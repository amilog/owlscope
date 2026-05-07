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

/** Type-group pills for the Timeline view. Each group bundles every event
 *  type that conceptually belongs to it so a single click hides/shows them
 *  as a unit. */
const TYPE_GROUPS: { key: string; label: string; color: string; types: string[] }[] = [
  {
    key: 'network',
    label: 'network',
    color: 'text-owl-network',
    types: ['network:request', 'network:response'],
  },
  {
    key: 'state',
    label: 'state',
    color: 'text-owl-event',
    types: ['state:change', 'redux:action', 'provider:change', 'bloc:transition'],
  },
  {
    key: 'perf',
    label: 'perf',
    color: 'text-owl-info',
    types: ['performance'],
  },
  {
    key: 'nav',
    label: 'nav',
    color: 'text-owl-event',
    types: ['navigation:push', 'navigation:pop'],
  },
];

export function Toolbar() {
  const search = useEventsStore((s) => s.filters.search);
  const setSearch = useEventsStore((s) => s.setSearch);
  const isPaused = useEventsStore((s) => s.isPaused);
  const togglePause = useEventsStore((s) => s.togglePause);
  const events = useEventsStore((s) => s.events);
  const levels = useEventsStore((s) => s.filters.levels);
  const toggleLevel = useEventsStore((s) => s.toggleLevel);
  const excludedTypes = useEventsStore((s) => s.filters.excludedTypes);
  const toggleTypeGroup = useEventsStore((s) => s.toggleTypeGroup);
  const order = useUIStore((s) => s.order);
  const toggleOrder = useUIStore((s) => s.toggleOrder);
  const narrow = useUIStore((s) => s.sidebarCollapsed);
  const activePanel = useUIStore((s) => s.activePanel);

  // Level filters live on the Timeline view, which is the catch-all stream
  // where filtering by severity actually narrows the noise. The other panels
  // (Logs, Network, State, Errors, Performance) are already type-scoped by
  // their sidebar selection — adding badges there is redundant and, for
  // panels whose events have no `level` (Network/State/Performance), would
  // hide everything when a pill is toggled.
  const showLevels = activePanel === 'timeline';

  const counts: Record<string, number> = {};
  const typeCounts: Record<string, number> = {};
  for (const e of events) {
    if (e.level) counts[e.level] = (counts[e.level] ?? 0) + 1;
    typeCounts[e.type] = (typeCounts[e.type] ?? 0) + 1;
  }
  const typeGroupCount = (group: { types: string[] }) =>
    group.types.reduce((acc, t) => acc + (typeCounts[t] ?? 0), 0);

  if (activePanel === 'home') return null;

  return (
    <div className="min-h-11 shrink-0 bg-bg-surface border-b border-border-subtle flex flex-wrap items-center px-2.5 py-1.5 gap-2">
      <div className="relative flex-1 min-w-[120px] max-w-md">
        <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={narrow ? 'Search…' : 'Search… (use /regex/flags for regex)'}
          className="w-full bg-bg-elevated rounded pl-8 pr-3 py-1.5 text-xs text-text-primary placeholder:text-text-muted border border-border-subtle focus:outline-none focus:border-purple-500/50"
        />
      </div>

      {showLevels && (
        <div className="flex items-center flex-wrap gap-1">
          {LEVELS.map((l) => {
            // Pills are "on" by default — `levels` holds the ones the user
            // has toggled OFF. Active = visible, dim = hidden.
            const active = !levels.has(l.key);
            const count = counts[l.key] ?? 0;
            return (
              <button
                key={l.key}
                onClick={() => toggleLevel(l.key)}
                title={active ? `Hide ${l.label}` : `Show ${l.label}`}
                className={`text-[11px] rounded border transition-colors ${
                  narrow ? 'px-1.5 py-1' : 'px-2 py-1'
                } ${
                  active
                    ? 'border-purple-500/40 bg-purple-500/10 text-purple-300'
                    : 'border-border-subtle bg-bg-elevated text-text-muted opacity-50 hover:opacity-100'
                }`}
              >
                <span className={l.color}>●</span>
                {!narrow && <span className="ml-1">{l.label}</span>}
                {count > 0 && <span className="ml-1 text-text-muted">{count}</span>}
              </button>
            );
          })}
          {TYPE_GROUPS.map((g) => {
            const count = typeGroupCount(g);
            if (count === 0) return null; // hide pill if nothing of this type captured
            const active = !g.types.every((t) => excludedTypes.has(t));
            return (
              <button
                key={g.key}
                onClick={() => toggleTypeGroup(g.types)}
                title={active ? `Hide ${g.label}` : `Show ${g.label}`}
                className={`text-[11px] rounded border transition-colors ${
                  narrow ? 'px-1.5 py-1' : 'px-2 py-1'
                } ${
                  active
                    ? 'border-purple-500/40 bg-purple-500/10 text-purple-300'
                    : 'border-border-subtle bg-bg-elevated text-text-muted opacity-50 hover:opacity-100'
                }`}
              >
                <span className={g.color}>●</span>
                {!narrow && <span className="ml-1">{g.label}</span>}
                <span className="ml-1 text-text-muted">{count}</span>
              </button>
            );
          })}
        </div>
      )}

      {!narrow && <div className="flex-1" />}

      <button
        onClick={toggleOrder}
        className={`flex items-center gap-1.5 text-[11px] rounded border border-border-subtle bg-bg-elevated text-text-secondary hover:bg-soft ${
          narrow ? 'p-1.5' : 'px-2 py-1.5'
        }`}
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
        {!narrow && 'Newest'}
      </button>

      <button
        onClick={togglePause}
        title={isPaused ? 'Resume' : 'Pause'}
        className={`flex items-center gap-1.5 text-[11px] rounded border ${
          narrow ? 'p-1.5' : 'px-2.5 py-1.5'
        } ${
          isPaused
            ? 'border-amber-500/40 bg-amber-500/10 text-amber-300'
            : 'border-border-subtle bg-bg-elevated text-text-secondary hover:bg-soft'
        }`}
      >
        {isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
        {!narrow && (isPaused ? 'Resume' : 'Pause')}
      </button>
    </div>
  );
}
