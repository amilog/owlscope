import { useMemo } from 'react';
import {
  Activity,
  AlertTriangle,
  Box,
  Database,
  Eraser,
  Gauge,
  Home,
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
  { key: 'home', label: 'Home', icon: Home },
  { key: 'timeline', label: 'Timeline', icon: Layers },
  { key: 'logs', label: 'Logs', icon: ScrollText },
  { key: 'network', label: 'Network', icon: Wifi },
  { key: 'state', label: 'State', icon: Database },
  { key: 'errors', label: 'Errors', icon: AlertTriangle },
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
  const collapsed = useUIStore((s) => s.sidebarCollapsed);

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
      if (e.type === 'console' || e.type === 'error' || e.level !== undefined) {
        out.logs++;
      }
      if (e.type === 'network:request' || e.type === 'network:response') {
        out.network++;
      }
      if (
        e.type === 'redux:action' ||
        e.type === 'state:change' ||
        e.type === 'provider:change' ||
        e.type === 'bloc:transition'
      ) {
        out.state++;
      }
      if (e.type === 'error' || e.level === 'error') out.errors++;
      if (e.type === 'performance' || e.type.startsWith('performance:')) {
        out.performance++;
      }
    }
    return out;
  }, [events]);

  const clientList = Object.values(clients) as ConnectedClient[];

  if (collapsed) {
    return (
      <div className="w-11 shrink-0 bg-bg-surface border-r border-border-subtle flex flex-col text-xs">
        <div className="h-10 flex items-center justify-center border-b border-border-subtle">
          <img src="/logo.png" alt="OwlScope" className="w-5 h-5" draggable={false} />
        </div>
        <nav className="flex-1 overflow-y-auto py-2 px-1.5 space-y-0.5">
          {PANELS.map((p) => {
            const Icon = p.icon;
            const isActive = activePanel === p.key;
            const count = counts[p.key] ?? 0;
            return (
              <button
                key={p.key}
                onClick={() => setPanel(p.key)}
                title={`${p.label}${count > 0 ? ` (${count})` : ''}`}
                className={`relative w-8 h-8 flex items-center justify-center rounded transition-colors ${
                  isActive
                    ? 'bg-purple-500/10 text-purple-400'
                    : 'text-text-secondary hover:bg-soft'
                }`}
              >
                <Icon className="w-4 h-4" />
                {count > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-[14px] px-1 rounded-full bg-purple-500/30 text-[9px] leading-[14px] text-purple-200">
                    {count > 99 ? '99+' : count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
        <div className="border-t border-border-subtle py-2 px-1.5 space-y-0.5">
          {clientList.slice(0, 4).map((c) => {
            const Icon = platformIcon(c.handshake.platform);
            const active = clientFilter === c.clientId;
            return (
              <button
                key={c.clientId}
                onClick={() => setClientFilter(active ? null : c.clientId)}
                title={c.handshake.name}
                className={`w-8 h-8 flex items-center justify-center rounded transition-colors ${
                  active
                    ? 'bg-purple-500/10 text-purple-400'
                    : 'text-text-secondary hover:bg-soft'
                }`}
              >
                <Icon className="w-4 h-4" />
              </button>
            );
          })}
          <button
            onClick={clearEvents}
            title="Clear events"
            className="w-8 h-8 flex items-center justify-center rounded text-text-secondary hover:bg-soft"
          >
            <Eraser className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-[200px] shrink-0 bg-bg-surface border-r border-border-subtle flex flex-col text-xs">
      <div className="h-12 px-3 flex items-center gap-2 border-b border-border-subtle">
        <img src="/logo.png" alt="OwlScope" className="w-6 h-6" draggable={false} />
        <span className="font-semibold text-text-primary">OwlScope</span>
      </div>
      <nav className="flex-1 overflow-y-auto px-2 py-2 space-y-0.5">
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
                  ? 'bg-purple-500/10 text-purple-400'
                  : 'text-text-secondary hover:bg-soft'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span className="flex-1 text-left">{p.label}</span>
              {count > 0 && (
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded ${
                    isActive ? 'bg-purple-500/20 text-purple-300' : 'bg-soft text-text-muted'
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
                  ? 'bg-purple-500/10 text-purple-400'
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
