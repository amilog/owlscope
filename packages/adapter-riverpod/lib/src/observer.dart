import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:owlscope/owlscope.dart';

class OwlScopeRiverpodObserver extends ProviderObserver {
  /// If true, emit `provider:change` for `didAddProvider` and `didDisposeProvider`.
  /// Defaults to true; turn off if you only care about state transitions.
  final bool emitLifecycle;

  /// Limit string serialisation depth for nested state.
  final int maxDepth;

  OwlScopeRiverpodObserver({
    this.emitLifecycle = true,
    this.maxDepth = 10,
  });

  String _providerName(ProviderBase<Object?> provider) {
    final name = provider.name;
    if (name != null && name.isNotEmpty) return name;
    return provider.runtimeType.toString();
  }

  Map<String, dynamic> _providerInfo(ProviderBase<Object?> provider) {
    return {
      'name': _providerName(provider),
      if (provider.argument != null) 'argument': provider.argument.toString(),
      'family': provider.from?.toString(),
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
  void didAddProvider(
    ProviderBase<Object?> provider,
    Object? value,
    ProviderContainer container,
  ) {
    if (!emitLifecycle) return;
    _safeEmit(() {
      OwlScope.instance.emit(
        type: EventTypes.providerChange,
        payload: {
          'event': 'add',
          'provider': _providerInfo(provider),
          'value': value,
        },
      );
    });
  }

  @override
  void didUpdateProvider(
    ProviderBase<Object?> provider,
    Object? previousValue,
    Object? newValue,
    ProviderContainer container,
  ) {
    _safeEmit(() {
      OwlScope.instance.emit(
        type: EventTypes.stateChange,
        payload: {
          'provider': _providerInfo(provider),
          'previous': previousValue,
          'next': newValue,
        },
      );
    });
  }

  @override
  void didDisposeProvider(
    ProviderBase<Object?> provider,
    ProviderContainer container,
  ) {
    if (!emitLifecycle) return;
    _safeEmit(() {
      OwlScope.instance.emit(
        type: EventTypes.providerChange,
        payload: {
          'event': 'dispose',
          'provider': _providerInfo(provider),
        },
      );
    });
  }

  @override
  void providerDidFail(
    ProviderBase<Object?> provider,
    Object error,
    StackTrace stackTrace,
    ProviderContainer container,
  ) {
    _safeEmit(() {
      OwlScope.instance.emit(
        type: EventTypes.error,
        level: LogLevels.error,
        payload: {
          'message': error.toString(),
          'provider': _providerInfo(provider),
        },
        meta: {'stackTrace': stackTrace.toString()},
      );
    });
  }
}
