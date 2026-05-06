import 'dart:async';
import 'dart:convert';
import 'dart:io';

import '../client.dart';
import '../events.dart';
import '../plugin.dart';

const _maxBodyBytes = 64 * 1024;

class HttpPlugin implements OwlScopePlugin {
  @override
  String get name => 'network-http';

  HttpOverrides? _previousOverrides;

  final List<Pattern> ignore;

  HttpPlugin({this.ignore = const []});

  @override
  void install(OwlScope client) {
    _previousOverrides = HttpOverrides.current;
    // Always ignore traffic to the OwlScope WS endpoint itself — otherwise
    // wrapping its HttpClient breaks the WebSocket upgrade.
    final ws = client.transportUri;
    final selfHost = '${ws.host}:${ws.port}';
    final effectiveIgnore = <Pattern>[
      selfHost,
      ...ignore,
    ];
    HttpOverrides.global =
        _OwlHttpOverrides(client, _previousOverrides, effectiveIgnore);
  }

  @override
  void uninstall() {
    HttpOverrides.global = _previousOverrides;
  }
}

class _OwlHttpOverrides extends HttpOverrides {
  final OwlScope client;
  final HttpOverrides? previous;
  final List<Pattern> ignore;
  _OwlHttpOverrides(this.client, this.previous, this.ignore);

  @override
  HttpClient createHttpClient(SecurityContext? context) {
    final inner = previous?.createHttpClient(context) ?? super.createHttpClient(context);
    return _OwlHttpClient(inner, client, ignore);
  }
}

bool _shouldIgnore(String url, List<Pattern> ignore) {
  for (final p in ignore) {
    if (p is RegExp && p.hasMatch(url)) return true;
    if (p is String && url.contains(p)) return true;
  }
  return false;
}

dynamic _tryJson(String text) {
  try {
    return jsonDecode(text);
  } catch (_) {
    return text;
  }
}

class _OwlHttpClient implements HttpClient {
  final HttpClient _inner;
  final OwlScope _client;
  final List<Pattern> _ignore;

  _OwlHttpClient(this._inner, this._client, this._ignore);

  @override
  Future<HttpClientRequest> openUrl(String method, Uri url) async {
    final req = await _inner.openUrl(method, url);
    if (_shouldIgnore(url.toString(), _ignore)) return req;
    return _OwlHttpClientRequest(req, _client, method.toUpperCase(), url);
  }

  // Forward all other methods to inner — these typically end up calling openUrl.
  @override
  Future<HttpClientRequest> open(String method, String host, int port, String path) =>
      openUrl(method, Uri(scheme: 'http', host: host, port: port, path: path));

  @override
  Future<HttpClientRequest> get(String host, int port, String path) =>
      openUrl('GET', Uri(scheme: 'http', host: host, port: port, path: path));
  @override
  Future<HttpClientRequest> getUrl(Uri url) => openUrl('GET', url);
  @override
  Future<HttpClientRequest> post(String host, int port, String path) =>
      openUrl('POST', Uri(scheme: 'http', host: host, port: port, path: path));
  @override
  Future<HttpClientRequest> postUrl(Uri url) => openUrl('POST', url);
  @override
  Future<HttpClientRequest> put(String host, int port, String path) =>
      openUrl('PUT', Uri(scheme: 'http', host: host, port: port, path: path));
  @override
  Future<HttpClientRequest> putUrl(Uri url) => openUrl('PUT', url);
  @override
  Future<HttpClientRequest> delete(String host, int port, String path) =>
      openUrl('DELETE', Uri(scheme: 'http', host: host, port: port, path: path));
  @override
  Future<HttpClientRequest> deleteUrl(Uri url) => openUrl('DELETE', url);
  @override
  Future<HttpClientRequest> patch(String host, int port, String path) =>
      openUrl('PATCH', Uri(scheme: 'http', host: host, port: port, path: path));
  @override
  Future<HttpClientRequest> patchUrl(Uri url) => openUrl('PATCH', url);
  @override
  Future<HttpClientRequest> head(String host, int port, String path) =>
      openUrl('HEAD', Uri(scheme: 'http', host: host, port: port, path: path));
  @override
  Future<HttpClientRequest> headUrl(Uri url) => openUrl('HEAD', url);

