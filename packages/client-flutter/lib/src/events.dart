/// Universal event protocol — must stay in sync with packages/protocol/src/index.ts.
class EventTypes {
  static const console = 'console';
  static const networkRequest = 'network:request';
  static const networkResponse = 'network:response';
  static const reduxAction = 'redux:action';
  static const stateChange = 'state:change';
  static const error = 'error';
  static const custom = 'custom';
  static const performance = 'performance';
  static const performanceFrame = 'performance:frame';
  static const performanceMemory = 'performance:memory';
  static const performanceJank = 'performance:jank';
  static const performanceRebuilds = 'performance:rebuilds';
  static const performanceThermal = 'performance:thermal';
  static const storage = 'storage';
  static const widgetRebuild = 'widget:rebuild';
  static const navigationPush = 'navigation:push';
  static const navigationPop = 'navigation:pop';
  static const blocTransition = 'bloc:transition';
  static const providerChange = 'provider:change';
}

class LogLevels {
  static const log = 'log';
  static const info = 'info';
  static const warn = 'warn';
  static const error = 'error';
  static const debug = 'debug';
}

class DebugEvent {
  final String id;
  final String type;
  final String? level;
  final int timestamp;
  final String source;
  final dynamic payload;
  final Map<String, dynamic>? meta;

  DebugEvent({
    required this.id,
    required this.type,
    required this.timestamp,
    required this.source,
    required this.payload,
    this.level,
    this.meta,
  });

  Map<String, dynamic> toJson() => {
        'id': id,
        'type': type,
        if (level != null) 'level': level,
        'timestamp': timestamp,
        'source': source,
        'payload': payload,
        if (meta != null) 'meta': meta,
      };
}

class HandshakePayload {
  final String name;
  final String version;
  final String platform;
  final String? framework;
  final String sessionId;
  final List<String> capabilities;

  HandshakePayload({
    required this.name,
    required this.version,
    required this.platform,
    required this.sessionId,
    required this.capabilities,
    this.framework,
  });

  Map<String, dynamic> toJson() => {
        'name': name,
        'version': version,
        'platform': platform,
        if (framework != null) 'framework': framework,
        'sessionId': sessionId,
        'capabilities': capabilities,
      };
}
