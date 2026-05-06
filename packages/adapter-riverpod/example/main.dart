// Minimal owlscope_riverpod example. See the package README for full
// integration instructions.

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:owlscope/auto.dart';
import 'package:owlscope_riverpod/owlscope_riverpod.dart';

class CounterNotifier extends Notifier<int> {
  @override
  int build() => 0;

  void increment() => state++;
}

final counterProvider = NotifierProvider<CounterNotifier, int>(
  CounterNotifier.new,
  name: 'counter',
);

void main() {
  owlscopeAuto(() {
    runApp(
      ProviderScope(
        observers: [if (kDebugMode) OwlScopeRiverpodObserver()],
        child: const ExampleApp(),
      ),
    );
  });
}

class ExampleApp extends ConsumerWidget {
  const ExampleApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final count = ref.watch(counterProvider);
    return MaterialApp(
      home: Scaffold(
        appBar: AppBar(title: const Text('owlscope_riverpod example')),
        body: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text('counter: $count'),
              const SizedBox(height: 12),
              ElevatedButton(
                onPressed: () => ref.read(counterProvider.notifier).increment(),
                child: const Text('increment (watch State panel in OwlScope)'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
