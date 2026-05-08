// Vendored from protocol.js so the published tarball is self-
// contained — RN consumers shouldn't need to install a second monorepo
// package just for type definitions. Keep this in sync with
// `packages/protocol/src/index.ts`.

export type LogLevel = 'log' | 'info' | 'warn' | 'error' | 'debug';

export type EventType =
  | 'console'
  | 'network:request'
  | 'network:response'
  | 'redux:action'
  | 'state:change'
  | 'error'
  | 'custom'
  | 'performance'
  | 'performance:frame'
  | 'performance:memory'
  | 'performance:jank'
  | 'performance:rebuilds'
  | 'performance:thermal'
  | 'storage'
  | 'widget:rebuild'
  | 'navigation:push'
  | 'navigation:pop'
  | 'bloc:transition'
  | 'provider:change';

export type Platform = 'web' | 'node' | 'react-native' | 'electron' | 'flutter';

export interface EventMeta {
  stackTrace?: string;
  duration?: number;
  size?: number;
  correlationId?: string;
  source?: string;
}

export interface DebugEvent<TPayload = unknown> {
  id: string;
  type: EventType;
  level?: LogLevel;
  timestamp: number;
  source: string;
  clientId?: string;
  payload: TPayload;
  meta?: EventMeta;
}

export interface HandshakePayload {
  name: string;
  version: string;
  platform: Platform;
  framework?: string;
  userAgent?: string;
  sessionId: string;
  capabilities: string[];
}

export interface HandshakeMessage {
  type: 'handshake';
  payload: HandshakePayload;
}

export interface EventMessage {
  type: 'event';
  payload: DebugEvent;
}

export interface BatchMessage {
  type: 'batch';
  payload: DebugEvent[];
}

export interface PingMessage {
  type: 'ping';
  timestamp: number;
}

export interface PongMessage {
  type: 'pong';
  timestamp: number;
}

export type ServerCommandName =
  | 'redux:jumpTo'
  | 'redux:replay'
  | 'network:replay'
  | 'state:reset';

export interface ServerCommandMessage {
  type: 'command';
  command: ServerCommandName;
  payload: unknown;
}

export type ClientToServerMessage =
  | HandshakeMessage
  | EventMessage
  | BatchMessage
  | PingMessage
  | PongMessage;

export type ServerToClientMessage =
  | ServerCommandMessage
  | PingMessage
  | PongMessage
  | { type: 'welcome'; clientId: string };

export interface ConnectedClient {
  clientId: string;
  handshake: HandshakePayload;
  connectedAt: number;
  lastSeenAt: number;
}

export const DEFAULT_PORT = 9090;
export const DEFAULT_HOST = 'localhost';
export const PROTOCOL_VERSION = '1';
