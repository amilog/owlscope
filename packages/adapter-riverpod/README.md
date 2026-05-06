# owlscope_riverpod

Riverpod adapter for [OwlScope](../../README.md). Forwards provider lifecycle and state changes to the OwlScope desktop app.

## Install

```yaml
dev_dependencies:
  owlscope: ^0.1.0
  owlscope_riverpod: ^0.1.0
```

```bash
flutter pub get
dart run owlscope:setup
```

## Usage

```dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:owlscope/auto.dart';
import 'package:owlscope_riverpod/owlscope_riverpod.dart';

void main() {
  owlscopeAuto(() {
    runApp(
      ProviderScope(
        observers: [OwlScopeRiverpodObserver()],
        child: const MyApp(),
      ),
    );
  });
}
```

That's it. Every `didAddProvider` / `didUpdateProvider` / `didDisposeProvider` / `providerDidFail` is forwarded:

| Riverpod callback        | OwlScope event type    | Notes                            |
|--------------------------|------------------------|----------------------------------|
| `didAddProvider`         | `provider:change`      | `event: 'add'` + initial value   |
| `didUpdateProvider`      | `state:change`         | `previous` + `next` payload      |
| `didDisposeProvider`     | `provider:change`      | `event: 'dispose'`               |
| `providerDidFail`        | `error`                | with stack trace                 |

In the desktop UI these show up under the **State** panel.

## Options

```dart
OwlScopeRiverpodObserver(
  emitLifecycle: false, // skip add/dispose events, only emit state changes
  maxDepth: 6,          // serialisation depth for nested objects (default 10)
)
```

## Production

`owlscope` itself is a no-op in `kReleaseMode`, so the observer's emits never reach the network in release builds. Wrapping in `if (kDebugMode)` is optional but keeps the observer list literal-cleaner:

```dart
ProviderScope(
  observers: [if (kDebugMode) OwlScopeRiverpodObserver()],
  child: const MyApp(),
)
```
