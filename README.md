# OwlScope

> Mobile debug & monitoring tool — for **React Native** and **Flutter**.
> The mobile-first alternative to Reactotron.

<p align="center">
  <img src="apps/desktop/src/renderer/public/logo.png" width="120" alt="OwlScope" />
</p>

OwlScope is a desktop app that listens on a local WebSocket port and renders,
in real time, every event from your running mobile app: console / `print`,
HTTP traffic, errors, frame timings, Riverpod / Bloc / Redux state changes.

- 📱 **Mobile-first** — built for React Native and Flutter
- 🔌 **One-line setup** plus one one-time `setup` command
- 🔒 **Production-safe** — fully no-op in release builds
- ⚡ **50k events** rendered virtualised at 60 FPS
- 🌗 Light & dark mode

---

## React Native

```sh
npm install owlscope@rn
npx owlscope setup
```

```ts
// index.js — top of the file
import { startOwlScope } from 'owlscope/rn';
if (__DEV__) startOwlScope();
```

## Flutter

```yaml
# pubspec.yaml
dependencies:
  owlscope: ^0.1.3
```

```sh
flutter pub get
dart run owlscope:setup
```

```dart
// lib/main.dart
import 'package:owlscope/auto.dart';
void main() => owlscopeAuto(() => runApp(const MyApp()));
```

## Desktop app

Download from [Releases](https://github.com/amilog/owlscope/releases),
or build from source:

```sh
git clone https://github.com/amilog/owlscope
cd owlscope
npm install
npm run dev
```

---

## Repository layout

```
owlscope/
├── apps/
│   ├── desktop/           Electron app (UI + WS server)
│   └── site/              owlscope.dev (Astro + Starlight)
└── packages/
    ├── protocol/          Shared event protocol (TS types)
    ├── client-js/         React Native SDK (npm: owlscope)
    ├── client-flutter/    Flutter SDK (pub: owlscope)
    └── adapter-riverpod/  Riverpod state adapter (pub: owlscope_riverpod)
```

## Documentation

[owlscope.dev](https://owlscope.dev) — quick start, guides, API.

## License

MIT
