import { NativeEventEmitter, NativeModules } from 'react-native';
import type { OwlScopeClientApi, OwlScopePlugin } from '../types.js';

interface NativePerf {
  start(): void;
  stop(): void;
  addListener(event: string): void;
  removeListeners(count: number): void;
}

interface PerfSample {
  fps?: number;
  frames?: number;
  avgFrameMs?: number;
  maxFrameMs?: number;
  slowFrames?: number;
  frozenFrames?: number;
  memory?: { rssMb?: number; virtualMb?: number; nativeHeapMb?: number };
  thermal?: { state?: string; headroom?: number; cpuTempC?: number };
  battery?: {
    level?: number;
    state?: string;
    currentNowUa?: number;
    batteryTempC?: number;
    voltageMv?: number;
  };
  platform?: string;
}

const ALLOWED_THERMAL = new Set(['unknown', 'nominal', 'fair', 'serious', 'critical']);

/** Bridges the iOS / Android `OwlScopePerf` native module into the
 *  protocol's `performance:frame`, `performance:memory` and
 *  `performance:thermal` event types. Silently no-ops when the native
 *  module is missing — a developer who hasn't run `pod install` or
 *  resynced Gradle still gets the JS-only data flow. */
export class PerformancePlugin implements OwlScopePlugin {
  name = 'performance';
  private emitter: NativeEventEmitter | null = null;
  private subscription: { remove(): void } | null = null;
  private native: NativePerf | null = null;

  install(client: OwlScopeClientApi): void {
    const native = (NativeModules as { OwlScopePerf?: NativePerf }).OwlScopePerf;
    if (!native) return;
    this.native = native;
    this.emitter = new NativeEventEmitter(native as unknown as never);
    this.subscription = this.emitter.addListener('perf:sample', (s: unknown) =>
      this.handle(client, (s ?? {}) as PerfSample),
    );
    try {
      native.start();
    } catch {
      /* no-op if native bridge in a reload window */
    }
  }

  uninstall(): void {
    try {
      this.native?.stop();
    } catch {
      /* ignore */
    }
    this.subscription?.remove();
    this.subscription = null;
    this.emitter = null;
    this.native = null;
  }

  private handle(client: OwlScopeClientApi, s: PerfSample): void {
    const platform = s.platform ?? 'react-native';

    if (typeof s.fps === 'number') {
      client.emit({
        type: 'performance:frame',
        payload: {
          fps: s.fps,
          frames: s.frames ?? 0,
          windowMs: 1000,
          avgBuildMs: s.avgFrameMs ?? 0,
          avgRasterMs: 0,
          p99BuildMs: s.maxFrameMs ?? 0,
          p99RasterMs: 0,
          maxBuildMs: s.maxFrameMs ?? 0,
          maxRasterMs: 0,
          slowFrames: s.slowFrames ?? 0,
          frozenFrames: s.frozenFrames ?? 0,
        },
      });
    }

    if (s.memory && typeof s.memory.rssMb === 'number') {
      client.emit({
        type: 'performance:memory',
        payload: {
          rssMb: s.memory.rssMb,
          nativeHeapMb: s.memory.nativeHeapMb,
          virtualMb: s.memory.virtualMb,
          platform,
        },
      });
    }

    const state = ALLOWED_THERMAL.has(s.thermal?.state ?? '') ? s.thermal?.state : 'unknown';
    client.emit({
      type: 'performance:thermal',
      payload: {
        state,
        headroom: s.thermal?.headroom,
        cpuTempC: s.thermal?.cpuTempC,
        batteryTempC: s.battery?.batteryTempC,
        batteryLevel: s.battery?.level,
        isCharging: s.battery?.state === 'charging' || s.battery?.state === 'full',
        currentNowUa: s.battery?.currentNowUa,
        voltageMv: s.battery?.voltageMv,
      },
    });
  }
}
