/// Zero-config entry — call once before runApp:
///
/// ```dart
/// import 'package:owlscope/auto.dart';
///
/// void main() => owlscopeAuto(() => runApp(const MyApp()));
/// ```
library owlscope.auto;

import 'package:flutter/foundation.dart';

import 'owlscope.dart';

void owlscopeAuto(
  void Function() body, {
  String name = 'flutter-app',
  String host = 'localhost',
  int port = 9090,
  // Per-body capture cap for the HTTP plugin. Defaults to 16 MiB. Pass `0`
  // for unlimited — useful when debugging huge JSON payloads, but a runaway
  // download will buffer entirely in memory.
  int httpMaxBodyBytes = defaultMaxBodyBytes,
}) {
  OwlScopeRunner.guard(() {
    if (kReleaseMode) {
      // No-op in release: just run the body without any instrumentation.
      body();
      return;
    }

    OwlScope.configure(
      name: name,
      host: host,
      port: port,
      plugins: const PluginConfig(
        printPlugin: true,
        http: true,
        errors: true,
        navigation: true,
        performance: true,
      ),
    )
      ..use(ErrorPlugin())
      ..use(HttpPlugin(maxBodyBytes: httpMaxBodyBytes))
      ..use(PerformancePlugin())
      ..use(NavigationPlugin(owlscopeNavigatorObserver));

    body();
  });
}

/// Singleton observer — attach to MaterialApp/CupertinoApp:
/// ```dart
/// MaterialApp(navigatorObservers: [owlscopeNavigatorObserver]);
/// ```
final owlscopeNavigatorObserver = OwlScopeNavigatorObserver();
