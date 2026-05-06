import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:web_socket_channel/web_socket_channel.dart';

import 'events.dart';

class TransportConfig {
  final String? url;
  final String host;
  final int port;
  final Duration reconnectInterval;
  final int maxQueueSize;
  final bool silent;

  const TransportConfig({
    this.url,
    this.host = 'localhost',
    this.port = 9090,
    this.reconnectInterval = const Duration(seconds: 2),
    this.maxQueueSize = 1000,
    this.silent = true,
  });

  Uri get uri {
    if (url != null) return Uri.parse(url!);
    return Uri.parse('ws://$host:$port');
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

  Future<void> connect() async {
    if (_state == _ConnState.connecting || _state == _ConnState.open) return;

    _state = _ConnState.connecting;
    _log('connecting to ${config.uri}');

    final WebSocketChannel ch;
    try {
      ch = WebSocketChannel.connect(config.uri);
    } catch (e) {
      _log('connect threw: $e');
      _state = _ConnState.closed;
      _scheduleReconnect();
      return;
    }
    _channel = ch;

    ch.stream.listen(
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

    try {
      await ch.ready;
    } catch (e) {
      _log('ready failed: $e');
      // onDone handler will fire and reconnect for us.
      return;
    }

    _log('connected');
    _onOpen();
  }

  void _log(String message) {
    if (config.silent) return;
    debugPrint('[owlscope] $message');
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
      // Fire-and-forget; reconnect will reschedule itself if it fails again.
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
