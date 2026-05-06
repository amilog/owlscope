import 'dart:io' show Platform;
import 'dart:math';

import 'events.dart';
import 'plugin.dart';
import 'redact.dart';
import 'serializer.dart';
import 'transport.dart';

class PluginConfig {
  final bool printPlugin;
  final bool http;
  final bool errors;
  final bool navigation;
  final bool performance;
  final bool rebuilds;

  const PluginConfig({
    this.printPlugin = true,
    this.http = true,
    this.errors = true,
    this.navigation = true,
    this.performance = false,
    this.rebuilds = false,
  });
}

String _genSessionId() {
  final r = Random.secure();
  String chunk(int len) =>
      List.generate(len, (_) => r.nextInt(16).toRadixString(16)).join();
  return '${chunk(8)}-${chunk(4)}-4${chunk(3)}-${chunk(4)}-${chunk(12)}';
}

String _detectPlatform() {
  // ignore: avoid_returning_null_for_void
  try {
    if (Platform.isAndroid || Platform.isIOS) return 'flutter';
  } catch (_) {
    // dart:io throws on web; fall through
  }
  return 'flutter';
}

class OwlScope {
  static OwlScope? _instance;

  static OwlScope get instance {
    final i = _instance;
    if (i == null) {
      throw StateError('OwlScope.configure() must be called before use.');
    }
    return i;
  }

  static bool get isConfigured => _instance != null;

  /// Configure (and connect) the singleton client. Subsequent calls replace it.
  static OwlScope configure({
    String name = 'flutter-app',
    String version = '0.0.0',
    String? framework,
    String host = 'localhost',
    int port = 9090,
    String? url,
    bool enabled = true,
    bool silent = false,
    PluginConfig plugins = const PluginConfig(),
    List<String> redactKeys = defaultRedactKeys,
  }) {
    _instance?.disconnect();
    final inst = OwlScope._(
      name: name,
      version: version,
      framework: framework,
      enabled: enabled,
      redactKeys: redactKeys,
      transport: Transport(
        TransportConfig(host: host, port: port, url: url, silent: silent),
      ),
      pluginConfig: plugins,
    );
    _instance = inst;
    if (enabled) inst._connect();
    return inst;
  }

  final String name;
  final String version;
  final String? framework;
  final String sessionId;
  final bool enabled;
  final List<String> redactKeys;
  final Transport _transport;
  final PluginConfig pluginConfig;
  final Set<String> _capabilities = {};
  final List<OwlScopePlugin> _plugins = [];

  OwlScope._({
    required this.name,
    required this.version,
    required this.framework,
    required this.enabled,
    required this.redactKeys,
    required Transport transport,
    required this.pluginConfig,
  })  : _transport = transport,
        sessionId = _genSessionId();

  /// The endpoint this client connects to. Plugins (e.g. HttpPlugin) should
  /// avoid intercepting traffic to this URI to prevent breaking the WS upgrade.
  Uri get transportUri => _transport.config.uri;

  OwlScope use(OwlScopePlugin plugin) {
    if (!enabled) return this;
    _plugins.add(plugin);
    _capabilities.add(plugin.name);
    plugin.install(this);
    return this;
  }

  void addCapability(String cap) => _capabilities.add(cap);

  void _connect() {
    _transport.setHandshake(
      HandshakePayload(
        name: name,
        version: version,
        platform: _detectPlatform(),
        framework: framework,
        sessionId: sessionId,
        capabilities: _capabilities.toList(),
      ),
    );
    _transport.connect();
  }

  void disconnect() {
    for (final p in _plugins) {
      try {
        p.uninstall();
      } catch (_) {}
    }
    _plugins.clear();
    _transport.close();
  }

  // ─── Public emit API ──────────────────────────────────────────────

  void emit({
    required String type,
    String? level,
    required dynamic payload,
    Map<String, dynamic>? meta,
    String? source,
  }) {
    if (!enabled) return;
    final cleaned = redact(safeClone(payload), redactKeys);
    final ev = DebugEvent(
      id: _genSessionId(),
      type: type,
      level: level,
      timestamp: DateTime.now().millisecondsSinceEpoch,
      source: source ?? name,
      payload: cleaned,
      meta: meta,
    );
    _transport.send({'type': 'event', 'payload': ev.toJson()});
  }

  void log(Object? message, {Map<String, dynamic>? meta}) =>
      _logAt(LogLevels.log, message, meta);
  void info(Object? message, {Map<String, dynamic>? meta}) =>
      _logAt(LogLevels.info, message, meta);
  void warn(Object? message, {Map<String, dynamic>? meta}) =>
      _logAt(LogLevels.warn, message, meta);
  void debug(Object? message, {Map<String, dynamic>? meta}) =>
      _logAt(LogLevels.debug, message, meta);

  void _logAt(String level, Object? message, Map<String, dynamic>? meta) {
    emit(
      type: EventTypes.console,
      level: level,
      payload: {
        'args': [
          if (message is Map || message is List) message else message?.toString() ?? 'null',
        ],
      },
      meta: meta,
    );
  }

  void error(Object? message, {Object? error, StackTrace? stackTrace}) {
    emit(
      type: EventTypes.error,
      level: LogLevels.error,
      payload: {
        'message': message?.toString() ?? error?.toString() ?? 'unknown error',
        'error': error?.toString(),
      },
      meta: {
        if (stackTrace != null) 'stackTrace': stackTrace.toString(),
      },
    );
  }

  void event(String name, [dynamic data]) {
    emit(
      type: EventTypes.custom,
      payload: {'name': name, 'data': data},
    );
  }
}
