import type { LogLevel, Platform, EventType, DebugEvent } from '@owlscope/protocol';

export type { LogLevel, Platform, EventType, DebugEvent };

export interface TransportOptions {
  host?: string;
  port?: number;
  url?: string;
  reconnectIntervalMs?: number;
  maxQueueSize?: number;
}

export interface PluginConfig {
  console?: boolean;
  network?: boolean;
  errors?: boolean;
  performance?: boolean;
  storage?: boolean;
  redux?: boolean;
  // Allow additional adapter-driven plugins:
  [k: string]: boolean | undefined;
}

export interface ClientOptions {
  name?: string;
  version?: string;
  platform?: Platform;
  framework?: string;
  host?: string;
  port?: number;
  url?: string;
  enabled?: boolean;
  silent?: boolean;
  autoDetect?: boolean;
  plugins?: PluginConfig;
  redact?: string[];
  transport?: TransportOptions;
}

export interface OwlScopePlugin {
  name: string;
  install(client: OwlScopeClientApi): void;
  uninstall?(): void;
}

export interface OwlScopeClientApi {
  emit(event: Omit<DebugEvent, 'id' | 'timestamp' | 'source'> & { source?: string }): void;
  log(...args: unknown[]): void;
  info(...args: unknown[]): void;
  warn(...args: unknown[]): void;
  error(...args: unknown[]): void;
  debug(...args: unknown[]): void;
  event(name: string, payload?: unknown): void;
}
