import type { DebugEvent, EventType, LogLevel, Platform } from '../protocol.js';
import { Transport } from './transport.js';
import { uuidv4 } from './uuid.js';
import { safeClone } from './serializer.js';
import { redact, DEFAULT_REDACT_KEYS } from './redact.js';
import type { ClientOptions, OwlScopeClientApi, OwlScopePlugin } from '../types.js';

interface ProcessLike {
  versions?: { node?: string };
}

function detectPlatform(): Platform {
  if (typeof window !== 'undefined' && typeof document !== 'undefined') return 'web';
  const proc = (globalThis as { process?: ProcessLike }).process;
  if (proc && proc.versions && typeof proc.versions.node === 'string') {
    return 'node';
  }
  return 'web';
}

export class OwlScopeClient implements OwlScopeClientApi {
  private name: string;
  private version: string;
  private platform: Platform;
  private framework?: string;
  private sessionId: string;
  private enabled: boolean;
  private redactKeys: string[];
  private transport: Transport;
  private plugins: OwlScopePlugin[] = [];
  private capabilities: Set<string> = new Set();

  constructor(opts: ClientOptions = {}) {
    this.name = opts.name ?? 'unknown-app';
    this.version = opts.version ?? '0.0.0';
    this.platform = opts.platform ?? detectPlatform();
    this.framework = opts.framework;
    this.sessionId = uuidv4();
    this.enabled = opts.enabled ?? true;
    this.redactKeys = opts.redact ?? DEFAULT_REDACT_KEYS;

    this.transport = new Transport({
      url: opts.url ?? opts.transport?.url,
      host: opts.host ?? opts.transport?.host,
      port: opts.port ?? opts.transport?.port,
      reconnectIntervalMs: opts.transport?.reconnectIntervalMs,
      maxQueueSize: opts.transport?.maxQueueSize,
      silent: opts.silent ?? true,
    });
  }

  use(plugin: OwlScopePlugin): this {
    if (!this.enabled) return this;
    this.plugins.push(plugin);
    this.capabilities.add(plugin.name);
    plugin.install(this);
    return this;
  }

  addCapability(cap: string) {
    this.capabilities.add(cap);
  }

  connect(): this {
    if (!this.enabled) return this;
    this.transport.setHandshake({
      name: this.name,
      version: this.version,
      platform: this.platform,
      framework: this.framework,
      userAgent:
        typeof navigator !== 'undefined' && navigator.userAgent ? navigator.userAgent : undefined,
      sessionId: this.sessionId,
      capabilities: Array.from(this.capabilities),
    });
    this.transport.connect();
    return this;
  }

  disconnect() {
    this.transport.close();
    for (const p of this.plugins) {
      if (p.uninstall) {
        try {
          p.uninstall();
        } catch {
          /* ignore */
        }
      }
    }
    this.plugins = [];
  }

  emit(
    event: Omit<DebugEvent, 'id' | 'timestamp' | 'source'> & { source?: string },
  ): void {
    if (!this.enabled) return;
    const cleaned = redact(safeClone(event.payload), this.redactKeys);
    const full: DebugEvent = {
      id: uuidv4(),
      type: event.type,
      level: event.level,
      timestamp: Date.now(),
      source: event.source ?? this.name,
      payload: cleaned,
      meta: event.meta,
    };
    this.transport.send({ type: 'event', payload: full });
  }

  private logAt(level: LogLevel, args: unknown[]) {
    this.emit({
      type: 'console',
      level,
      payload: { args },
    });
  }

  log(...args: unknown[]) {
    this.logAt('log', args);
  }
  info(...args: unknown[]) {
    this.logAt('info', args);
  }
  warn(...args: unknown[]) {
    this.logAt('warn', args);
  }
  error(...args: unknown[]) {
    this.logAt('error', args);
  }
  debug(...args: unknown[]) {
    this.logAt('debug', args);
  }

  event(name: string, payload?: unknown) {
    this.emit({
      type: 'custom' as EventType,
      payload: { name, data: payload },
    });
  }
}
