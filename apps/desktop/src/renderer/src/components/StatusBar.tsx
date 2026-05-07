import { useEffect, useState } from 'react';
import { useEventsStore } from '@/store/events';
import { useClientsStore } from '@/store/clients';
import { useUIStore } from '@/store/ui';

function formatRelative(ts: number, now: number): string {
  const diff = Math.max(0, now - ts) / 1000;
  if (diff < 1) return 'just now';
  if (diff < 60) return `${diff.toFixed(1)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

export function StatusBar() {
  const events = useEventsStore((s) => s.events);
  const clients = useClientsStore((s) => s.clients);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, []);

  const total = events.length;
  const last = events[events.length - 1];
  const networkCount = events.filter(
    (e) => e.type === 'network:request' || e.type === 'network:response',
  ).length;
  const durations = events.map((e) => e.meta?.duration).filter((d): d is number => typeof d === 'number');
  const avgDuration =
    durations.length > 0
      ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
      : null;
  const clientCount = Object.keys(clients).length;
  const narrow = useUIStore((s) => s.sidebarCollapsed);

  return (
    <div className="h-7 shrink-0 bg-bg-surface border-t border-border-subtle px-3 flex items-center justify-between gap-3 text-[11px] text-text-muted">
      <div className={`flex items-center min-w-0 ${narrow ? 'gap-2' : 'gap-4'}`}>
        <span>{narrow ? `${total} ev` : `${total} events`}</span>
        <span>{narrow ? `${networkCount} req` : `${networkCount} requests`}</span>
        {avgDuration !== null && <span>avg {avgDuration}ms</span>}
        {!narrow && <span>{clientCount} clients</span>}
      </div>
      <div className="truncate">
        {last
          ? narrow
            ? formatRelative(last.timestamp, now)
            : `last event ${formatRelative(last.timestamp, now)}`
          : 'idle'}
      </div>
      {!narrow && <div className="shrink-0">OwlScope v0.1.0</div>}
    </div>
  );
}
