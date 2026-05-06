import { Moon, Sun } from 'lucide-react';
import { useClientsStore } from '@/store/clients';
import { useThemeStore } from '@/store/theme';

export function TitleBar() {
  const { serverRunning, serverAddress, clients } = useClientsStore();
  const theme = useThemeStore((s) => s.theme);
  const toggle = useThemeStore((s) => s.toggle);

  const clientCount = Object.keys(clients).length;
  const sessionLabel =
    clientCount === 0
      ? 'no client connected'
      : clientCount === 1
        ? Object.values(clients)[0]?.handshake.name ?? 'client'
        : `${clientCount} clients`;

  return (
    <div className="titlebar-drag h-10 flex items-center justify-between px-4 bg-bg-surface border-b border-border-subtle text-xs select-none">
      <div className="w-32" />
      <div className="flex items-center gap-2 text-text-secondary">
        <img src="/logo.png" alt="OwlScope" className="w-5 h-5" draggable={false} />
        <span className="font-semibold text-text-primary">OwlScope</span>
        <span className="text-text-muted">·</span>
        <span>{sessionLabel}</span>
      </div>
      <div className="titlebar-nodrag flex items-center gap-3 text-text-muted">
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
          className={`w-2 h-2 rounded-full glow-dot ${
            serverRunning ? 'bg-owl-success text-owl-success' : 'bg-owl-error text-owl-error'
          }`}
        />
        <span>{serverAddress}</span>
      </div>
    </div>
  );
}
