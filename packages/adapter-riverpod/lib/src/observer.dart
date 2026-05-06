import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:owlscope/owlscope.dart';

/// Riverpod observer that forwards provider lifecycle and state changes to
/// the OwlScope desktop app.
///
/// Attach via `ProviderScope(observers: [OwlScopeRiverpodObserver()])`.
final class OwlScopeRiverpodObserver extends ProviderObserver {
  /// If true, emit `provider:change` for `didAddProvider` and `didDisposeProvider`.
  /// Defaults to true; turn off if you only care about state transitions.
  final bool emitLifecycle;

  /// Limit string serialisation depth for nested state.
  final int maxDepth;

  OwlScopeRiverpodObserver({
    this.emitLifecycle = true,
    this.maxDepth = 10,
  });

  String _providerName(dynamic provider) {
    final name = provider.name as String?;
    if (name != null && name.isNotEmpty) return name;
    return provider.runtimeType.toString();
  }

  Map<String, dynamic> _providerInfo(dynamic provider) {
    final argument = provider.argument;
    final from = provider.from;
    return {
      'name': _providerName(provider),
      if (argument != null) 'argument': argument.toString(),
      'family': from?.toString(),
      'runtimeType': provider.runtimeType.toString(),
    };
  }

  void _safeEmit(void Function() body) {
    if (!OwlScope.isConfigured) return;
    try {
      body();
    } catch (_) {
      /* never let debug instrumentation crash the host */
    }
  }

  @override
  void didAddProvider(ProviderObserverContext context, Object? value) {
    if (!emitLifecycle) return;
    _safeEmit(() {
      OwlScope.instance.emit(
        type: EventTypes.providerChange,
        payload: {
          'event': 'add',
          'provider': _providerInfo(context.provider),
          'value': value,
        },
      );
    });
  }

  @override
  void didUpdateProvider(
    ProviderObserverContext context,
    Object? previousValue,
    Object? newValue,
  ) {
    _safeEmit(() {
      OwlScope.instance.emit(
        type: EventTypes.stateChange,
        payload: {
          'provider': _providerInfo(context.provider),
          'previous': previousValue,
          'next': newValue,
        },
      );
    });
  }

  @override
  void didDisposeProvider(ProviderObserverContext context) {
    if (!emitLifecycle) return;
    _safeEmit(() {
      OwlScope.instance.emit(
        type: EventTypes.providerChange,
        payload: {
          'event': 'dispose',
          'provider': _providerInfo(context.provider),
        },
      );
    });
  }

  @override
  void providerDidFail(
    ProviderObserverContext context,
    Object error,
    StackTrace stackTrace,
  ) {
    _safeEmit(() {
      OwlScope.instance.emit(
        type: EventTypes.error,
        level: LogLevels.error,
        payload: {
          'message': error.toString(),
          'provider': _providerInfo(context.provider),
        },
        meta: {'stackTrace': stackTrace.toString()},
      );
    });
  }
}
