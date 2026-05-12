import { OwlScopeClient } from './core/client.js';
import { ConsolePlugin } from './plugins/console.js';
import { NetworkFetchPlugin } from './plugins/network-fetch.js';
import { NetworkXhrPlugin } from './plugins/network-xhr.js';
import { ErrorsPlugin } from './plugins/errors.js';
import type { ClientOptions } from './types.js';

export { OwlScopeClient } from './core/client.js';
export { ConsolePlugin } from './plugins/console.js';
export { NetworkFetchPlugin } from './plugins/network-fetch.js';
export { NetworkXhrPlugin } from './plugins/network-xhr.js';
export { ErrorsPlugin } from './plugins/errors.js';
// Plugins/performance is RN-only at runtime (depends on react-native).
// We do not re-export it from the universal entry to avoid pulling
// react-native into Node / Web bundles. Consumers wire it up via
// `owlscope/rn` automatically.
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
  const g = globalThis as unknown as {
    fetch?: typeof fetch;
    XMLHttpRequest?: unknown;
    ErrorUtils?: unknown;
    process?: { on?: (...a: unknown[]) => void };
  };

  if (cfg.console !== false) {
    client.use(new ConsolePlugin());
  }

  if (cfg.network !== false) {
    if (typeof g.fetch === 'function') {
      client.use(new NetworkFetchPlugin());
    }
    if (typeof g.XMLHttpRequest !== 'undefined') {
      client.use(new NetworkXhrPlugin());
    }
  }

  // ErrorsPlugin self-detects React Native (`ErrorUtils.setGlobalHandler`),
  // browser (`window.onerror`), or Node. Install whenever one is reachable.
  if (cfg.errors !== false) {
    const hasBrowser =
      typeof window !== 'undefined' && typeof window.addEventListener === 'function';
    const hasRn = typeof g.ErrorUtils === 'object' && g.ErrorUtils !== null;
    const hasNode = typeof g.process?.on === 'function';
    if (hasBrowser || hasRn || hasNode) {
      client.use(new ErrorsPlugin());
    }
  }
}
