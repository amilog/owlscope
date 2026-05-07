import { useEffect } from 'react';
import { Moon, Pin, PinOff, Sun } from 'lucide-react';
import { useClientsStore } from '@/store/clients';
import { useThemeStore } from '@/store/theme';
import { useUIStore } from '@/store/ui';

export function TitleBar() {
  const { serverRunning, serverAddress, clients } = useClientsStore();
  const theme = useThemeStore((s) => s.theme);
  const toggle = useThemeStore((s) => s.toggle);
  const alwaysOnTop = useUIStore((s) => s.alwaysOnTop);
  const toggleAlwaysOnTop = useUIStore((s) => s.toggleAlwaysOnTop);

  useEffect(() => {
    if (alwaysOnTop && typeof window !== 'undefined' && window.owlscope) {
      window.owlscope.setAlwaysOnTop(true).catch(() => {});
    }
  }, [alwaysOnTop]);

  const narrow = useUIStore((s) => s.sidebarCollapsed);

  const clientCount = Object.keys(clients).length;
  const sessionLabel =
    clientCount === 0
      ? 'no client connected'
      : clientCount === 1
        ? Object.values(clients)[0]?.handshake.name ?? 'client'
        : `${clientCount} clients`;

  return (
    <div className="titlebar-drag h-10 shrink-0 flex items-center justify-between gap-2 pl-20 pr-3 bg-bg-surface border-b border-border-subtle text-xs select-none">
      <div className="flex items-center gap-2 text-text-secondary min-w-0 flex-1">
        <span className="truncate">{narrow && clientCount === 0 ? 'idle' : sessionLabel}</span>
      </div>
      <div className="titlebar-nodrag flex items-center gap-2.5 text-text-muted shrink-0">
        <button
          onClick={() => void toggleAlwaysOnTop()}
          className={`transition-colors ${
            alwaysOnTop ? 'text-purple-400 hover:text-purple-300' : 'hover:text-text-primary'
          }`}
          title={alwaysOnTop ? 'Pinned on top — click to unpin' : 'Pin window on top'}
        >
          {alwaysOnTop ? <Pin className="w-3.5 h-3.5" /> : <PinOff className="w-3.5 h-3.5" />}
        </button>
        <button
          onClick={toggle}
          className="hover:text-text-primary transition-colors"
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
        >
          {theme === 'dark' ? (
            <Sun className="w-3.5 h-3.5" />
          ) : (
            <Moon className="w-3.5 h-3.5" />
          )}
        </button>
        <span
          title={serverAddress}
          className={`w-2 h-2 rounded-full glow-dot ${
            serverRunning ? 'bg-owl-success text-owl-success' : 'bg-owl-error text-owl-error'
          }`}
        />
        {!narrow && <span className="truncate">{serverAddress}</span>}
      </div>
    </div>
  );
}
