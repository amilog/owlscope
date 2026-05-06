import 'dart:async';

import 'client.dart';
import 'events.dart';

/// Wrap your app's `runApp(...)` call in this to enable:
///   • print → console event forwarding (via Zone)
///   • global uncaught error capture
///
/// Example:
/// ```dart
/// void main() {
///   OwlScopeRunner.guard(() {
///     OwlScope.configure(name: 'my-app');
///     runApp(const MyApp());
///   });
/// }
/// ```
class OwlScopeRunner {
  static void guard(void Function() body) {
    runZonedGuarded(
      body,
      (error, stack) {
        if (OwlScope.isConfigured) {
          OwlScope.instance.emit(
            type: EventTypes.error,
            level: LogLevels.error,
            payload: {
              'message': error.toString(),
              'error': error.runtimeType.toString(),
            },
            meta: {'stackTrace': stack.toString()},
          );
        }
      },
      zoneSpecification: ZoneSpecification(
        print: (self, parent, zone, line) {
          if (OwlScope.isConfigured) {
            try {
              OwlScope.instance.emit(
                type: EventTypes.console,
                level: LogLevels.log,
                payload: {
                  'args': [line],
                },
              );
            } catch (_) {}
          }
          parent.print(zone, line);
        },
      ),
    );
  }
}
