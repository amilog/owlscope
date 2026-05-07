import { Github, Plug, Zap, ScrollText } from 'lucide-react';
import { useClientsStore } from '@/store/clients';
import { useEventsStore } from '@/store/events';
import { useUIStore, type PanelKey } from '@/store/ui';

const QUICK_START = `import 'package:owlscope/auto.dart';

void main() {
  owlscopeAuto(() => runApp(const MyApp()));
}`;

const QUICK_START_JS = `import 'owlscope/auto';

// All console.* and fetch/XHR calls now stream to OwlScope.`;

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-border-subtle/40 text-xs">
      <span className="text-text-muted">{label}</span>
      <span className="text-text-primary tabular-nums">{value}</span>
    </div>
  );
}

function ShortcutCard({
  icon: Icon,
  title,
  desc,
  onClick,
}: {
  icon: typeof Plug;
  title: string;
  desc: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="text-left p-4 rounded-lg border border-border-subtle bg-bg-elevated hover:border-purple-500/40 hover:bg-soft transition-colors"
    >
      <Icon className="w-5 h-5 text-purple-400 mb-2" />
      <div className="text-xs font-medium text-text-primary mb-1">{title}</div>
      <div className="text-[11px] text-text-muted leading-relaxed">{desc}</div>
    </button>
  );
}

export function HomePanel() {
  const clients = useClientsStore((s) => s.clients);
  const serverRunning = useClientsStore((s) => s.serverRunning);
  const serverAddress = useClientsStore((s) => s.serverAddress);
  const events = useEventsStore((s) => s.events);
  const setPanel = useUIStore((s) => s.setPanel);

  const clientCount = Object.keys(clients).length;
  const goto = (p: PanelKey) => setPanel(p);

  return (
    <div className="flex-1 min-h-0 overflow-auto">
      <div className="max-w-3xl mx-auto px-6 py-8 space-y-8">
        <header className="flex items-center gap-4">
          <img src="/logo.png" alt="OwlScope" className="w-12 h-12" draggable={false} />
          <div>
            <h1 className="text-xl font-semibold text-text-primary">OwlScope</h1>
            <p className="text-xs text-text-muted">
              Universal debug &amp; monitoring tool — Flutter, JS, more soon.
            </p>
          </div>
        </header>

        <section>
          <h2 className="text-[11px] uppercase tracking-wider text-text-muted mb-2">
            Status
          </h2>
          <div className="rounded-lg border border-border-subtle bg-bg-elevated px-4 py-2">
            <StatRow
              label="Server"
              value={serverRunning ? `running · ${serverAddress}` : 'stopped'}
            />
            <StatRow
              label="Clients connected"
              value={
                clientCount === 0 ? 'waiting…' : `${clientCount} connected`
              }
            />
            <StatRow label="Events captured" value={String(events.length)} />
          </div>
        </section>

        <section>
          <h2 className="text-[11px] uppercase tracking-wider text-text-muted mb-2">
            Jump to
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <ShortcutCard
              icon={ScrollText}
              title="Logs"
              desc="Console output, prints, errors from your app."
              onClick={() => goto('logs')}
            />
            <ShortcutCard
              icon={Plug}
              title="Network"
              desc="Every HTTP request and response with full body."
              onClick={() => goto('network')}
            />
          </div>
        </section>

        <section>
          <h2 className="text-[11px] uppercase tracking-wider text-text-muted mb-2">
            Quick start — Flutter
          </h2>
          <pre className="rounded-lg border border-border-subtle bg-bg-elevated p-4 text-[11px] text-text-primary overflow-auto leading-relaxed">
{QUICK_START}
          </pre>
          <p className="mt-2 text-[11px] text-text-muted">
            Add <code className="font-mono">owlscope</code> to{' '}
            <code className="font-mono">pubspec.yaml</code>, then for a physical
            Android device run{' '}
            <code className="font-mono">dart run owlscope:reverse</code> once.
          </p>
        </section>

        <section>
          <h2 className="text-[11px] uppercase tracking-wider text-text-muted mb-2">
            Quick start — JavaScript / React Native
          </h2>
          <pre className="rounded-lg border border-border-subtle bg-bg-elevated p-4 text-[11px] text-text-primary overflow-auto leading-relaxed">
{QUICK_START_JS}
          </pre>
        </section>

        <section className="pt-2">
          <a
            href="https://github.com/anthropics/owlscope"
            onClick={(e) => {
              e.preventDefault();
              window.open('https://github.com/anthropics/owlscope', '_blank');
            }}
            className="inline-flex items-center gap-2 text-xs text-text-secondary hover:text-text-primary"
          >
            <Github className="w-4 h-4" /> GitHub &amp; documentation
          </a>
          <span className="mx-2 text-text-muted">·</span>
          <button
            onClick={() => goto('errors')}
            className="inline-flex items-center gap-2 text-xs text-text-secondary hover:text-text-primary"
          >
            <Zap className="w-4 h-4" /> Errors panel
          </button>
        </section>
      </div>
    </div>
  );
}
