import { create } from 'zustand';
import type { DebugEvent } from '@owlscope/protocol';

/** Up to 5 minutes of samples at 1 Hz. Each ring is independently bounded
 *  so a noisy stream can't starve the rest. */
const MAX_SAMPLES = 300;
const MAX_JANKS = 200;

export interface FrameSample {
  t: number;
  fps: number;
  frames: number;
  windowMs: number;
  avgBuildMs: number;
  avgRasterMs: number;
  p99BuildMs: number;
  p99RasterMs: number;
  maxBuildMs: number;
  maxRasterMs: number;
  slowFrames: number;
  frozenFrames: number;
}

export interface MemorySample {
  t: number;
  rssMb: number;
  platform: string;
}

export interface JankEvent {
  t: number;
  buildMs: number;
  rasterMs: number;
  frozen: boolean;
}

export interface RebuildSample {
  t: number;
  total: number;
  unique: number;
  topWidgets: { name: string; count: number }[];
  windowMs: number;
}

export interface ThermalSample {
  t: number;
  state: 'unknown' | 'nominal' | 'fair' | 'serious' | 'critical';
  cpuTempC?: number;
  batteryTempC?: number;
  batteryLevel?: number;
  isCharging?: boolean;
}

interface PerfState {
  frame: FrameSample[];
  memory: MemorySample[];
  janks: JankEvent[];
  rebuilds: RebuildSample[];
  thermal: ThermalSample | null;
  /** Exponentially weighted moving average of FPS — smooth but responsive. */
  ewmaFps: number;

  ingest: (e: DebugEvent) => void;
  reset: () => void;
}

function trim<T>(arr: T[], max: number): T[] {
  return arr.length > max ? arr.slice(arr.length - max) : arr;
}

const EWMA_ALPHA = 0.3;

export const usePerfStore = create<PerfState>((set) => ({
  frame: [],
  memory: [],
  janks: [],
  rebuilds: [],
  thermal: null,
  ewmaFps: 0,

  ingest: (e) => {
    const t = e.timestamp;
    const p = (e.payload ?? {}) as Record<string, unknown>;

    const num = (k: string, def = 0): number => {
      const v = p[k];
      if (typeof v === 'number') return v;
      if (typeof v === 'string') {
        const f = parseFloat(v);
        return Number.isFinite(f) ? f : def;
      }
      return def;
    };
    const str = (k: string, def = ''): string => {
      const v = p[k];
      return typeof v === 'string' ? v : def;
    };

    if (e.type === 'performance:frame' || e.type === 'performance') {
      // Both the new structured `performance:frame` and the legacy aggregate
      // `performance` event are accepted, so the dashboard works with older
      // SDK versions (owlscope < 0.2 only emits the legacy shape).
      const windowMs = num('windowMs', 1000);
      const frames = num('frames');
      const fpsExplicit = num('fps');
      const fps =
        fpsExplicit > 0 ? fpsExplicit : Math.round((frames * 1000.0) / Math.max(1, windowMs));
      const sample: FrameSample = {
        t,
        fps,
        frames,
        windowMs,
        avgBuildMs: num('avgBuildMs'),
        avgRasterMs: num('avgRasterMs'),
        p99BuildMs: num('p99BuildMs', num('maxBuildMs')),
        p99RasterMs: num('p99RasterMs', num('maxRasterMs')),
        maxBuildMs: num('maxBuildMs'),
        maxRasterMs: num('maxRasterMs'),
        slowFrames: num('slowFrames'),
        frozenFrames: num('frozenFrames'),
      };
      set((s) => ({
        frame: trim([...s.frame, sample], MAX_SAMPLES),
        ewmaFps:
          s.ewmaFps === 0 ? sample.fps : EWMA_ALPHA * sample.fps + (1 - EWMA_ALPHA) * s.ewmaFps,
      }));
      return;
    }

    if (e.type === 'performance:memory') {
      const sample: MemorySample = {
        t,
        rssMb: num('rssMb'),
        platform: str('platform', 'unknown'),
      };
      set((s) => ({ memory: trim([...s.memory, sample], MAX_SAMPLES) }));
      return;
    }

    if (e.type === 'performance:jank') {
      const sample: JankEvent = {
        t,
        buildMs: num('buildMs'),
        rasterMs: num('rasterMs'),
        frozen: Boolean(p.frozen),
      };
      set((s) => ({ janks: trim([...s.janks, sample], MAX_JANKS) }));
      return;
    }

    if (e.type === 'performance:rebuilds') {
      const top = Array.isArray(p.topWidgets)
        ? (p.topWidgets as { name?: unknown; count?: unknown }[])
            .map((w) => ({
              name: typeof w.name === 'string' ? w.name : '?',
              count: typeof w.count === 'number' ? w.count : 0,
            }))
            .filter((w) => w.count > 0)
        : [];
      const sample: RebuildSample = {
        t,
        total: num('total'),
        unique: num('unique'),
        topWidgets: top,
        windowMs: num('windowMs', 1000),
      };
      set((s) => ({ rebuilds: trim([...s.rebuilds, sample], MAX_SAMPLES) }));
      return;
    }

    if (e.type === 'performance:thermal') {
      const stateStr = str('state', 'unknown');
      const valid: ThermalSample['state'][] = [
        'unknown',
        'nominal',
        'fair',
        'serious',
        'critical',
      ];
      const sample: ThermalSample = {
        t,
        state: valid.includes(stateStr as ThermalSample['state'])
          ? (stateStr as ThermalSample['state'])
          : 'unknown',
        cpuTempC: typeof p.cpuTempC === 'number' ? p.cpuTempC : undefined,
        batteryTempC: typeof p.batteryTempC === 'number' ? p.batteryTempC : undefined,
        batteryLevel: typeof p.batteryLevel === 'number' ? p.batteryLevel : undefined,
        isCharging: typeof p.isCharging === 'boolean' ? p.isCharging : undefined,
      };
      set({ thermal: sample });
      return;
    }
  },

  reset: () =>
    set({
      frame: [],
      memory: [],
      janks: [],
      rebuilds: [],
      thermal: null,
      ewmaFps: 0,
    }),
}));

/** Apdex score across the given frame samples — `(satisfied + 0.5×tolerating)
 *  / total × 100`. A single 0–100 number that summarises perceived health.
 *
 *  - **Satisfied**: build < 8 ms AND fps ≥ 55 AND no slow frames
 *  - **Tolerating**: build < 16 ms AND fps ≥ 30
 *  - **Frustrated**: anything worse */
export function apdexScore(samples: FrameSample[]): number {
  if (samples.length === 0) return 100;
  let s = 0;
  let t = 0;
  for (const x of samples) {
    if (x.avgBuildMs < 8 && x.fps >= 55 && x.slowFrames === 0) s++;
    else if (x.avgBuildMs < 16 && x.fps >= 30) t++;
  }
  return Math.round(((s + 0.5 * t) / samples.length) * 100);
}

/** Slice samples to a sliding window of the last N seconds. */
export function withinWindow<T extends { t: number }>(
  samples: T[],
  seconds: number,
  now: number,
): T[] {
  const cutoff = now - seconds * 1000;
  // Samples are already in chronological order — find first index inside.
  for (let i = 0; i < samples.length; i++) {
    if (samples[i].t >= cutoff) return samples.slice(i);
  }
  return [];
}
