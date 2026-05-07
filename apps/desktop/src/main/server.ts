import { WebSocketServer, WebSocket } from 'ws';
import { randomUUID } from 'node:crypto';
import type {
  ClientToServerMessage,
  DebugEvent,
  HandshakePayload,
  ConnectedClient,
} from '@owlscope/protocol';
import { DEFAULT_PORT } from '@owlscope/protocol';

export type IncomingEvent =
  | { kind: 'client:connected'; client: ConnectedClient }
  | { kind: 'client:disconnected'; clientId: string }
  | { kind: 'event'; event: DebugEvent }
  | { kind: 'events'; events: DebugEvent[] }
  | { kind: 'server:status'; running: boolean; port: number; address: string };

interface ClientState {
  socket: WebSocket;
  clientId: string;
  handshake?: HandshakePayload;
  connectedAt: number;
  lastSeenAt: number;
  buffer: DebugEvent[];
  flushTimer: NodeJS.Timeout | null;
}

const FLUSH_INTERVAL_MS = 50;
const MAX_BATCH_SIZE = 200;

export class OwlScopeServer {
  private wss: WebSocketServer | null = null;
  private clients = new Map<string, ClientState>();
  private port: number;
  private listeners = new Set<(e: IncomingEvent) => void>();
  private running = false;

  constructor(port = DEFAULT_PORT) {
    this.port = port;
  }

  getStatus(): { running: boolean; port: number; address: string } {
    return {
      running: this.running,
      port: this.port,
      address: `ws://localhost:${this.port}`,
    };
  }

  start() {
    if (this.wss) return;
    // Bind to all interfaces so LAN devices (physical iPhones / Android phones
     // / second machines) can connect. macOS may prompt "Allow incoming
     // connections" the first time — accept it.
    this.wss = new WebSocketServer({ port: this.port, host: '0.0.0.0' });

    this.wss.on('listening', () => {
      this.running = true;
      this.broadcast({
        kind: 'server:status',
        running: true,
        port: this.port,
        address: `ws://localhost:${this.port}`,
      });
    });

    this.wss.on('connection', (socket) => {
      const clientId = randomUUID();
      const state: ClientState = {
        socket,
        clientId,
        connectedAt: Date.now(),
        lastSeenAt: Date.now(),
        buffer: [],
        flushTimer: null,
      };
      this.clients.set(clientId, state);

      try {
        socket.send(JSON.stringify({ type: 'welcome', clientId }));
      } catch {
        /* ignore */
      }

      socket.on('message', (raw) => {
        const text = typeof raw === 'string' ? raw : raw.toString('utf8');
        let msg: ClientToServerMessage;
        try {
          msg = JSON.parse(text) as ClientToServerMessage;
        } catch {
          return;
        }

        state.lastSeenAt = Date.now();

        switch (msg.type) {
          case 'handshake': {
            state.handshake = msg.payload;
            this.broadcast({
              kind: 'client:connected',
              client: {
                clientId,
                handshake: msg.payload,
                connectedAt: state.connectedAt,
                lastSeenAt: state.lastSeenAt,
              },
            });
            break;
          }
          case 'event': {
            const event: DebugEvent = { ...msg.payload, clientId };
            this.queueEvent(state, event);
            break;
          }
          case 'batch': {
            for (const ev of msg.payload) {
              this.queueEvent(state, { ...ev, clientId });
            }
            break;
          }
          case 'ping': {
            try {
              socket.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
            } catch {
              /* ignore */
            }
            break;
          }
          case 'pong':
            break;
        }
      });

      socket.on('close', () => {
        if (state.flushTimer) clearTimeout(state.flushTimer);
        this.flush(state);
        this.clients.delete(clientId);
        this.broadcast({ kind: 'client:disconnected', clientId });
      });

      socket.on('error', () => {
        // close handler will run too
      });
    });

    this.wss.on('error', (err: NodeJS.ErrnoException) => {
      console.error('[owlscope-server] error', err);
      this.running = false;
      this.broadcast({
        kind: 'server:status',
        running: false,
        port: this.port,
        address:
          err.code === 'EADDRINUSE'
            ? `port ${this.port} in use — kill stale process`
            : `ws://localhost:${this.port}`,
      });
    });
  }

  stop() {
    for (const state of this.clients.values()) {
      if (state.flushTimer) clearTimeout(state.flushTimer);
      try {
        state.socket.close();
      } catch {
        /* ignore */
      }
    }
    this.clients.clear();
    if (this.wss) {
      this.wss.close();
      this.wss = null;
    }
    this.running = false;
    this.broadcast({
      kind: 'server:status',
      running: false,
      port: this.port,
      address: `ws://localhost:${this.port}`,
    });
  }

  onEvent(handler: (e: IncomingEvent) => void) {
    this.listeners.add(handler);
    return () => this.listeners.delete(handler);
  }

  private broadcast(e: IncomingEvent) {
    for (const fn of this.listeners) {
      try {
        fn(e);
      } catch {
        /* ignore */
      }
    }
  }

  private queueEvent(state: ClientState, event: DebugEvent) {
    state.buffer.push(event);
    if (state.buffer.length >= MAX_BATCH_SIZE) {
      this.flush(state);
      return;
    }
    if (!state.flushTimer) {
      state.flushTimer = setTimeout(() => this.flush(state), FLUSH_INTERVAL_MS);
    }
  }

  private flush(state: ClientState) {
    if (state.flushTimer) {
      clearTimeout(state.flushTimer);
      state.flushTimer = null;
    }
    if (state.buffer.length === 0) return;
    const events = state.buffer;
    state.buffer = [];
    if (events.length === 1) {
      this.broadcast({ kind: 'event', event: events[0] });
    } else {
      this.broadcast({ kind: 'events', events });
    }
  }

  getConnectedClients(): ConnectedClient[] {
    const out: ConnectedClient[] = [];
    for (const s of this.clients.values()) {
      if (!s.handshake) continue;
      out.push({
        clientId: s.clientId,
        handshake: s.handshake,
        connectedAt: s.connectedAt,
        lastSeenAt: s.lastSeenAt,
      });
    }
    return out;
  }
}
