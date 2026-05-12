import { useEffect, useMemo, useState } from 'react';
import { Activity, BarChart3, Cpu, MemoryStick, Thermometer, Battery } from 'lucide-react';
import {
  apdexScore,
  usePerfStore,
  withinWindow,
  type FrameSample,
  type JankEvent,
} from '@/store/performance';
import { useClientsStore } from '@/store/clients';
import { useEventsStore } from '@/store/events';
import { LineChart } from '@/components/perf/LineChart';

const WINDOWS: { label: string; seconds: number }[] = [
  { label: '30s', seconds: 30 },
  { label: '1m', seconds: 60 },
  { label: '5m', seconds: 300 },
];

interface KpiCardProps {
  icon: typeof Activity;
  label: string;
  value: string;
  hint?: string;
  tone?: 'default' | 'good' | 'warn' | 'bad';
}

function KpiCard({ icon: Icon, label, value, hint, tone = 'default' }: KpiCardProps) {
  const toneColor = {
    default: 'text-purple-300',
    good: 'text-owl-success',
    warn: 'text-owl-warn',
    bad: 'text-owl-error',
  }[tone];
  return (
    <div className="rounded-md border border-border-subtle bg-bg-elevated px-3 py-2.5">
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-text-muted">
        <Icon className="w-3 h-3" />
        {label}
      </div>
      <div className={`mt-1 font-mono text-lg font-semibold ${toneColor}`}>{value}</div>
      {hint && <div className="text-[10px] text-text-muted mt-0.5">{hint}</div>}
    </div>
  );
}

function fpsTone(fps: number): 'good' | 'warn' | 'bad' | 'default' {
  if (fps >= 55) return 'good';
  if (fps >= 30) return 'warn';
  if (fps > 0) return 'bad';
  return 'default';
}

function apdexTone(score: number): 'good' | 'warn' | 'bad' {
  if (score >= 85) return 'good';
  if (score >= 70) return 'warn';
  return 'bad';
}

