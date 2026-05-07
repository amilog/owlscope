import { memo } from 'react';
import type { DebugEvent, LogLevel } from '@owlscope/protocol';
import { useUIStore } from '@/store/ui';

const levelColor: Record<LogLevel, string> = {
  log: 'text-text-secondary',
  info: 'text-owl-info',
  warn: 'text-owl-warn',
  error: 'text-owl-error',
  debug: 'text-owl-debug',
};

const typeColor: Record<string, string> = {
  console: 'text-text-secondary',
  'network:request': 'text-owl-network',
  'network:response': 'text-owl-network',
  'redux:action': 'text-owl-event',
  'state:change': 'text-owl-event',
  custom: 'text-owl-event',
  error: 'text-owl-error',
  performance: 'text-owl-info',
  storage: 'text-owl-event',
  'navigation:push': 'text-owl-event',
  'navigation:pop': 'text-owl-event',
  'widget:rebuild': 'text-owl-event',
  'bloc:transition': 'text-owl-event',
  'provider:change': 'text-owl-event',
};

function formatTime(ts: number) {
  const d = new Date(ts);
  return d.toTimeString().slice(0, 8) + '.' + String(d.getMilliseconds()).padStart(3, '0');
}

function formatTimeShort(ts: number) {
  return new Date(ts).toTimeString().slice(0, 8);
}

/** A short tag for the type column when there's no room for the full name —
 *  picks the first segment so `state:change` / `network:request` are still
 *  recognisable, and clamps to a fixed width. */
function shortType(t: string): string {
  const seg = t.split(':')[0];
  return seg.length > 6 ? seg.slice(0, 6) : seg;
}

function formatStateShort(v: unknown): string {
  if (v === null) return 'null';
  if (v === undefined) return 'undefined';
  const t = typeof v;
  if (t === 'string' || t === 'number' || t === 'boolean') return String(v);
  try {
    const s = JSON.stringify(v);
    return s.length > 60 ? `${s.slice(0, 60)}…` : s;
  } catch {
    return String(v);
  }
}

function summarize(event: DebugEvent): string {
  const p = event.payload as Record<string, unknown> | unknown[] | null;
  if (event.type === 'console') {
    const args = (p as { args?: unknown[] })?.args ?? [];
    return args
      .map((a) => {
        if (typeof a === 'string') return a;
        try {
          return JSON.stringify(a);
        } catch {
          return String(a);
        }
      })
      .join(' ');
  }
  if (event.type === 'custom') {
    const cp = p as { name?: string; data?: unknown };
    return cp?.name ?? 'custom event';
  }
  if (event.type === 'network:request') {
    const np = p as { method?: string; url?: string };
    return `${np?.method ?? 'GET'} ${np?.url ?? ''}`;
  }
  if (event.type === 'network:response') {
    const np = p as { status?: number; url?: string; method?: string };
    return `${np?.method ?? ''} ${np?.status ?? '?'} ${np?.url ?? ''}`.trim();
  }
  if (event.type === 'redux:action') {
    const ap = p as { type?: string };
    return ap?.type ?? 'action';
  }
  if (event.type === 'navigation:push' || event.type === 'navigation:pop') {
    const np = p as { route?: { name?: string }; previous?: { name?: string } };
    const arrow = event.type === 'navigation:push' ? '→' : '←';
    return `${np?.previous?.name ?? '?'} ${arrow} ${np?.route?.name ?? '?'}`;
  }
  if (event.type === 'performance') {
    const pp = p as {
      frames?: number;
      avgBuildMs?: string;
      avgRasterMs?: string;
      slowFrames?: number;
    };
    return `${pp?.frames ?? 0} frames · build ${pp?.avgBuildMs ?? '?'}ms · raster ${pp?.avgRasterMs ?? '?'}ms${
      pp?.slowFrames ? ` · ${pp.slowFrames} slow` : ''
    }`;
  }
  if (event.type === 'error') {
    const ep = p as { message?: string };
    return ep?.message ?? 'error';
  }
  if (event.type === 'storage') {
    const sp = p as { area?: string; op?: string; key?: string; value?: string };
    if (sp?.op === 'clear') return `${sp.area} · clear`;
    if (sp?.op === 'remove') return `${sp.area} · remove ${sp.key ?? ''}`;
    return `${sp.area} · ${sp.op ?? 'set'} ${sp.key ?? ''}`;
  }
  if (event.type === 'state:change') {
    const sp = p as {
      provider?: { name?: string };
      previous?: unknown;
      next?: unknown;
    };
    const name = sp?.provider?.name ?? '?';
    const oldShort = formatStateShort(sp?.previous);
    const newShort = formatStateShort(sp?.next);
    return `${name}: ${oldShort} → ${newShort}`;
  }
  if (event.type === 'provider:change') {
    const sp = p as { event?: string; provider?: { name?: string } };
    const verb = sp?.event ?? 'change';
    return `${verb} · ${sp?.provider?.name ?? '?'}`;
  }
  if (event.type === 'bloc:transition') {
    const bp = p as { bloc?: string; event?: unknown; nextState?: unknown };
    return `${bp?.bloc ?? '?'} · ${formatStateShort(bp?.event)} → ${formatStateShort(bp?.nextState)}`;
  }
  try {
    return JSON.stringify(p).slice(0, 200);
  } catch {
    return String(p);
  }
}

interface LogRowProps {
  event: DebugEvent;
  selected: boolean;
  onSelect: (id: string) => void;
}

function LogRowImpl({ event, selected, onSelect }: LogRowProps) {
  const narrow = useUIStore((s) => s.sidebarCollapsed);
  const isError = event.type === 'error' || event.level === 'error';
  const isWarn = event.level === 'warn';

  const rowClass = [
    'flex items-center gap-2 h-7 text-[11px] cursor-pointer border-b border-border-subtle/40',
    narrow ? 'px-2' : 'px-3',
    selected ? 'row-selected' : 'row-hover',
    isError ? 'row-error' : '',
    isWarn ? 'row-warn' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={rowClass} onClick={() => onSelect(event.id)}>
      <span
        className={`shrink-0 overflow-hidden text-text-muted tabular-nums ${
          narrow ? 'w-[60px]' : 'w-[92px]'
        }`}
      >
        {narrow ? formatTimeShort(event.timestamp) : formatTime(event.timestamp)}
      </span>
      <span
        className={`shrink-0 truncate ${typeColor[event.type] ?? 'text-text-secondary'} ${
          narrow ? 'w-[52px]' : 'w-[92px]'
        }`}
        title={event.type}
      >
        {narrow ? shortType(event.type) : event.type}
      </span>
      {event.level && !narrow && (
        <span className={`w-12 shrink-0 ${levelColor[event.level]}`}>
          {event.level}
        </span>
      )}
      <span className="flex-1 min-w-0 truncate text-text-primary">{summarize(event)}</span>
      {event.meta?.duration !== undefined && !narrow && (
        <span className="w-12 shrink-0 text-right text-text-muted tabular-nums">
          {Math.round(event.meta.duration)}ms
        </span>
      )}
    </div>
  );
}

export const LogRow = memo(LogRowImpl);
