import { OwlScopeClient } from './core/client.js';
import { ConsolePlugin } from './plugins/console.js';
import { NetworkFetchPlugin } from './plugins/network-fetch.js';
import { NetworkXhrPlugin } from './plugins/network-xhr.js';
import { ErrorsPlugin } from './plugins/errors.js';
import { PerformancePlugin } from './plugins/performance.js';
import { StoragePlugin } from './plugins/storage.js';
import type { ClientOptions } from './types.js';

export { OwlScopeClient } from './core/client.js';
export { ConsolePlugin } from './plugins/console.js';
export { NetworkFetchPlugin } from './plugins/network-fetch.js';
export { NetworkXhrPlugin } from './plugins/network-xhr.js';
export { ErrorsPlugin } from './plugins/errors.js';
export { PerformancePlugin } from './plugins/performance.js';
export { StoragePlugin } from './plugins/storage.js';
export { Transport } from './core/transport.js';
export { safeClone, safeStringify } from './core/serializer.js';
export { redact, DEFAULT_REDACT_KEYS } from './core/redact.js';
export type {
  ClientOptions,
  PluginConfig,
  TransportOptions,
  OwlScopePlugin,
  OwlScopeClientApi,
  LogLevel,
  Platform,
  EventType,
  DebugEvent,
} from './types.js';

let singleton: OwlScopeClient | null = null;

export function createClient(opts: ClientOptions = {}): OwlScopeClient {
  return new OwlScopeClient(opts);
}

export function configure(opts: ClientOptions = {}): OwlScopeClient {
  if (singleton) {
    singleton.disconnect();
  }
  const client = new OwlScopeClient(opts);
  installDefaultPlugins(client, opts);
  client.connect();
  singleton = client;
  return client;
}

export function getClient(): OwlScopeClient | null {
  return singleton;
}

export function installDefaultPlugins(client: OwlScopeClient, opts: ClientOptions = {}) {
  const cfg = opts.plugins ?? {};
  if (cfg.console !== false) {
    client.use(new ConsolePlugin());
  }
  if (cfg.network !== false) {
    if (typeof window !== 'undefined' && typeof window.fetch === 'function') {
      client.use(new NetworkFetchPlugin());
    }
    if (typeof XMLHttpRequest !== 'undefined') {
      client.use(new NetworkXhrPlugin());
    }
  }
  if (cfg.errors !== false && typeof window !== 'undefined') {
    client.use(new ErrorsPlugin());
  }
  if (cfg.performance !== false && typeof PerformanceObserver !== 'undefined') {
    client.use(new PerformancePlugin());
  }
  if (cfg.storage !== false && typeof window !== 'undefined') {
    client.use(new StoragePlugin());
  }
}
