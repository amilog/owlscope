import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:web_socket_channel/web_socket_channel.dart';

import 'events.dart';

class TransportConfig {
  final String? url;
  final String host;
  final int port;

  /// Hosts to try in order if [host] fails to connect. Defaults cover the
  /// common Android emulator IPs so a single `localhost` host works
  /// transparently for simulator + emulator + adb reverse setups.
  final List<String> fallbackHosts;
  final Duration reconnectInterval;
  final Duration connectTimeout;
  final int maxQueueSize;
  final bool silent;

  const TransportConfig({
    this.url,
    this.host = 'localhost',
    this.port = 9090,
    this.fallbackHosts = const ['10.0.2.2', '10.0.3.2'],
    this.reconnectInterval = const Duration(seconds: 2),
    this.connectTimeout = const Duration(seconds: 3),
    this.maxQueueSize = 1000,
    this.silent = true,
  });

  Uri get uri {
    if (url != null) return Uri.parse(url!);
    return Uri.parse('ws://$host:$port');
  }

  /// Every candidate URI to try, deduped, in priority order.
  Iterable<Uri> get candidates sync* {
    if (url != null) {
      yield Uri.parse(url!);
      return;
    }
    final seen = <String>{};
    for (final h in [host, ...fallbackHosts]) {
      final u = Uri.parse('ws://$h:$port');
      if (seen.add(u.toString())) yield u;
    }
  }
}

enum _ConnState { idle, connecting, open, closed }

class Transport {
  final TransportConfig config;
  WebSocketChannel? _channel;
  _ConnState _state = _ConnState.idle;
  final List<Map<String, dynamic>> _queue = [];
  Timer? _reconnectTimer;
  Timer? _heartbeatTimer;
  HandshakePayload? _handshake;
  void Function(Map<String, dynamic>)? _onMessage;

  Transport(this.config);

  void setHandshake(HandshakePayload payload) {
    _handshake = payload;
  }

  void onMessage(void Function(Map<String, dynamic>) handler) {
    _onMessage = handler;
  }

  /// Try each candidate URI in turn; first one whose `ready` resolves wins.
  Future<void> connect() async {
    if (_state == _ConnState.connecting || _state == _ConnState.open) return;
    _state = _ConnState.connecting;

    for (final uri in config.candidates) {
      _log('connecting to $uri');
      final channel = _tryOpen(uri);
      if (channel == null) continue;

      try {
        await channel.ready.timeout(config.connectTimeout);
      } catch (e) {
        _log('  failed: $e');
        try {
          await channel.sink.close();
        } catch (_) {}
        continue;
      }

      // Success — wire up listeners on this channel.
      _channel = channel;
      _log('connected via $uri');

      channel.stream.listen(
        (raw) {
          if (_onMessage == null) return;
          try {
            final text = raw is String ? raw : utf8.decode(raw as List<int>);
            final msg = jsonDecode(text) as Map<String, dynamic>;
            _onMessage!(msg);
          } catch (_) {
            /* ignore */
          }
        },
        onDone: _onClose,
        onError: (e) => _log('stream error: $e'),
        cancelOnError: false,
      );

      _onOpen();
      return;
    }

    // None of the candidates worked — schedule a retry and bail.
    _state = _ConnState.closed;
    _log(
      'no host reachable. Tried: '
      '${config.candidates.map((u) => '${u.host}:${u.port}').join(', ')}.\n'
      '  Hint: run `dart run owlscope:reverse` for physical Android phones,\n'
      '  or pass host: <your Mac LAN IP> for physical iOS devices.',
    );
    _scheduleReconnect();
  }

  WebSocketChannel? _tryOpen(Uri uri) {
    try {
      return WebSocketChannel.connect(uri);
    } catch (e) {
      _log('  $uri threw: $e');
      return null;
    }
  }

  void _onOpen() {
    if (_state == _ConnState.open) return;
    _state = _ConnState.open;
    if (_handshake != null) {
      _sendRaw({'type': 'handshake', 'payload': _handshake!.toJson()});
    }
    _flushQueue();
    _startHeartbeat();
  }

  void _onClose() {
    _state = _ConnState.closed;
    _stopHeartbeat();
    _channel = null;
    _scheduleReconnect();
  }

  void send(Map<String, dynamic> message) {
    if (_state == _ConnState.open && _channel != null) {
      _sendRaw(message);
    } else {
      _queue.add(message);
      if (_queue.length > config.maxQueueSize) {
        _queue.removeRange(0, _queue.length - config.maxQueueSize);
      }
    }
  }

  void _sendRaw(Map<String, dynamic> message) {
    final ch = _channel;
    if (ch == null) return;
    try {
      ch.sink.add(jsonEncode(message));
    } catch (_) {
      /* ignore */
    }
  }

  void _flushQueue() {
    while (_queue.isNotEmpty && _state == _ConnState.open) {
      final next = _queue.removeAt(0);
      _sendRaw(next);
    }
  }

  void _scheduleReconnect() {
    if (_reconnectTimer != null) return;
    _reconnectTimer = Timer(config.reconnectInterval, () {
      _reconnectTimer = null;
      // Fire-and-forget; if it fails it will reschedule.
      connect();
    });
  }

  void _startHeartbeat() {
    _stopHeartbeat();
    _heartbeatTimer = Timer.periodic(const Duration(seconds: 30), (_) {
      send({'type': 'ping', 'timestamp': DateTime.now().millisecondsSinceEpoch});
    });
  }

  void _stopHeartbeat() {
    _heartbeatTimer?.cancel();
    _heartbeatTimer = null;
  }

  void _log(String message) {
    if (config.silent) return;
    debugPrint('[owlscope] $message');
  }

  Future<void> close() async {
    _reconnectTimer?.cancel();
    _reconnectTimer = null;
    _stopHeartbeat();
    final ch = _channel;
    _channel = null;
    _state = _ConnState.closed;
    try {
      await ch?.sink.close();
    } catch (_) {
      /* ignore */
    }
  }
}
