// ignore_for_file: avoid_print
import 'dart:io';

/// `adb reverse tcp:<port> tcp:<port>` for every connected Android device.
/// Lets a physical Android phone reach the OwlScope desktop via `localhost`.
/// Run this any time you (re)connect an Android device or reboot your computer.
void runReverse({int port = 9090}) {
  final adb = _findAdb();
  if (adb == null) {
    print('OwlScope reverse: adb not found in PATH or ANDROID_HOME.');
    print('Install Android platform-tools, then re-run this command.');
    exitCode = 1;
    return;
  }

  print('OwlScope reverse — using adb at: $adb\n');

  ProcessResult devices;
  try {
    devices = Process.runSync(adb, ['devices']);
  } catch (e) {
    print('Failed to run adb: $e');
    exitCode = 1;
    return;
  }

  final lines = (devices.stdout as String).split('\n');
  final connected = <String>[];
  for (final raw in lines.skip(1)) {
    final line = raw.trim();
    if (line.isEmpty) continue;
    final parts = line.split(RegExp(r'\s+'));
    if (parts.length < 2) continue;
    if (parts[1] == 'device') connected.add(parts[0]);
  }

  if (connected.isEmpty) {
    print('No Android devices found. Plug in a phone (USB debugging on)');
    print('or start an emulator, then re-run this command.');
    return;
  }

  for (final id in connected) {
    final r = Process.runSync(adb, ['-s', id, 'reverse', 'tcp:$port', 'tcp:$port']);
    final ok = r.exitCode == 0;
    print('  ${ok ? "✓" : "✘"} $id  →  localhost:$port'
        '${ok ? "" : "  (${(r.stderr as String).trim()})"}');
  }

  print('\nDone. Now `localhost:$port` on these devices points at this Mac.');
  print('Re-run after reboot, USB reconnect, or `adb kill-server`.');
}

String? _findAdb() {
  final fromPath = Process.runSync('which', ['adb']);
  if (fromPath.exitCode == 0) {
    final p = (fromPath.stdout as String).trim();
    if (p.isNotEmpty && File(p).existsSync()) return p;
  }
  final candidates = <String>[
    if (Platform.environment['ANDROID_HOME'] != null)
      '${Platform.environment['ANDROID_HOME']}/platform-tools/adb',
    if (Platform.environment['ANDROID_SDK_ROOT'] != null)
      '${Platform.environment['ANDROID_SDK_ROOT']}/platform-tools/adb',
    '${Platform.environment['HOME']}/Library/Android/sdk/platform-tools/adb',
    '${Platform.environment['HOME']}/Android/Sdk/platform-tools/adb',
  ];
  for (final c in candidates) {
    if (File(c).existsSync()) return c;
  }
  return null;
}
