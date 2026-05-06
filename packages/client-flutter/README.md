# OwlScope — Flutter SDK

Real-time debug & monitoring tool for Flutter apps. Sends `print`, errors, HTTP traffic, navigation, performance and (with adapter) Riverpod state changes to a desktop UI over WebSocket.

> Reactotron-style developer experience for Flutter. Open the desktop app, run `flutter run`, see everything that happens in your app in real time.

---

## Quick start (3 commands + 1 line of code)

### 1. Add the package

```yaml
# pubspec.yaml
dev_dependencies:
  owlscope: ^0.1.0   # or `path:` while still local
```

```bash
flutter pub get
```

### 2. Patch the platform configs (one-time, automatic)

```bash
dart run owlscope:setup
```

This idempotent command edits three files:

| Platform | File | What it adds |
|---|---|---|
| macOS | `macos/Runner/DebugProfile.entitlements` | `com.apple.security.network.client` (sandbox outbound) |
| iOS | `ios/Runner/Info.plist` | `NSAllowsLocalNetworking` (ATS exception) |
| Android | `android/app/src/debug/AndroidManifest.xml` | `usesCleartextTraffic` (debug-only, never in release) |

To revert later: `dart run owlscope:teardown`.

### 3. Wrap your `main()`

#### Simplest case

```dart
import 'package:owlscope/auto.dart';

void main() => owlscopeAuto(() => runApp(const MyApp()));
```

#### Realistic case — async setup, multiple platforms, Riverpod

Most real apps need `WidgetsFlutterBinding.ensureInitialized()`, async init,
and platform-specific host (Android emulator routes localhost to `10.0.2.2`):

```dart
import 'dart:io' show Platform;
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:owlscope/auto.dart';
import 'package:owlscope_riverpod/owlscope_riverpod.dart';

String _owlHost() {
  if (kIsWeb) return 'localhost';
  try {
    if (Platform.isAndroid) return '10.0.2.2';
  } catch (_) {}
  return 'localhost';
}

void main() {
  owlscopeAuto(
    () async {
      WidgetsFlutterBinding.ensureInitialized();

      // your existing init: SystemChrome, SharedPreferences, DI, etc.
      await initializeDependencies();

      runApp(
        ProviderScope(
          observers: [if (kDebugMode) OwlScopeRiverpodObserver()],
          child: const MyApp(),
        ),
      );
    },
    name: 'my-app',
    host: _owlHost(),
  );
}
```

The `body` callback can be `async` — `owlscopeAuto` handles the Zone setup
correctly. Anything inside (sync or async) is instrumented.

### 4. Run

```bash
# desktop app (in the OwlScope monorepo, or installed binary):
npm run dev:desktop

# your Flutter app:
flutter run -d macos      # or any platform
```

That's it. Open the desktop window — your app appears in **Clients**, all logs and HTTP requests start flowing.

---

## What gets captured automatically

`owlscopeAuto` installs these by default:

| Source | Captured as | Notes |
|---|---|---|
| `print()` / `debugPrint()` | `console` event | via Zone interception |
| `dart:io` HttpClient (the `http` package, **`dio`**, custom clients) | `network:request/response` | request body, headers, status, duration |
| `FlutterError.onError` | `error` | widget framework errors with stack |
| `PlatformDispatcher.onError` | `error` | platform engine errors |
| Uncaught zone errors | `error` | anything that escapes async chains |
| Navigator push/pop/replace | `navigation:push` / `navigation:pop` | requires `owlscopeNavigatorObserver` |
| Frame timings | `performance` | avgBuild, avgRaster, slowFrames per second |

To enable navigation events, attach the observer to your `MaterialApp` / `CupertinoApp`:

```dart
MaterialApp(
  navigatorObservers: [owlscopeNavigatorObserver],
  // ...
)
```

---

## Configuration

`owlscopeAuto` accepts these options:

```dart
owlscopeAuto(
  () => runApp(const MyApp()),
  name: 'my-app',          // shown in the desktop client list
  host: 'localhost',       // WebSocket host
  port: 9090,              // WebSocket port
);
```

For full control, call `OwlScope.configure` directly:

```dart
import 'package:owlscope/owlscope.dart';

void main() {
  OwlScopeRunner.guard(() {
    OwlScope.configure(
      name: 'my-app',
      version: '1.2.3',
      host: 'localhost',
      port: 9090,
      silent: false,                // print [owlscope] connection logs
      plugins: const PluginConfig(
        printPlugin: true,
        http: true,
        errors: true,
        navigation: true,
        performance: true,
      ),
      redactKeys: const ['password', 'authorization', 'token', 'cookie'],
    )
      ..use(ErrorPlugin())
      ..use(HttpPlugin(ignore: [RegExp(r'/health$')]))
      ..use(PerformancePlugin())
      ..use(NavigationPlugin(owlscopeNavigatorObserver));

    runApp(const MyApp());
  });
}
```

---

## Manual logging

```dart
import 'package:owlscope/owlscope.dart';

OwlScope.instance.log('checkpoint', meta: {'step': 2});
OwlScope.instance.info('cart updated', meta: {'items': 3});
OwlScope.instance.warn('cache miss', meta: {'key': 'user:42'});
OwlScope.instance.error('payment failed', error: e, stackTrace: st);
OwlScope.instance.event('user-action', {'click': 'checkout'});
```

