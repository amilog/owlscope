import type { OwlScopeClientApi, OwlScopePlugin } from '../types.js';

export interface PerformancePluginOptions {
  entryTypes?: string[];
  ignoreResource?: (RegExp | string)[];
}

const DEFAULT_TYPES = ['measure', 'mark', 'navigation', 'longtask'];

function shouldIgnore(name: string, ignore: (RegExp | string)[]): boolean {
  for (const r of ignore) {
    if (typeof r === 'string' && name.includes(r)) return true;
    if (r instanceof RegExp && r.test(name)) return true;
  }
  return false;
}

export class PerformancePlugin implements OwlScopePlugin {
  name = 'performance';
  private observers: PerformanceObserver[] = [];
  private entryTypes: string[];
  private ignoreResource: (RegExp | string)[];

  constructor(opts: PerformancePluginOptions = {}) {
    this.entryTypes = opts.entryTypes ?? DEFAULT_TYPES;
    this.ignoreResource = opts.ignoreResource ?? [];
  }

  install(client: OwlScopeClientApi): void {
    if (typeof PerformanceObserver === 'undefined') return;

    const supported = (PerformanceObserver as unknown as { supportedEntryTypes?: string[] })
      .supportedEntryTypes;

    for (const entryType of this.entryTypes) {
      if (supported && !supported.includes(entryType)) continue;
      try {
        const obs = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.entryType === 'resource' && shouldIgnore(entry.name, this.ignoreResource)) {
              continue;
            }
            try {
              client.emit({
                type: 'performance',
                payload: this.serializeEntry(entry),
                meta: { duration: entry.duration },
              });
            } catch {
              /* ignore */
            }
          }
        });
        obs.observe({ type: entryType, buffered: false });
        this.observers.push(obs);
      } catch {
        /* unsupported in this env */
      }
    }
  }

  private serializeEntry(entry: PerformanceEntry): Record<string, unknown> {
    const base: Record<string, unknown> = {
      entryType: entry.entryType,
      name: entry.name,
      startTime: Math.round(entry.startTime),
      duration: Math.round(entry.duration),
    };
    if (entry.entryType === 'resource') {
      const r = entry as PerformanceResourceTiming;
      base.initiatorType = r.initiatorType;
      base.transferSize = r.transferSize;
      base.encodedBodySize = r.encodedBodySize;
      base.responseEnd = Math.round(r.responseEnd);
    }
    if (entry.entryType === 'navigation') {
      const n = entry as PerformanceNavigationTiming;
      base.domContentLoaded = Math.round(n.domContentLoadedEventEnd);
      base.loadEvent = Math.round(n.loadEventEnd);
      base.transferSize = n.transferSize;
    }
    if (entry.entryType === 'longtask') {
      base.severity = entry.duration > 100 ? 'critical' : 'warning';
    }
    return base;
  }

  uninstall(): void {
    for (const obs of this.observers) {
      try {
        obs.disconnect();
      } catch {
        /* ignore */
      }
    }
    this.observers = [];
  }
}
