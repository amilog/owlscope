import 'dart:ui';

import 'package:flutter/foundation.dart';

import '../client.dart';
import '../events.dart';
import '../plugin.dart';

class ErrorPlugin implements OwlScopePlugin {
  @override
  String get name => 'errors';

  FlutterExceptionHandler? _previousFlutterError;
  ErrorCallback? _previousPlatformError;

  @override
  void install(OwlScope client) {
    _previousFlutterError = FlutterError.onError;
    FlutterError.onError = (FlutterErrorDetails details) {
      try {
        client.emit(
          type: EventTypes.error,
          level: LogLevels.error,
          payload: {
            'message': details.exceptionAsString(),
            'library': details.library,
            'context': details.context?.toString(),
          },
          meta: {
            if (details.stack != null) 'stackTrace': details.stack.toString(),
          },
        );
      } catch (_) {}
      _previousFlutterError?.call(details);
    };

    _previousPlatformError = PlatformDispatcher.instance.onError;
    PlatformDispatcher.instance.onError = (Object error, StackTrace stack) {
      try {
        client.emit(
          type: EventTypes.error,
          level: LogLevels.error,
          payload: {
            'message': error.toString(),
            'error': error.runtimeType.toString(),
          },
          meta: {'stackTrace': stack.toString()},
        );
      } catch (_) {}
      return _previousPlatformError?.call(error, stack) ?? false;
    };
  }

  @override
  void uninstall() {
    FlutterError.onError = _previousFlutterError;
    PlatformDispatcher.instance.onError = _previousPlatformError;
  }
}