  @override
  set autoUncompress(bool value) => _inner.autoUncompress = value;
  @override
  bool get autoUncompress => _inner.autoUncompress;
  @override
  set connectionTimeout(Duration? value) => _inner.connectionTimeout = value;
  @override
  Duration? get connectionTimeout => _inner.connectionTimeout;
  @override
  set idleTimeout(Duration value) => _inner.idleTimeout = value;
  @override
  Duration get idleTimeout => _inner.idleTimeout;
  @override
  set maxConnectionsPerHost(int? value) => _inner.maxConnectionsPerHost = value;
  @override
  int? get maxConnectionsPerHost => _inner.maxConnectionsPerHost;
  @override
  set userAgent(String? value) => _inner.userAgent = value;
  @override
  String? get userAgent => _inner.userAgent;

  @override
  void close({bool force = false}) => _inner.close(force: force);

  @override
  void addCredentials(Uri url, String realm, HttpClientCredentials credentials) =>
      _inner.addCredentials(url, realm, credentials);

  @override
  void addProxyCredentials(
          String host, int port, String realm, HttpClientCredentials credentials) =>
      _inner.addProxyCredentials(host, port, realm, credentials);

  @override
  set authenticate(Future<bool> Function(Uri url, String scheme, String? realm)? f) =>
      _inner.authenticate = f;

  @override
  set authenticateProxy(
          Future<bool> Function(String host, int port, String scheme, String? realm)? f) =>
      _inner.authenticateProxy = f;

  @override
  set badCertificateCallback(bool Function(X509Certificate cert, String host, int port)? cb) =>
      _inner.badCertificateCallback = cb;

  @override
  set findProxy(String Function(Uri url)? f) => _inner.findProxy = f;

  @override
  set keyLog(Function(String line)? cb) => _inner.keyLog = cb;

  @override
  noSuchMethod(Invocation invocation) {
    // Forward any newer HttpClient APIs (e.g. connectionFactory) we don't
    // explicitly mirror to the inner client. This keeps the wrapper compatible
    // across Flutter SDK versions that add new members.
    return (_inner as dynamic).noSuchMethod(invocation);
  }
}

class _OwlHttpClientRequest implements HttpClientRequest {
  final HttpClientRequest _inner;
  final OwlScope _client;
  final String _method;
  final Uri _url;
  final Stopwatch _sw = Stopwatch()..start();
  final int _startedAt = DateTime.now().millisecondsSinceEpoch;
  final List<int> _bodyBuffer = [];

  _OwlHttpClientRequest(this._inner, this._client, this._method, this._url);

  Map<String, String> _captureRequestHeaders() {
    final out = <String, String>{};
    _inner.headers.forEach((k, v) {
      out[k] = v.join(', ');
    });
    return out;
  }

  @override
  Future<HttpClientResponse> close() async {
    final reqHeaders = _captureRequestHeaders();
    final reqBodyText = _bodyBuffer.isEmpty
        ? null
        : (() {
            try {
              return utf8.decode(_bodyBuffer.take(_maxBodyBytes).toList());
            } catch (_) {
              return '[Binary body: ${_bodyBuffer.length} bytes]';
            }
          })();
    final reqBody = reqBodyText is String ? _tryJson(reqBodyText) : reqBodyText;

    HttpClientResponse response;
    try {
      response = await _inner.close();
    } catch (err, stack) {
      _sw.stop();
      _client.emit(
        type: EventTypes.networkResponse,
        level: LogLevels.error,
        payload: {
          'method': _method,
          'url': _url.toString(),
          'status': 0,
          'error': err.toString(),
          'duration': _sw.elapsedMilliseconds,
          'startedAt': _startedAt,
          'requestHeaders': reqHeaders,
          'requestBody': reqBody,
        },
        meta: {
          'duration': _sw.elapsedMilliseconds,
          'stackTrace': stack.toString(),
        },
      );
      rethrow;
    }

    final responseHeaders = <String, String>{};
    response.headers.forEach((k, v) => responseHeaders[k] = v.join(', '));

    final bytes = <int>[];
    final controller = StreamController<List<int>>();
    response.listen(
      (chunk) {
        if (bytes.length < _maxBodyBytes) {
          bytes.addAll(chunk);
        }
        controller.add(chunk);
      },
      onDone: () async {
        await controller.close();
        _sw.stop();
        final ct = (responseHeaders['content-type'] ?? '').toLowerCase();
        dynamic responseBody;
        try {
          if (ct.contains('application/json') ||
              ct.startsWith('text/') ||
              ct.contains('xml')) {
            final text = utf8.decode(bytes, allowMalformed: true);
            responseBody = ct.contains('application/json') ? _tryJson(text) : text;
          } else {
            responseBody = '[Binary: ${bytes.length} bytes, $ct]';
          }
        } catch (_) {
          responseBody = '[unreadable]';
        }
        _client.emit(
          type: EventTypes.networkResponse,
          level: response.statusCode >= 400 ? LogLevels.warn : null,
          payload: {
            'method': _method,
            'url': _url.toString(),
            'status': response.statusCode,
            'statusText': response.reasonPhrase,
            'ok': response.statusCode >= 200 && response.statusCode < 300,
            'duration': _sw.elapsedMilliseconds,
            'startedAt': _startedAt,
            'requestHeaders': reqHeaders,
            'requestBody': reqBody,
            'responseHeaders': responseHeaders,
            'responseBody': responseBody,
          },
          meta: {'duration': _sw.elapsedMilliseconds},
        );
      },
      onError: (e) => controller.addError(e as Object),
      cancelOnError: false,
    );

    return _ProxyHttpResponse(response, controller.stream);
  }

