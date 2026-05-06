// Minimal OwlScope example. See the package README for full integration
// instructions.
//
// Run the OwlScope desktop app first, then `flutter run` this example.

import 'package:flutter/material.dart';
import 'package:owlscope/auto.dart';
import 'package:owlscope/owlscope.dart';

void main() {
  owlscopeAuto(() => runApp(const OwlScopeExampleApp()), name: 'owlscope-example');
}

class OwlScopeExampleApp extends StatelessWidget {
  const OwlScopeExampleApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      navigatorObservers: [owlscopeNavigatorObserver],
      home: Scaffold(
        appBar: AppBar(title: const Text('OwlScope example')),
        body: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              ElevatedButton(
                onPressed: () => debugPrint('Hello from OwlScope at ${DateTime.now()}'),
                child: const Text('Send a log'),
              ),
              const SizedBox(height: 12),
              ElevatedButton(
                onPressed: () => OwlScope.instance.event('user-action', {'click': 'demo'}),
                child: const Text('Send a custom event'),
              ),
              const SizedBox(height: 12),
              ElevatedButton(
                onPressed: () {
                  try {
                    throw StateError('Demo error from OwlScope example');
                  } catch (e, st) {
                    OwlScope.instance.error('Caught', error: e, stackTrace: st);
                  }
                },
                child: const Text('Send an error'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
