# owlscope

> Universal debug & monitoring tool for **Flutter** apps.
> The mobile-first alternative to Reactotron.

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
import 'package:flutter/material.dart';

void main() => owlscopeAuto(() => runApp(const MyApp()));
```

That's the whole setup. Open the OwlScope desktop app, run
`flutter run` — your client appears in the sidebar.

## What `dart run owlscope:setup` does

One idempotent command that handles every scenario:

| Scenario             | What happens |
|----------------------|--------------|
| iOS Simulator        | nothing needed — `localhost` works out of the box |
| iOS Device (LAN)     | patches `Info.plist` with `NSLocalNetworkUsageDescription` and `NSAllowsLocalNetworking` |
| Android Emulator     | nothing needed — `10.0.2.2` is auto-detected as fallback |
| Android Device (USB) | run `dart run owlscope:reverse` once after plugging in |
| macOS desktop        | adds `com.apple.security.network.client` entitlement |

Re-run any time you regenerate native configs — the script skips work
that's already done.

## What gets captured

| Plugin    | What |
|-----------|------|
| `print` / `debugPrint` | Every console line, stack traces preserved |
| `http` (incl. dio)     | Every request + response with full body |
| `errors`               | `FlutterError`, `PlatformDispatcher.onError`, async errors |
| `performance`          | Frame timings, FPS, build/raster, slow & frozen frames, jank events, RSS memory, widget rebuilds |
| `navigation`           | `NavigatorObserver` push / pop / replace |

Release builds (`kReleaseMode`) are no-op'd automatically.

## Host detection

`owlscopeAuto()` figures out the right host on its own:

| Target               | Host used               |
|----------------------|--------------------------|
| iOS simulator        | `localhost`              |
| Android emulator     | `localhost` → falls back to `10.0.2.2` / `10.0.3.2` |
| Physical device      | `localhost` (set up by `:reverse` for Android USB)  |

Override only if you need to point at a different machine:

```dart
owlscopeAuto(
  () => runApp(const MyApp()),
  name: 'my-app',
  host: '192.168.1.50',
  port: 9090,
);
```

## Riverpod / Bloc / Redux

Use the dedicated adapter package — it streams every state change to
OwlScope's State panel with side-by-side previous/next diff:

```yaml
dependencies:
  owlscope_riverpod: ^0.2.0
```

```dart
ProviderScope(
  observers: [if (kDebugMode) OwlScopeRiverpodObserver()],
  child: const MyApp(),
);
```

## Manual configuration

If you'd rather wire it up by hand:

```dart
import 'package:owlscope/owlscope.dart';

OwlScope.configure(name: 'my-app', port: 9090)
  ..use(HttpPlugin(maxBodyBytes: 0))   // 0 = unlimited
  ..use(ErrorPlugin())
  ..use(PerformancePlugin())
  ..use(NavigationPlugin(owlscopeNavigatorObserver));
```

## License

MIT
