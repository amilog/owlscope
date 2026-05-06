import 'dart:io' show Platform;

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:http/http.dart' as http;
import 'package:owlscope/auto.dart';
import 'package:owlscope/owlscope.dart';
import 'package:owlscope_riverpod/owlscope_riverpod.dart';

String _resolveHost() {
  if (kIsWeb) return 'localhost';
  try {
    if (Platform.isAndroid) return '10.0.2.2';
  } catch (_) {}
  return 'localhost';
}

// ─── Riverpod providers (Riverpod 3.x Notifier API) ────────────────────
class CounterNotifier extends Notifier<int> {
  @override
  int build() => 0;

  void increment() => state++;
  void reset() => state = 0;
}

class UsernameNotifier extends Notifier<String> {
  @override
  String build() => 'guest';

  void setName(String name) => state = name;
}

final counterProvider =
    NotifierProvider<CounterNotifier, int>(CounterNotifier.new, name: 'counter');
final usernameProvider = NotifierProvider<UsernameNotifier, String>(
  UsernameNotifier.new,
  name: 'username',
);
final greetingProvider = Provider<String>(
  (ref) => 'Hello, ${ref.watch(usernameProvider)}!',
  name: 'greeting',
);

void main() {
  owlscopeAuto(
    () => runApp(
      ProviderScope(
        observers: [if (kDebugMode) OwlScopeRiverpodObserver()],
        child: const DemoApp(),
      ),
    ),
    name: 'owlscope-demo-flutter',
    host: _resolveHost(),
    port: 9090,
  );
}

class DemoApp extends StatelessWidget {
  const DemoApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'OwlScope Demo (Flutter)',
      navigatorObservers: [owlscopeNavigatorObserver],
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(
          seedColor: Colors.blue,
          brightness: Brightness.dark,
        ),
        useMaterial3: true,
      ),
      home: const HomePage(),
    );
  }
}

class HomePage extends ConsumerStatefulWidget {
  const HomePage({super.key});

  @override
  ConsumerState<HomePage> createState() => _HomePageState();
}

class _HomePageState extends ConsumerState<HomePage> {
  int _count = 0;

  Future<void> _fireGet() async {
    final res = await http.get(
      Uri.parse('https://jsonplaceholder.typicode.com/posts/1'),
    );
    debugPrint('GET /posts/1 → ${res.statusCode}');
  }

  Future<void> _firePost() async {
    final res = await http.post(
      Uri.parse('https://jsonplaceholder.typicode.com/posts'),
      headers: {'Content-Type': 'application/json'},
      body: '{"title":"OwlScope Flutter","body":"hi","userId":1}',
    );
    debugPrint('POST /posts → ${res.statusCode}');
  }

  Future<void> _fire404() async {
    final res = await http.get(
      Uri.parse('https://jsonplaceholder.typicode.com/does-not-exist'),
    );
    debugPrint('GET /404 → ${res.statusCode}');
  }

  void _firePrint() {
    debugPrint('Hello from Flutter demo at ${DateTime.now()}');
    // ignore: avoid_print
    print('plain print(): count=$_count');
  }

  void _fireError() {
    try {
      throw StateError('Demo Flutter error');
    } catch (e, st) {
      OwlScope.instance.error('Caught', error: e, stackTrace: st);
    }
  }

  void _fireUncaught() {
    Future.microtask(() {
      throw Exception('Uncaught async error from Flutter demo');
    });
  }

  void _fireCustom() {
    OwlScope.instance.event('user-action', {
      'type': 'click',
      'target': 'fire-custom',
      'count': _count,
    });
  }

  void _pushDetail() {
    Navigator.of(context).push(
      MaterialPageRoute(
        settings: const RouteSettings(name: '/detail'),
        builder: (_) => const DetailPage(),
      ),
    );
  }

  void _burst() {
    for (int i = 0; i < 100; i++) {
      debugPrint('burst #$i');
    }
  }

  void _bumpRiverpodCounter() {
    ref.read(counterProvider.notifier).increment();
  }

  void _resetRiverpodCounter() {
    ref.read(counterProvider.notifier).reset();
  }

  void _changeUsername() {
    final names = ['guest', 'amin', 'reactotron', 'flutter-fan'];
    final current = ref.read(usernameProvider);
    final next = names[(names.indexOf(current) + 1) % names.length];
    ref.read(usernameProvider.notifier).setName(next);
  }

  @override
  Widget build(BuildContext context) {
    final riverpodCount = ref.watch(counterProvider);
    final greeting = ref.watch(greetingProvider);

    final buttons = <Widget>[
      _Btn('print / debugPrint', _firePrint),
      _Btn('caught error', _fireError),
      _Btn('uncaught async error', _fireUncaught),
      _Btn("OwlScope.event('user-action')", _fireCustom),
      _Btn('http GET /posts/1', _fireGet),
      _Btn('http POST /posts', _firePost),
      _Btn('http 404', _fire404),
      _Btn('burst (100 prints)', _burst),
      _Btn('push /detail', _pushDetail),
    ];

    return Scaffold(
      appBar: AppBar(title: const Text('OwlScope Demo (Flutter)')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          const Text(
            'Open the OwlScope desktop app first. Events are forwarded over '
            'WebSocket to ws://localhost:9090.',
          ),
          const SizedBox(height: 16),
          Wrap(spacing: 8, runSpacing: 8, children: buttons),
          const SizedBox(height: 24),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(12),
              child: Row(
                children: [
                  ElevatedButton(
                    onPressed: () => setState(() => _count++),
                    child: Text('count is $_count'),
                  ),
                  const SizedBox(width: 12),
                  const Text('triggers a rebuild'),
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Riverpod state — open the State panel in OwlScope',
                    style: TextStyle(fontWeight: FontWeight.w600),
                  ),
                  const SizedBox(height: 8),
                  Text('counter: $riverpodCount'),
                  Text(greeting),
                  const SizedBox(height: 8),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: [
                      _Btn('counter++', _bumpRiverpodCounter),
                      _Btn('reset counter', _resetRiverpodCounter),
                      _Btn('cycle username', _changeUsername),
                    ],
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _Btn extends StatelessWidget {
  final String label;
  final VoidCallback onPressed;
  const _Btn(this.label, this.onPressed);

  @override
  Widget build(BuildContext context) =>
      OutlinedButton(onPressed: onPressed, child: Text(label));
}

class DetailPage extends StatelessWidget {
  const DetailPage({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Detail')),
      body: const Center(child: Text('Pop me to test navigation:pop')),
    );
  }
}
