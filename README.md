# OwlScope

> Real-time debug & monitoring tool for JavaScript and Flutter apps.
> Reactotron-style developer experience, modern UI, multi-platform.

<p align="center">
  <img src="apps/desktop/src/renderer/public/logo.png" width="120" alt="OwlScope" />
</p>

OwlScope is a desktop app that listens on a local WebSocket port and renders, in real time, debug events from your running app: console logs, HTTP traffic, errors, performance, navigation, Riverpod/Bloc state changes — anything you instrument.

- 🦉 **Universal** — same desktop UI for JavaScript/TypeScript and Flutter apps
- 🔌 **Zero config** — `import 'owlscope/auto'` (JS) or `owlscopeAuto(...)` (Flutter)
- 🔒 **Production-safe** — fully no-op in release builds
- 🎯 **Reactotron-style ergonomics** — inline accordions, narrow window friendly
- ⚡ **50k events** — virtualized lists, 60 FPS
- 🌗 **Light & dark mode**

---

## Quick start

### Flutter app

```bash
flutter pub add --dev owlscope
dart run owlscope:setup
```

```dart
// lib/main.dart
import 'package:owlscope/auto.dart';

void main() => owlscopeAuto(() => runApp(const MyApp()));
```

Full docs: **[`packages/client-flutter/README.md`](packages/client-flutter/README.md)**

### React / browser app

```bash
npm install -D owlscope
```

```ts
// src/main.tsx (or any entry point)
import 'owlscope/auto';
```

Full docs: **[`packages/client-js/README.md`](packages/client-js/README.md)**

### Desktop app

```bash
git clone <this repo>
cd owlscope
npm install
npm run dev:desktop
```

The Electron window opens with WebSocket server bound to `ws://localhost:9090`.

---

## What you get

### Six panels

| Panel | Captures |
|---|---|
| **Logs** | Everything (master timeline) |
| **Network** | `fetch` / XHR / `dart:io HttpClient` (incl. dio) |
| **State** | Redux actions, Riverpod state changes, Bloc transitions |
| **Errors** | `window.onerror`, unhandled rejections, `FlutterError`, Bloc errors |
| **Performance** | PerformanceObserver entries, Flutter frame timings |
| **Timeline** | All events chronologically (coming) |

### Inline detail expansion

Click any row → expands inline below it. No fixed side panel — designed for narrow windows. Click again or press <kbd>Esc</kbd> to collapse.

### Direction toggle

`Newest ↓` (default) or `Newest ↑` — flip the entire feed direction with one click. Useful when you want the most recent event always visible at the top.

### Network detail

Tabs for Headers / Request / Response / Timing. Per-tab Copy buttons. Single-click **Copy as cURL**.

### State detail

Side-by-side **Previous** vs **Next** with copy buttons on each. Works for Redux, Riverpod, Bloc.

### Other

- Light & dark mode toggle (top-right)
- Regex search (`/pattern/flags`)
- Level filter chips (log / info / warn / error / debug)
- Pause / resume capture
- Per-client filtering (sidebar)
- Export session as JSON
- Keyboard: <kbd>⌘L</kbd> clear · <kbd>⌘Space</kbd> pause · <kbd>⌘F</kbd> search · <kbd>Esc</kbd> close detail

---

## Repository layout

```
owlscope/
├── apps/
│   └── desktop/           Electron desktop app (UI + WS server)
└── packages/
    ├── protocol/          Shared event protocol (TS types)
    ├── client-js/         JavaScript SDK (npm: owlscope)
    ├── client-flutter/    Flutter SDK (pub: owlscope)
    └── adapter-riverpod/  Riverpod adapter (pub: owlscope_riverpod)
```

---

## SDK feature matrix

| | JavaScript | Flutter |
|---|---|---|
| Console / print | ✅ | ✅ |
| HTTP capture | ✅ fetch + XHR | ✅ via HttpOverrides (incl. dio) |
| Errors | ✅ | ✅ FlutterError + PlatformDispatcher |
| Performance | ✅ PerformanceObserver | ✅ Frame timings |
| Storage | ✅ localStorage / sessionStorage | – |
| Navigation | – | ✅ NavigatorObserver |
| Redux | adapter (planned) | – |
| Riverpod | – | ✅ `owlscope_riverpod` |
| Bloc | – | adapter (planned) |
| Auto-detect | partial | partial |
| Production no-op | ✅ `NODE_ENV=production` | ✅ `kReleaseMode` |
| Zero-config entry | ✅ `owlscope/auto` | ✅ `owlscopeAuto()` |

---

## Development

```bash
npm install                    # install all workspace deps
npm run dev                    # Electron app (renderer on http://localhost:5180)
```

To wire a Flutter app against the local SDK, depend on the package via `path:`:

```yaml
dependencies:
  owlscope:
    path: ../../path/to/owlscope/packages/client-flutter
```

---

## Production safety

Both SDKs are designed to be safe to ship:

- **JavaScript**: keep `owlscope` in `devDependencies` — bundlers tree-shake unused dev deps. The auto entry also checks `process.env.NODE_ENV !== 'production'` as a second line of defence.
- **Flutter**: keep `owlscope` in `dev_dependencies` — Flutter excludes them from release builds. `owlscopeAuto` checks `kReleaseMode` and bails out before any instrumentation runs.

---

## Status & roadmap

| Stage | Status |
|---|---|
| Mərhələ 1 — MVP (monorepo, WS server, Logs panel) | ✅ |
| Mərhələ 2 — Network plugin, State panel, inline detail | ✅ |
| Mərhələ 3 — Errors / Performance / Storage plugins, light mode | ✅ |
| Mərhələ 4 — Flutter SDK + Riverpod adapter | ✅ |
| Mərhələ 5 — Bloc adapter, time-travel, replay request, widget tree | 🚧 |
| Mərhələ 6 — electron-builder distribution, pub.dev / npm publish, docs site | 🚧 |

---

## License

MIT — see individual packages for details.

## Contributing

Issues and PRs welcome. Run `flutter analyze` and `tsc --noEmit` before submitting.
