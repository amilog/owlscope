import { useMemo } from 'react';
import {
  Activity,
  AlertTriangle,
  Box,
  Database,
  Eraser,
  Gauge,
  Layers,
  ScrollText,
  Wifi,
  Globe,
  Cpu,
  Smartphone,
} from 'lucide-react';
import type { ConnectedClient, Platform } from '@owlscope/protocol';
import { useEventsStore } from '@/store/events';
import { useClientsStore } from '@/store/clients';
import { useUIStore, type PanelKey } from '@/store/ui';

interface PanelDef {
  key: PanelKey;
  label: string;
  icon: typeof ScrollText;
}

const PANELS: PanelDef[] = [
  { key: 'logs', label: 'Logs', icon: ScrollText },
  { key: 'network', label: 'Network', icon: Wifi },
  { key: 'state', label: 'State', icon: Database },
  { key: 'errors', label: 'Errors', icon: AlertTriangle },
  { key: 'timeline', label: 'Timeline', icon: Layers },
  { key: 'performance', label: 'Performance', icon: Gauge },
];

function platformIcon(p: Platform) {
  if (p === 'web') return Globe;
  if (p === 'flutter' || p === 'react-native') return Smartphone;
  if (p === 'node' || p === 'electron') return Cpu;
  return Box;
}

export function Sidebar() {
  const events = useEventsStore((s) => s.events);
  const clearEvents = useEventsStore((s) => s.clearEvents);
  const setClientFilter = useEventsStore((s) => s.setClientFilter);
  const clientFilter = useEventsStore((s) => s.filters.clientId);
  const clients = useClientsStore((s) => s.clients);
  const activePanel = useUIStore((s) => s.activePanel);
  const setPanel = useUIStore((s) => s.setPanel);

  const counts = useMemo(() => {
    const out: Record<string, number> = {
      logs: 0,
      network: 0,
      state: 0,
      errors: 0,
      timeline: events.length,
      performance: 0,
    };
    for (const e of events) {
      if (e.type === 'console') out.logs++;
      else if (e.type === 'network:request' || e.type === 'network:response') out.network++;
      else if (
        e.type === 'redux:action' ||
        e.type === 'state:change' ||
        e.type === 'provider:change' ||
        e.type === 'bloc:transition'
      )
        out.state++;
      else if (e.type === 'error' || e.level === 'error') out.errors++;
      else if (e.type === 'performance') out.performance++;
    }
    return out;
  }, [events]);

  const clientList = Object.values(clients) as ConnectedClient[];

  return (
    <div className="w-[200px] shrink-0 bg-bg-surface border-r border-border-subtle flex flex-col text-xs">
      <div className="px-3 py-2 text-[10px] uppercase tracking-wider text-text-muted">
        Workspace
      </div>
      <nav className="flex-1 overflow-y-auto px-2 space-y-0.5">
        {PANELS.map((p) => {
          const Icon = p.icon;
          const isActive = activePanel === p.key;
          const count = counts[p.key] ?? 0;
          return (
            <button
              key={p.key}
              onClick={() => setPanel(p.key)}
              className={`w-full flex items-center gap-2 px-2 py-1.5 rounded transition-colors ${
                isActive
                  ? 'bg-blue-500/10 text-blue-400'
                  : 'text-text-secondary hover:bg-soft'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span className="flex-1 text-left">{p.label}</span>
              {count > 0 && (
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded ${
                    isActive ? 'bg-blue-500/20 text-blue-300' : 'bg-soft text-text-muted'
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="border-t border-border-subtle px-3 py-2 text-[10px] uppercase tracking-wider text-text-muted flex items-center justify-between">
        <span>Clients</span>
        <span>{clientList.length}</span>
      </div>
      <div className="px-2 pb-2 space-y-0.5 max-h-48 overflow-y-auto">
        {clientList.length === 0 && (
          <div className="px-2 py-1 text-text-muted">Waiting for clients…</div>
        )}
        {clientList.map((c) => {
          const Icon = platformIcon(c.handshake.platform);
          const active = clientFilter === c.clientId;
          return (
            <button
              key={c.clientId}
              onClick={() => setClientFilter(active ? null : c.clientId)}
              className={`w-full flex items-center gap-2 px-2 py-1.5 rounded transition-colors ${
                active
                  ? 'bg-blue-500/10 text-blue-400'
                  : 'text-text-secondary hover:bg-soft'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span className="flex-1 text-left truncate">{c.handshake.name}</span>
              <span className="w-1.5 h-1.5 rounded-full bg-owl-success glow-dot text-owl-success" />
            </button>
          );
        })}
      </div>

      <div className="border-t border-border-subtle p-2 flex gap-2">
        <button
          onClick={clearEvents}
          className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded bg-soft hover:bg-soft text-text-secondary"
        >
          <Eraser className="w-3.5 h-3.5" /> Clear
        </button>
        <button
          className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded bg-soft hover:bg-soft text-text-secondary"
          onClick={() => {
            const data = JSON.stringify(events, null, 2);
            const blob = new Blob([data], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `owlscope-${Date.now()}.json`;
            a.click();
            URL.revokeObjectURL(url);
          }}
        >
          <Activity className="w-3.5 h-3.5" /> Export
        </button>
      </div>
    </div>
  );
}
