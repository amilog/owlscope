import { useEffect } from 'react';
import { TitleBar } from '@/components/TitleBar';
import { Sidebar } from '@/components/Sidebar';
import { Toolbar } from '@/components/Toolbar';
import { StatusBar } from '@/components/StatusBar';
import { HomePanel } from '@/panels/HomePanel';
import { LogsPanel } from '@/panels/LogsPanel';
import { NetworkPanel } from '@/panels/NetworkPanel';
import { ErrorsPanel } from '@/panels/ErrorsPanel';
import { PerformancePanel } from '@/panels/PerformancePanel';
import { StatePanel } from '@/panels/StatePanel';
import { TimelinePanel } from '@/panels/TimelinePanel';
import { useEventsStore } from '@/store/events';
import { useClientsStore } from '@/store/clients';
import { useUIStore } from '@/store/ui';
import type { IncomingPayload } from '@/types/global';

export default function App() {
  const addEvent = useEventsStore((s) => s.addEvent);
  const addEvents = useEventsStore((s) => s.addEvents);
  const clearEvents = useEventsStore((s) => s.clearEvents);
  const togglePause = useEventsStore((s) => s.togglePause);
  const setSearch = useEventsStore((s) => s.setSearch);
  const collapseAll = useEventsStore((s) => s.collapseAll);
  const addClient = useClientsStore((s) => s.addClient);
  const removeClient = useClientsStore((s) => s.removeClient);
  const setServerStatus = useClientsStore((s) => s.setServerStatus);
  const activePanel = useUIStore((s) => s.activePanel);
  const setSidebarCollapsed = useUIStore((s) => s.setSidebarCollapsed);

  useEffect(() => {
    const apply = () => setSidebarCollapsed(window.innerWidth < 520);
    apply();
    window.addEventListener('resize', apply);
    return () => window.removeEventListener('resize', apply);
  }, [setSidebarCollapsed]);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.owlscope) return;
    const off = window.owlscope.onIncoming((p: IncomingPayload) => {
      if (p.kind === 'event') addEvent(p.event);
      else if (p.kind === 'events') addEvents(p.events);
      else if (p.kind === 'client:connected') addClient(p.client);
      else if (p.kind === 'client:disconnected') removeClient(p.clientId);
      else if (p.kind === 'server:status') setServerStatus(p.running, p.address);
    });

    window.owlscope.getClients().then((cs) => {
      for (const c of cs) addClient(c);
    });
    window.owlscope.getServerStatus().then((s) => {
      setServerStatus(s.running, s.address);
    });

    return () => off();
  }, [addEvent, addEvents, addClient, removeClient, setServerStatus]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.key.toLowerCase() === 'l') {
        e.preventDefault();
        clearEvents();
      } else if (meta && e.code === 'Space') {
        e.preventDefault();
        togglePause();
      } else if (meta && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        const el = document.querySelector<HTMLInputElement>('input[placeholder^="Search"]');
        el?.focus();
      } else if (e.key === 'Escape') {
        collapseAll();
        setSearch('');
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [clearEvents, togglePause, collapseAll, setSearch]);

  return (
    <div className="h-screen w-screen flex flex-col bg-bg-primary text-text-primary">
      <TitleBar />
      <div className="flex-1 min-h-0 flex">
        <Sidebar />
        <div className="flex-1 min-w-0 flex flex-col">
          <Toolbar />
          <div className="flex-1 min-h-0 flex">
            <div className="flex-1 min-w-0 flex flex-col">
              {activePanel === 'home' ? (
                <HomePanel />
              ) : activePanel === 'timeline' ? (
                <TimelinePanel />
              ) : activePanel === 'logs' ? (
                <LogsPanel />
              ) : activePanel === 'network' ? (
                <NetworkPanel />
              ) : activePanel === 'errors' ? (
                <ErrorsPanel />
              ) : activePanel === 'performance' ? (
                <PerformancePanel />
              ) : (
                <StatePanel />
              )}
            </div>
          </div>
        </div>
      </div>
      <StatusBar />
    </div>
  );
}
