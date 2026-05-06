# OwlScope — JavaScript / TypeScript SDK

Real-time debug & monitoring SDK for browser and Node.js apps. Sends console output, HTTP requests, errors, performance entries and storage operations to the OwlScope desktop app over WebSocket.

---

## Quick start

### Zero-config (browser)

```bash
npm install -D owlscope
```

```ts
// src/main.tsx (or any entry point)
import 'owlscope/auto';
```

That's it. With the desktop app open, every `console.log`, `fetch` request, error and `localStorage.setItem` shows up immediately.

### Manual config

```ts
import { configure } from 'owlscope';

configure({
  name: 'my-app',
  host: 'localhost',
  port: 9090,
  enabled: process.env.NODE_ENV !== 'production',
  plugins: {
    console: true,
    network: true,
    errors: true,
    performance: true,
    storage: true,
  },
  redact: ['password', 'authorization', 'token', 'cookie'],
});
```

### Advanced — manual client

```ts
import { createClient, ConsolePlugin, NetworkFetchPlugin } from 'owlscope';

const owl = createClient({
  name: 'my-app',
  transport: { host: 'localhost', port: 9090 },
});

owl.use(new ConsolePlugin({ levels: ['error', 'warn'] }));
owl.use(new NetworkFetchPlugin({ ignore: [/\/health$/] }));

owl.connect();

owl.log('checkpoint', { step: 2 });
owl.event('user-action', { type: 'click' });
```

---

## What gets captured

| Source | Captured as |
|---|---|
| `console.log` / `info` / `warn` / `error` / `debug` | `console` event |
| `window.fetch` | `network:response` (with request body, headers, response body) |
| `XMLHttpRequest` | `network:response` |
| `window.onerror` | `error` |
| `unhandledrejection` | `error` |
| `PerformanceObserver` (`measure`, `mark`, `navigation`, `longtask`) | `performance` |
| `localStorage` / `sessionStorage` `setItem` / `removeItem` / `clear` | `storage` |

---

## Configuration

```ts
configure({
  name: 'my-app',                  // shown in desktop client list
  version: '1.2.3',
  framework: 'react',              // optional, free-form
  host: 'localhost',
  port: 9090,
  enabled: true,                   // false → entire SDK is no-op
  silent: true,                    // log [owlscope] connection events to console
  plugins: {
    console: true,
    network: true,                 // both fetch + XHR
    errors: true,
    performance: true,
    storage: true,
  },
  redact: ['password', 'authorization', 'token', 'cookie'],
});
```

### Plugin options

```ts
new ConsolePlugin({
  levels: ['log', 'info', 'warn', 'error', 'debug'],
  preserveOriginal: true,          // also call the real console method
});

new NetworkFetchPlugin({
  ignore: ['/health', /\/metrics$/],
});

new NetworkXhrPlugin({
  ignore: [/sockjs-node/],
});

new PerformancePlugin({
  entryTypes: ['measure', 'mark', 'navigation', 'longtask'],
  ignoreResource: [/\/__vite/],
});

new ErrorsPlugin();
new StoragePlugin();
```

---

## Manual emit API

```ts
import { getClient } from 'owlscope';

const owl = getClient();
if (owl) {
  owl.log('hello', { meta: 1 });
  owl.info('user signed in', { userId: 42 });
  owl.warn('cache miss', { key: 'user:42' });
  owl.error('payment failed', error);
  owl.event('checkout-completed', { cart: [1, 2, 3] });

  // free-form emit:
  owl.emit({
    type: 'custom',
    level: 'info',
    payload: { whatever: 'you want' },
    meta: { duration: 12 },
  });
}
```

---

## Production safety

OwlScope is meant for **`devDependencies` only**. Three layers of protection:

1. **Bundler tree-shaking** — keep it out of `dependencies`. Most bundlers exclude dev-only imports from production builds.
2. **`owlscope/auto` checks** `process.env.NODE_ENV !== 'production'` and skips configuration entirely.
3. **`enabled: false`** — passing this to `configure` makes the whole client a no-op (no plugins install, no WebSocket connection).

```ts
configure({
  enabled: process.env.NODE_ENV !== 'production',
  // ...
});
```

---

## Sensitive data

Default redact list: `password`, `authorization`, `cookie`, `set-cookie`, `x-api-key`, `secret`, `token`. Any matching key (case-insensitive) in headers, request body, response body or any nested object is replaced with `[REDACTED]` before transmission.

Override via `redact:` in `configure`:

```ts
configure({
  redact: ['password', 'token', 'creditCard', 'ssn'],
});
```

---

## Frameworks

### React

`owlscope/auto` works as-is. To capture React errors via Error Boundary, wrap your tree:

```tsx
import { Component, ErrorInfo } from 'react';
import { getClient } from 'owlscope';

export class OwlBoundary extends Component<{ children: React.ReactNode }> {
  componentDidCatch(error: Error, info: ErrorInfo) {
    getClient()?.error('React Error Boundary', { error, info });
  }
  render() { return this.props.children; }
}
```

### Node.js

The auto entry only installs browser plugins. For a Node service:

```ts
import { createClient, ConsolePlugin } from 'owlscope';

const owl = createClient({
  name: 'my-service',
  platform: 'node',
});
owl.use(new ConsolePlugin());
owl.connect();
```

> Node `http`/`https` interception is not yet built-in. Track via manual `owl.event('http-request', ...)` calls or wait for the planned Node adapter.

### Vue / Svelte / vanilla

Same as React — just `import 'owlscope/auto'` once at the entry point. The console + fetch + XHR plugins capture everything platform-agnostically.

---

## Removing OwlScope

```bash
npm uninstall owlscope
```

Then remove the `import 'owlscope/auto'` (or `configure(...)`) line from your entry. Done.

If you used adapters (e.g. Redux middleware), remove them from your store setup as well.

---

## Troubleshooting

### `WebSocket connection failed`
Make sure the desktop app is running. The status indicator in the desktop's title bar should be green; if it's red, kill any stale process owning port 9090:

```bash
lsof -ti :9090 | xargs kill -9
```

### Demo browser tab doesn't connect
Check the browser DevTools → Network → WS filter. You should see a connection to `ws://localhost:9090`. If not, OwlScope failed to load — check the Console tab for errors.

### Two dev servers fighting over port 5173
Both Vite (your app) and Vite (the desktop renderer dev) want 5173. The OwlScope desktop pins itself to 5180 to avoid this. If you see "OwlScope" UI in your browser at localhost:5173, you're looking at the desktop renderer, not your demo — start your demo Vite first or change one of their ports.

---

## API summary

```ts
import {
  configure,            // (opts) => OwlScopeClient — sets singleton + connects
  createClient,         // (opts) => OwlScopeClient — manual, doesn't auto-connect
  getClient,            // () => singleton or null

  // plugins
  ConsolePlugin,
  NetworkFetchPlugin,
  NetworkXhrPlugin,
  ErrorsPlugin,
  PerformancePlugin,
  StoragePlugin,

  // utilities
  safeClone,
  safeStringify,
  redact,
  DEFAULT_REDACT_KEYS,
} from 'owlscope';
```

---

## License

MIT