function FrameBudgetHistogram({ samples }: { samples: FrameSample[] }) {
  // Bucket avg-build-ms across all sampled windows.
  const buckets = useMemo(() => {
    const out = [
      { label: '0–4ms', count: 0, color: '#4ade80' },
      { label: '4–8ms', count: 0, color: '#a78bfa' },
      { label: '8–16ms', count: 0, color: '#fbbf24' },
      { label: '16–32ms', count: 0, color: '#fb923c' },
      { label: '>32ms', count: 0, color: '#f87171' },
    ];
    for (const s of samples) {
      const v = Math.max(s.avgBuildMs, s.avgRasterMs);
      if (v < 4) out[0].count++;
      else if (v < 8) out[1].count++;
      else if (v < 16) out[2].count++;
      else if (v < 32) out[3].count++;
      else out[4].count++;
    }
    return out;
  }, [samples]);

  const max = Math.max(1, ...buckets.map((b) => b.count));

  return (
    <div className="rounded-md border border-border-subtle bg-bg-elevated p-3">
      <div className="text-[10px] uppercase tracking-wider text-text-muted mb-3">
        Frame budget distribution
      </div>
      <div className="space-y-1.5">
        {buckets.map((b) => (
          <div key={b.label} className="flex items-center gap-2">
            <div className="w-14 text-[10px] font-mono text-text-muted">{b.label}</div>
            <div className="flex-1 h-3 bg-bg-primary rounded-sm overflow-hidden">
              <div
                className="h-full rounded-sm"
                style={{ width: `${(b.count / max) * 100}%`, background: b.color, opacity: 0.85 }}
              />
            </div>
            <div className="w-10 text-right text-[10px] font-mono text-text-secondary">
              {b.count}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TopRebuilders() {
  const rebuilds = usePerfStore((s) => s.rebuilds);
  const aggregated = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of rebuilds) {
      for (const w of r.topWidgets) {
        map.set(w.name, (map.get(w.name) ?? 0) + w.count);
      }
    }
    return Array.from(map.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [rebuilds]);

  const total = aggregated.reduce((acc, w) => acc + w.count, 0);
  const max = Math.max(1, ...aggregated.map((w) => w.count));

  return (
    <div className="rounded-md border border-border-subtle bg-bg-elevated p-3">
      <div className="flex items-baseline justify-between mb-3">
        <div className="text-[10px] uppercase tracking-wider text-text-muted">
          Top rebuilders
        </div>
        <div className="text-[10px] text-text-muted">
          {total > 0 ? `${total.toLocaleString()} total` : 'no data yet'}
        </div>
      </div>
      <div className="space-y-1.5">
        {aggregated.length === 0 ? (
          <div className="text-[11px] text-text-muted py-4 text-center">
            Nothing tracked yet — rebuild stats only flow in debug builds.
          </div>
        ) : (
          aggregated.map((w) => (
            <div key={w.name} className="flex items-center gap-2">
              <div className="flex-1 min-w-0 text-[11px] truncate text-text-primary font-mono">
                {w.name}
              </div>
              <div className="w-32 h-3 bg-bg-primary rounded-sm overflow-hidden">
                <div
                  className="h-full bg-purple-500/70 rounded-sm"
                  style={{ width: `${(w.count / max) * 100}%` }}
                />
              </div>
              <div className="w-12 text-right text-[10px] font-mono text-text-secondary">
                {w.count.toLocaleString()}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export function PerformancePanel() {
  const frame = usePerfStore((s) => s.frame);
  const memory = usePerfStore((s) => s.memory);
  const janks = usePerfStore((s) => s.janks);
  const thermal = usePerfStore((s) => s.thermal);
  const ewmaFps = usePerfStore((s) => s.ewmaFps);

  const [windowSec, setWindowSec] = useState(60);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const fSlice = useMemo(() => withinWindow(frame, windowSec, now), [frame, windowSec, now]);
  const mSlice = useMemo(() => withinWindow(memory, windowSec, now), [memory, windowSec, now]);
  const jSlice = useMemo(() => withinWindow(janks, windowSec, now), [janks, windowSec, now]);

  const apdex = useMemo(() => apdexScore(fSlice), [fSlice]);
  const latestMem = mSlice.length > 0 ? mSlice[mSlice.length - 1] : null;
  const peakMem = useMemo(
    () => (mSlice.length > 0 ? Math.max(...mSlice.map((s) => s.rssMb)) : 0),
    [mSlice],
  );
  const totalJanks = jSlice.length;
  const frozen = jSlice.filter((j) => j.frozen).length;

  const fpsSeries = useMemo(
    () => fSlice.map((s) => ({ t: s.t, v: s.fps })),
    [fSlice],
  );
  const buildSeries = useMemo(
    () => fSlice.map((s) => ({ t: s.t, v: s.avgBuildMs })),
    [fSlice],
  );
  const rasterSeries = useMemo(
    () => fSlice.map((s) => ({ t: s.t, v: s.avgRasterMs })),
    [fSlice],
  );
  const memorySeries = useMemo(
    () => mSlice.map((s) => ({ t: s.t, v: s.rssMb })),
    [mSlice],
  );

  const jankMarkers = useMemo(
    () =>
      jSlice.map((j) => ({
        t: j.t,
        color: j.frozen ? '#dc2626' : '#f87171',
        title: `${j.frozen ? 'frozen' : 'jank'} · build ${j.buildMs.toFixed(1)}ms · raster ${j.rasterMs.toFixed(1)}ms`,
      })),
    [jSlice],
  );

  const empty = frame.length === 0 && memory.length === 0;

  return (
    <div className="flex-1 min-h-0 overflow-auto bg-bg-primary">
      <div className="px-4 py-3 flex items-center justify-between gap-3 border-b border-border-subtle bg-bg-surface sticky top-0 z-10">
        <div>
          <div className="text-xs text-text-secondary font-medium">Performance</div>
          <div className="text-[10px] text-text-muted mt-0.5">
            {empty
              ? 'Waiting for frame & memory samples from the SDK…'
              : `${fSlice.length} frame samples · ${jSlice.length} janks · last ${windowSec}s`}
          </div>
        </div>
        <div className="flex items-center gap-1">
          {WINDOWS.map((w) => (
            <button
              key={w.label}
              onClick={() => setWindowSec(w.seconds)}
              className={`text-[11px] px-2 py-1 rounded border transition-colors ${
                windowSec === w.seconds
                  ? 'border-purple-500/40 bg-purple-500/10 text-purple-300'
                  : 'border-border-subtle bg-bg-elevated text-text-muted hover:text-text-primary'
              }`}
            >
              {w.label}
            </button>
          ))}
        </div>
      </div>

      {empty ? (
        <PerformanceEmptyState />
      ) : (
        <div className="p-4 space-y-4">
          {/* KPI row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <KpiCard
              icon={Activity}
              label="FPS (smoothed)"
              value={ewmaFps > 0 ? ewmaFps.toFixed(1) : '–'}
              hint={
                fSlice.length > 0
                  ? `min ${Math.min(...fSlice.map((s) => s.fps)).toFixed(0)} · max ${Math.max(...fSlice.map((s) => s.fps)).toFixed(0)}`
                  : undefined
              }
              tone={fpsTone(ewmaFps)}
            />
            <KpiCard
              icon={MemoryStick}
              label="Memory"
              value={latestMem ? `${latestMem.rssMb.toFixed(0)} MB` : '–'}
              hint={peakMem > 0 ? `peak ${peakMem.toFixed(0)} MB` : undefined}
            />
            <KpiCard
              icon={BarChart3}
              label="Apdex score"
              value={`${apdex}/100`}
              hint={
                totalJanks > 0
                  ? `${totalJanks} jank${totalJanks === 1 ? '' : 's'}${frozen ? ` · ${frozen} frozen` : ''}`
                  : 'no janks'
              }
              tone={apdexTone(apdex)}
            />
            <KpiCard
              icon={thermal && thermal.state !== 'unknown' ? Thermometer : Battery}
              label="Thermal"
              value={
                thermal?.state && thermal.state !== 'unknown'
                  ? thermal.state
                  : thermal?.batteryLevel !== undefined
                    ? `${thermal.batteryLevel}%`
                    : 'unknown'
              }
              hint={
                thermal?.cpuTempC !== undefined
                  ? `${thermal.cpuTempC.toFixed(1)} °C`
                  : thermal?.batteryTempC !== undefined
                    ? `${thermal.batteryTempC.toFixed(1)} °C battery`
                    : 'no native sensor yet'
              }
              tone={
                thermal?.state === 'critical'
                  ? 'bad'
                  : thermal?.state === 'serious'
                    ? 'warn'
                    : 'default'
              }
            />
          </div>

          {/* FPS chart with jank markers */}
          <div className="rounded-md border border-border-subtle bg-bg-elevated p-3">
            <LineChart
              title="FPS"
              unit="fps"
              data={fpsSeries}
              windowMs={windowSec * 1000}
              now={now}
              yMin={0}
              yMax={70}
              thresholds={[
                { y: 60, color: '#4ade80', label: '60' },
                { y: 30, color: '#fbbf24', label: '30' },
              ]}
              markers={jankMarkers}
              color="#a78bfa"
              formatY={(v) => v.toFixed(0)}
              height={140}
            />
          </div>

          {/* Build/Raster + Memory side-by-side */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <div className="rounded-md border border-border-subtle bg-bg-elevated p-3">
              <LineChart
                title="Build / Raster (avg ms)"
                unit="ms"
                data={buildSeries}
                windowMs={windowSec * 1000}
                now={now}
                yMin={0}
                thresholds={[{ y: 16, color: '#fbbf24', label: '16ms budget' }]}
                color="#a78bfa"
                formatY={(v) => v.toFixed(1)}
                height={140}
              />
              <div className="-mt-1">
                <LineChart
                  data={rasterSeries}
                  windowMs={windowSec * 1000}
                  now={now}
                  yMin={0}
                  color="#2dd4bf"
                  formatY={(v) => v.toFixed(1)}
                  unit="ms raster"
                  height={86}
                />
              </div>
            </div>

            <div className="rounded-md border border-border-subtle bg-bg-elevated p-3">
              <LineChart
                title="Memory (RSS)"
                unit="MB"
                data={memorySeries}
                windowMs={windowSec * 1000}
                now={now}
                color="#60a5fa"
                formatY={(v) => v.toFixed(0)}
                height={236}
              />
            </div>
          </div>

          {/* Histogram + rebuilders */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <FrameBudgetHistogram samples={fSlice} />
            <TopRebuilders />
          </div>

          {/* Jank list */}
          {jSlice.length > 0 && (
            <div className="rounded-md border border-border-subtle bg-bg-elevated p-3">
              <div className="text-[10px] uppercase tracking-wider text-text-muted mb-2 flex items-center gap-1.5">
                <Cpu className="w-3 h-3" />
                Recent janks
              </div>
              <JankList items={jSlice.slice(-12).reverse()} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Platform-aware help shown when no perf samples have arrived yet. We
 *  detect what's already connected and show the matching setup steps —
 *  including a prominent "native module not linked" diagnostic when an
 *  RN client emitted a `[owlscope] OwlScopePerf native module NOT
 *  linked…` warning into the Logs panel. That warning is the SDK's own
 *  self-check, so surfacing it here saves developers from hunting
 *  through the timeline. */
function PerformanceEmptyState() {
  const clients = useClientsStore((s) => s.clients);
  const events = useEventsStore((s) => s.events);

  const platforms = useMemo(() => {
    const set = new Set<string>();
    for (const c of Object.values(clients)) set.add(c.handshake.platform);
    return set;
  }, [clients]);

  const hasRn = platforms.has('react-native');
  const hasFlutter = platforms.has('flutter');

  // Find the most recent OwlScopePerf self-diagnostic (emitted by
  // `startOwlScope()` in the SDK). Tells us definitively whether the
  // native module is linked.
  const perfDiag = useMemo(() => {
    for (let i = events.length - 1; i >= 0; i--) {
      const e = events[i];
      if (e.type !== 'console') continue;
      const args = (e.payload as { args?: unknown[] } | null)?.args;
      const text = Array.isArray(args)
        ? args.map((a) => (typeof a === 'string' ? a : '')).join(' ')
        : '';
      if (text.includes('[owlscope] native perf module linked')) {
        return { state: 'linked' as const };
      }
      if (text.includes('OwlScopePerf native module NOT linked')) {
        return { state: 'not-linked' as const, message: text };
      }
    }
    return null;
  }, [events]);

  return (
    <div className="flex-1 flex items-start justify-center text-text-muted text-xs py-12 px-4">
      <div className="max-w-2xl w-full space-y-4">
        <div className="text-center">
          <Activity className="w-8 h-8 mx-auto text-text-muted/40 mb-3" />
          <p className="text-text-secondary">No performance samples yet.</p>
        </div>

        {perfDiag?.state === 'not-linked' && (
          <div className="rounded-md border border-owl-warn/40 bg-owl-warn/5 p-3 text-[11px] leading-relaxed">
            <div className="text-owl-warn font-semibold mb-1">
              ⚠ Native perf module not linked
            </div>
            <p className="text-text-secondary mb-2">
              The OwlScope SDK is connected, but the iOS / Android native module isn't loaded.
              JS-only metrics can't reach this panel without it.
            </p>
            <div className="font-mono text-text-primary bg-bg-elevated rounded px-2 py-1.5 text-[10px]">
              # rebuild — Metro reload alone is not enough{'\n'}
              {hasRn && Object.values(clients).some((c) => c.handshake.framework === 'iOS')
                ? 'cd ios && pod install && cd ..\nnpx react-native run-ios'
                : 'npx react-native run-android'}
            </div>
            {hasRn && (
              <p className="mt-2 text-text-muted">
                If autolinking didn't pick up <code className="font-mono">owlscope</code>, also try{' '}
                <code className="font-mono">npx react-native config | grep owlscope</code> — the
                package should appear in the dependency map.
              </p>
            )}
          </div>
        )}

        {perfDiag?.state === 'linked' && (
          <div className="rounded-md border border-owl-success/40 bg-owl-success/5 p-3 text-[11px]">
            <div className="text-owl-success font-semibold">✓ Native module linked</div>
            <p className="text-text-secondary mt-0.5">
              Waiting for the first 1 Hz sample (typically arrives within a second of app launch).
              If nothing appears in 5–10 s, force-reload the app.
            </p>
          </div>
        )}

        {hasFlutter && (
          <div className="rounded-md border border-border-subtle bg-bg-elevated p-3 text-[11px]">
            <div className="text-text-secondary font-semibold mb-1">Flutter setup</div>
            <p className="text-text-muted">
              Make sure your app uses{' '}
              <code className="font-mono text-purple-300">PerformancePlugin()</code> and is
              running in <code className="font-mono">kDebugMode</code> or{' '}
              <code className="font-mono">profile</code> mode.
            </p>
          </div>
        )}

        {hasRn && !perfDiag && (
          <div className="rounded-md border border-border-subtle bg-bg-elevated p-3 text-[11px]">
            <div className="text-text-secondary font-semibold mb-1">React Native setup</div>
            <p className="text-text-muted">
              Restart the SDK with <code className="font-mono">silent: false</code> or just wait — the
              first call to <code className="font-mono">startOwlScope()</code> emits a self-check
              that will show up here within a second.
            </p>
          </div>
        )}

        {!hasRn && !hasFlutter && (
          <div className="rounded-md border border-border-subtle bg-bg-elevated p-3 text-[11px] text-text-muted">
            No client connected yet. Once your app calls{' '}
            <code className="font-mono text-purple-300">startOwlScope()</code> (RN) or{' '}
            <code className="font-mono text-purple-300">owlscopeAuto()</code> (Flutter) and the
            handshake completes, this panel populates automatically.
          </div>
        )}
      </div>
    </div>
  );
}

function JankList({ items }: { items: JankEvent[] }) {
  return (
    <div className="space-y-1">
      {items.map((j, i) => (
        <div
          key={`${j.t}-${i}`}
          className={`flex items-center gap-3 px-2 py-1 rounded text-[11px] font-mono ${
            j.frozen ? 'bg-owl-error/10 text-owl-error' : 'bg-owl-warn/10 text-owl-warn'
          }`}
        >
          <span className="w-20 tabular-nums text-text-muted">
            {new Date(j.t).toTimeString().slice(0, 8)}
          </span>
          <span className="w-16 uppercase text-[10px] tracking-wider">
            {j.frozen ? 'frozen' : 'jank'}
          </span>
          <span className="flex-1">
            build <span className="font-semibold">{j.buildMs.toFixed(1)}ms</span>
            <span className="text-text-muted mx-2">·</span>
            raster <span className="font-semibold">{j.rasterMs.toFixed(1)}ms</span>
          </span>
        </div>
      ))}
    </div>
  );
}

