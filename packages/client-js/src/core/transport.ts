import type {
  ClientToServerMessage,
  ServerToClientMessage,
  HandshakePayload,
} from '../protocol.js';

// Inlined so the published SDK has no runtime dependency on the
// monorepo-local `../protocol.js` package — only its types.
const DEFAULT_HOST = 'localhost';
const DEFAULT_PORT = 9090;

export interface TransportConfig {
  url?: string;
  host?: string;
  port?: number;
  reconnectIntervalMs?: number;
  maxQueueSize?: number;
  silent?: boolean;
}

type ConnectionState = 'idle' | 'connecting' | 'open' | 'closed';

type WSCtor = new (url: string) => WebSocket;

function resolveWebSocket(): WSCtor | null {
  const g = globalThis as { WebSocket?: WSCtor };
  if (g.WebSocket) return g.WebSocket;
  return null;
}

export class Transport {
  private url: string;
  private reconnectIntervalMs: number;
  private maxQueueSize: number;
  private silent: boolean;

  private ws: WebSocket | null = null;
  private state: ConnectionState = 'idle';
  private queue: ClientToServerMessage[] = [];
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;

  private handshakePayload: HandshakePayload | null = null;
  private onCommand: ((msg: ServerToClientMessage) => void) | null = null;

  constructor(config: TransportConfig = {}) {
    const host = config.host ?? DEFAULT_HOST;
    const port = config.port ?? DEFAULT_PORT;
    this.url = config.url ?? `ws://${host}:${port}`;
    this.reconnectIntervalMs = config.reconnectIntervalMs ?? 2000;
    this.maxQueueSize = config.maxQueueSize ?? 1000;
    this.silent = config.silent ?? true;
  }

  setHandshake(payload: HandshakePayload) {
    this.handshakePayload = payload;
  }

  onMessage(handler: (msg: ServerToClientMessage) => void) {
    this.onCommand = handler;
  }

  connect() {
    if (this.state === 'connecting' || this.state === 'open') return;
    const WS = resolveWebSocket();
    if (!WS) {
      if (!this.silent) {
        // eslint-disable-next-line no-console
        console.warn('[owlscope] WebSocket not available in this environment.');
      }
      return;
    }

    this.state = 'connecting';
    let socket: WebSocket;
    try {
      socket = new WS(this.url);
    } catch (err) {
      this.state = 'closed';
      this.scheduleReconnect();
      return;
    }
    this.ws = socket;

    socket.addEventListener('open', () => {
      this.state = 'open';
      if (this.handshakePayload) {
        this.sendRaw({ type: 'handshake', payload: this.handshakePayload });
      }
      this.flushQueue();
      this.startHeartbeat();
    });

    socket.addEventListener('message', (ev: MessageEvent) => {
      if (!this.onCommand) return;
      try {
        const data = typeof ev.data === 'string' ? ev.data : '';
        if (!data) return;
        const msg = JSON.parse(data) as ServerToClientMessage;
        this.onCommand(msg);
      } catch {
        /* ignore */
      }
    });

    socket.addEventListener('close', () => {
      this.state = 'closed';
      this.stopHeartbeat();
      this.ws = null;
      this.scheduleReconnect();
    });

    socket.addEventListener('error', () => {
      // close handler will run as well
    });
  }

  send(msg: ClientToServerMessage) {
    if (this.state === 'open' && this.ws) {
      this.sendRaw(msg);
    } else {
      this.queue.push(msg);
      if (this.queue.length > this.maxQueueSize) {
        this.queue.splice(0, this.queue.length - this.maxQueueSize);
      }
    }
  }

  private sendRaw(msg: ClientToServerMessage) {
    if (!this.ws) return;
    try {
      this.ws.send(JSON.stringify(msg));
    } catch {
      /* ignore */
    }
  }

  private flushQueue() {
    while (this.queue.length > 0 && this.state === 'open') {
      const msg = this.queue.shift();
      if (msg) this.sendRaw(msg);
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, this.reconnectIntervalMs);
  }

  private startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      this.send({ type: 'ping', timestamp: Date.now() });
    }, 30000);
  }

  private stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  close() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.stopHeartbeat();
    if (this.ws) {
      try {
        this.ws.close();
      } catch {
        /* ignore */
      }
    }
    this.ws = null;
    this.state = 'closed';
  }
}