  @override
  void add(List<int> data) {
    if (_bodyBuffer.length < _maxBodyBytes) _bodyBuffer.addAll(data);
    _inner.add(data);
  }

  @override
  Future<dynamic> addStream(Stream<List<int>> stream) {
    return stream.listen((chunk) {
      if (_bodyBuffer.length < _maxBodyBytes) _bodyBuffer.addAll(chunk);
      _inner.add(chunk);
    }).asFuture<void>();
  }

  @override
  void write(Object? object) {
    final s = object?.toString() ?? '';
    final bytes = utf8.encode(s);
    if (_bodyBuffer.length < _maxBodyBytes) _bodyBuffer.addAll(bytes);
    _inner.write(object);
  }

  @override
  void writeAll(Iterable objects, [String separator = ""]) =>
      write(objects.join(separator));

  @override
  void writeCharCode(int charCode) => write(String.fromCharCode(charCode));

  @override
  void writeln([Object? object = ""]) => write('${object ?? ''}\n');

  @override
  Future<HttpClientResponse> get done => _inner.done;

  @override
  Future<dynamic> flush() => _inner.flush();

  @override
  HttpHeaders get headers => _inner.headers;

  @override
  HttpConnectionInfo? get connectionInfo => _inner.connectionInfo;

  @override
  List<Cookie> get cookies => _inner.cookies;

  @override
  Encoding get encoding => _inner.encoding;
  @override
  set encoding(Encoding value) => _inner.encoding = value;

  @override
  bool get bufferOutput => _inner.bufferOutput;
  @override
  set bufferOutput(bool value) => _inner.bufferOutput = value;

  @override
  int get contentLength => _inner.contentLength;
  @override
  set contentLength(int value) => _inner.contentLength = value;

  @override
  bool get followRedirects => _inner.followRedirects;
  @override
  set followRedirects(bool value) => _inner.followRedirects = value;

  @override
  int get maxRedirects => _inner.maxRedirects;
  @override
  set maxRedirects(int value) => _inner.maxRedirects = value;

  @override
  bool get persistentConnection => _inner.persistentConnection;
  @override
  set persistentConnection(bool value) => _inner.persistentConnection = value;

  @override
  String get method => _inner.method;

  @override
  Uri get uri => _inner.uri;

  @override
  void abort([Object? exception, StackTrace? stackTrace]) =>
      _inner.abort(exception, stackTrace);

  @override
  void addError(Object error, [StackTrace? stackTrace]) =>
      _inner.addError(error, stackTrace);
}

class _ProxyHttpResponse extends StreamView<List<int>> implements HttpClientResponse {
  final HttpClientResponse _inner;
  _ProxyHttpResponse(this._inner, Stream<List<int>> stream) : super(stream);

  @override
  X509Certificate? get certificate => _inner.certificate;
  @override
  HttpClientResponseCompressionState get compressionState => _inner.compressionState;
  @override
  HttpConnectionInfo? get connectionInfo => _inner.connectionInfo;
  @override
  int get contentLength => _inner.contentLength;
  @override
  List<Cookie> get cookies => _inner.cookies;
  @override
  Future<Socket> detachSocket() => _inner.detachSocket();
  @override
  HttpHeaders get headers => _inner.headers;
  @override
  bool get isRedirect => _inner.isRedirect;
  @override
  bool get persistentConnection => _inner.persistentConnection;
  @override
  String get reasonPhrase => _inner.reasonPhrase;
  @override
  Future<HttpClientResponse> redirect([String? method, Uri? url, bool? followLoops]) =>
      _inner.redirect(method, url, followLoops);
  @override
  List<RedirectInfo> get redirects => _inner.redirects;
  @override
  int get statusCode => _inner.statusCode;
}
