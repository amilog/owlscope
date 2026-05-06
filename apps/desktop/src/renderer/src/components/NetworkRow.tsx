import { memo } from 'react';
import type { DebugEvent } from '@owlscope/protocol';

interface NetworkPayload {
  method?: string;
  url?: string;
  status?: number;
  statusText?: string;
  ok?: boolean;
  duration?: number;
  startedAt?: number;
  error?: string;
}

function formatTime(ts: number) {
  const d = new Date(ts);
  return d.toTimeString().slice(0, 8) + '.' + String(d.getMilliseconds()).padStart(3, '0');
}

function statusColor(status?: number, error?: string): string {
  if (error || status === 0) return 'text-owl-error';
  if (!status) return 'text-text-muted';
  if (status >= 200 && status < 300) return 'text-owl-success';
  if (status >= 300 && status < 400) return 'text-owl-info';
  if (status >= 400 && status < 500) return 'text-owl-warn';
  return 'text-owl-error';
}

function shortenUrl(url: string): string {
  try {
    const u = new URL(url);
    return u.pathname + u.search;
  } catch {
    return url;
  }
}

function host(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return '';
  }
}

interface Props {
  event: DebugEvent;
  selected: boolean;
  onSelect: (id: string) => void;
}

function NetworkRowImpl({ event, selected, onSelect }: Props) {
  const p = event.payload as NetworkPayload;
  const isError = !!p.error || p.status === 0;

  const rowClass = [
    'flex items-center gap-2 h-7 px-3 text-[11px] cursor-pointer border-b border-border-subtle/40',
    selected ? 'row-selected' : 'row-hover',
    isError ? 'row-error' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={rowClass} onClick={() => onSelect(event.id)}>
      <span className="w-[68px] shrink-0 text-text-muted tabular-nums">
        {formatTime(event.timestamp)}
      </span>
      <span className="w-12 shrink-0 text-owl-network font-medium">{p.method ?? 'GET'}</span>
      <span className={`w-12 shrink-0 tabular-nums ${statusColor(p.status, p.error)}`}>
        {p.error ? 'ERR' : (p.status ?? '–')}
      </span>
      <span className="w-32 shrink-0 truncate text-text-muted">{host(p.url ?? '')}</span>
      <span className="flex-1 truncate text-text-primary">
        {shortenUrl(p.url ?? '')}
        {p.error && <span className="ml-2 text-owl-error">{p.error}</span>}
      </span>
      <span className="w-14 shrink-0 text-right text-text-muted tabular-nums">
        {p.duration !== undefined ? `${Math.round(p.duration)}ms` : '–'}
      </span>
    </div>
  );
}

export const NetworkRow = memo(NetworkRowImpl);
