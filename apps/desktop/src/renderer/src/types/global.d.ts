import type { DebugEvent, ConnectedClient } from '@owlscope/protocol';

export type IncomingPayload =
  | { kind: 'client:connected'; client: ConnectedClient }
  | { kind: 'client:disconnected'; clientId: string }
  | { kind: 'event'; event: DebugEvent }
  | { kind: 'events'; events: DebugEvent[] }
  | { kind: 'server:status'; running: boolean; port: number; address: string };

declare global {
  interface Window {
    owlscope: {
      onIncoming: (handler: (payload: IncomingPayload) => void) => () => void;
      getClients: () => Promise<ConnectedClient[]>;
      getServerStatus: () => Promise<{ running: boolean; port: number; address: string }>;
      restartServer: () => Promise<boolean>;
      setAlwaysOnTop: (value: boolean) => Promise<boolean>;
    };
  }
}

export {};