`event(name, payload)` is a free-form custom event — appears in the desktop **Logs** panel under type `custom`.

---

## Per-platform notes

### macOS
After `dart run owlscope:setup`, the network client entitlement is added. **Hot reload doesn't apply entitlement changes** — fully restart with `flutter run` (not `r`/`R`) the first time.

### iOS
ATS exception added to `Info.plist`. Works on simulator and physical device. For physical device debugging, your Mac and device must be on the same network and `host:` should be your Mac's LAN IP (e.g. `192.168.1.42`), not `localhost`.

### Android
- **Emulator**: `host` is automatically `10.0.2.2` if you use the platform-aware helper:
  ```dart
  import 'dart:io' show Platform;
  import 'package:flutter/foundation.dart';

  String _owlHost() {
    if (kIsWeb) return 'localhost';
    try { if (Platform.isAndroid) return '10.0.2.2'; } catch (_) {}
    return 'localhost';
  }
  ```
- **Physical device**: use your computer's LAN IP and put it in `host:`.

### Web
HttpOverrides is unavailable on Flutter Web — HTTP intercept won't work. `print` and manual `OwlScope.instance.log` still work.

### Linux / Windows
No sandbox, no setup needed. The plain WebSocket connection just works.

---

## Adapters

### Riverpod — `owlscope_riverpod`

```yaml
dev_dependencies:
  owlscope: ^0.1.0
  owlscope_riverpod: ^0.1.0
```

```dart
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:owlscope/auto.dart';
import 'package:owlscope_riverpod/owlscope_riverpod.dart';

void main() {
  owlscopeAuto(() {
    runApp(
      ProviderScope(
        observers: [if (kDebugMode) OwlScopeRiverpodObserver()],
        child: const MyApp(),
      ),
    );
  });
}
```

Every provider lifecycle event and state transition shows up in the **State** panel with side-by-side previous/next view.

### Bloc — `owlscope_bloc`

Coming soon.

### Dio

Dio uses `dart:io HttpClient` under the hood — already captured by `HttpPlugin` automatically. No Dio-specific adapter needed for basic use. (Dio-specific interceptor with richer metadata is on the roadmap.)

---

## Production safety

`owlscopeAuto` checks `kReleaseMode` and **becomes a complete no-op** in release builds:

- ❌ no WebSocket connection attempted
- ❌ no plugins installed
- ❌ no `HttpOverrides` registered
- ❌ no Zone wrapping for `print`
- ❌ no error handlers attached

So even if you accidentally ship `owlscopeAuto` in production:
- Zero overhead
- Zero traffic
- Zero behaviour change

**Recommended pattern:** keep `owlscope` in `dev_dependencies` so it's never bundled at all in release. The `kReleaseMode` check is your second line of defence.

---

## Removing OwlScope

Three commands:

```bash
# 1. Revert native config (idempotent, safe)
dart run owlscope:teardown

# 2. Remove the package
flutter pub remove owlscope owlscope_riverpod

# 3. Edit main.dart:
#    owlscopeAuto(() => runApp(...))   →   runApp(...)
#    Remove `navigatorObservers: [owlscopeNavigatorObserver]`
```

`teardown` only removes its own markers; if you've manually edited the platform files, your edits are preserved.

---

## Troubleshooting

### "Operation not permitted" / `errno = 1` on macOS
Sandbox is blocking outbound connection. Run `dart run owlscope:setup` and **fully restart** the app (not hot reload — entitlements only apply on a fresh build).

### `WebSocket connection failed` on iOS or Android
- Check `dart run owlscope:setup` was run.
- For physical iOS devices: `host` must be the Mac's LAN IP, not `localhost`.
- For Android emulator: `host` should be `10.0.2.2`.
- For Android physical: `host` should be the computer's LAN IP.
- Make sure the desktop app is actually running (`npm run dev:desktop` shows green dot top-right).

### Desktop shows green dot but client doesn't appear
Most likely a stale Electron process is holding port 9090:
```bash
lsof -ti :9090 | xargs kill -9
```
Then restart the desktop app.

### Logs disappear or never appear
- Pause button might be on (top-right of toolbar)
- Filters might be hiding everything (clear search, deselect all level chips)
- Direction button — try toggling "Newest ↓" / "Newest ↑"

### How do I share my Mac's IP for physical device testing?

```bash
# macOS: get your LAN IP
ipconfig getifaddr en0
```

Use that as `host:` in your `owlscopeAuto` call when running on a physical device.

---

## API reference (cheat sheet)

```dart
// Singleton access (after configure)
OwlScope.instance.log(message, {meta})
OwlScope.instance.info(...)
OwlScope.instance.warn(...)
OwlScope.instance.debug(...)
OwlScope.instance.error(message, {error, stackTrace})
OwlScope.instance.event(name, [payload])

// Custom emit
OwlScope.instance.emit(
  type: EventTypes.custom,
  level: LogLevels.info,
  payload: {...},
  meta: {...},
);

// Lifecycle
OwlScope.isConfigured   // bool
OwlScope.instance.disconnect()  // tears down WS + plugins
```

---

## License

MIT
