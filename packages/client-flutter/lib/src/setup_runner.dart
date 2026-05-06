// ignore_for_file: avoid_print
import 'dart:io';

enum _Mode { install, uninstall }

const _macosMarker =
    '<key>com.apple.security.network.client</key>\n\t<true/>';
const _macosLooseMarker = 'com.apple.security.network.client';

const _iosBlock = '''
\t<key>NSAppTransportSecurity</key>
\t<dict>
\t\t<key>NSAllowsLocalNetworking</key>
\t\t<true/>
\t</dict>''';
const _iosLooseMarker = 'NSAllowsLocalNetworking';
const _iosKeyMarker = 'NSAppTransportSecurity';

const _androidMarker = '<!-- owlscope:setup -->';
const _androidAppBlock = '''
    $_androidMarker
    <application
        android:usesCleartextTraffic="true"
        tools:replace="android:usesCleartextTraffic" />
''';
const _androidFreshFile = '''<?xml version="1.0" encoding="utf-8"?>
<!-- Added by owlscope:setup. Run "dart run owlscope:teardown" to remove. -->
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
          xmlns:tools="http://schemas.android.com/tools">
    <uses-permission android:name="android.permission.INTERNET"/>
    <application
        android:usesCleartextTraffic="true"
        tools:replace="android:usesCleartextTraffic" />
</manifest>
''';

bool _patchMacEntitlements(String original, _Mode mode, void Function(String) write) {
  final hasIt = original.contains(_macosLooseMarker);
  if (mode == _Mode.install) {
    if (hasIt) return false;
    final idx = original.lastIndexOf('</dict>');
    if (idx == -1) return false;
    final patched = original.replaceRange(
      idx,
      idx,
      '\t$_macosMarker\n',
    );
    write(patched);
    return true;
  } else {
    if (!hasIt) return false;
    final pattern = RegExp(
      r'\s*<key>com\.apple\.security\.network\.client</key>\s*<true\s*/>',
      multiLine: true,
    );
    final patched = original.replaceAll(pattern, '');
    write(patched);
    return true;
  }
}

bool _patchInfoPlist(String original, _Mode mode, void Function(String) write) {
  final hasLoose = original.contains(_iosLooseMarker);
  if (mode == _Mode.install) {
    if (hasLoose) return false;
    if (original.contains(_iosKeyMarker)) {
      // ATS dict already exists — append the localnetworking key inside that dict.
      final pattern = RegExp(
        r'<key>NSAppTransportSecurity</key>\s*<dict>',
      );
      final patched = original.replaceFirstMapped(pattern, (m) {
        return '${m.group(0)}\n\t\t<key>NSAllowsLocalNetworking</key>\n\t\t<true/>';
      });
      if (patched == original) return false;
      write(patched);
      return true;
    }
    // No ATS dict — insert before final </dict>.
    final idx = original.lastIndexOf('</dict>');
    if (idx == -1) return false;
    final patched = original.replaceRange(idx, idx, '$_iosBlock\n');
    write(patched);
    return true;
  } else {
    if (!hasLoose) return false;
    // Remove just our two-line key when it sits in our dedicated block; if ATS dict
    // contains other keys, only strip NSAllowsLocalNetworking, leaving rest intact.
    var patched = original;
    final blockPattern = RegExp(
      r'\n?\s*<key>NSAppTransportSecurity</key>\s*<dict>\s*<key>NSAllowsLocalNetworking</key>\s*<true\s*/>\s*</dict>',
    );
    if (blockPattern.hasMatch(patched)) {
      patched = patched.replaceAll(blockPattern, '');
    } else {
      final innerPattern = RegExp(
        r'\s*<key>NSAllowsLocalNetworking</key>\s*<true\s*/>',
      );
      patched = patched.replaceAll(innerPattern, '');
    }
    if (patched == original) return false;
    write(patched);
    return true;
  }
}

bool _writeAndroidDebugManifest(_Mode mode, File f) {
  if (mode == _Mode.install) {
    if (!f.existsSync()) {
      f.createSync(recursive: true);
      f.writeAsStringSync(_androidFreshFile);
      return true;
    }
    final original = f.readAsStringSync();
    if (original.contains(_androidMarker)) return false; // already done

    var patched = original;
    if (!patched.contains('xmlns:tools=')) {
      patched = patched.replaceFirstMapped(
        RegExp(r'<manifest([^>]*)>'),
        (m) =>
            '<manifest${m.group(1)} xmlns:tools="http://schemas.android.com/tools">',
      );
    }
    patched = patched.replaceFirst('</manifest>', '$_androidAppBlock</manifest>');
    f.writeAsStringSync(patched);
    return true;
  } else {
    if (!f.existsSync()) return false;
    final original = f.readAsStringSync();

    if (original.contains('Added by owlscope:setup')) {
      // We created the entire file ourselves — safe to delete.
      f.deleteSync();
      return true;
    }
    if (original.contains(_androidMarker)) {
      final pattern = RegExp(
        r'\s*<!-- owlscope:setup -->\s*<application[^/]*android:usesCleartextTraffic[^/]*/>',
      );
      final patched = original.replaceAll(pattern, '');
      if (patched == original) return false;
      f.writeAsStringSync(patched);
      return true;
    }
    return false;
  }
}

void _runSetup(_Mode mode) {
  final cwd = Directory.current.path;
  final pubspec = File('$cwd/pubspec.yaml');
  if (!pubspec.existsSync()) {
    print('owlscope: no pubspec.yaml in current directory ($cwd)');
    exitCode = 1;
    return;
  }

  final modeLabel = mode == _Mode.install ? 'setup' : 'teardown';
  print('OwlScope $modeLabel — project: $cwd\n');

  final results = <String>[];

  // macOS
  final macFile = File('$cwd/macos/Runner/DebugProfile.entitlements');
  if (macFile.existsSync()) {
    final original = macFile.readAsStringSync();
    final changed = _patchMacEntitlements(original, mode, macFile.writeAsStringSync);
    results.add(changed
        ? '  ✓ macOS entitlements ${mode == _Mode.install ? "patched" : "reverted"}'
        : '  · macOS entitlements already ${mode == _Mode.install ? "set" : "clean"}');
  } else {
    results.add('  · macOS: no DebugProfile.entitlements (skipped)');
  }

  // iOS
  final iosFile = File('$cwd/ios/Runner/Info.plist');
  if (iosFile.existsSync()) {
    final original = iosFile.readAsStringSync();
    final changed = _patchInfoPlist(original, mode, iosFile.writeAsStringSync);
    results.add(changed
        ? '  ✓ iOS Info.plist ${mode == _Mode.install ? "patched" : "reverted"}'
        : '  · iOS Info.plist already ${mode == _Mode.install ? "set" : "clean"}');
  } else {
    results.add('  · iOS: no Runner/Info.plist (skipped)');
  }

  // Android (debug-only manifest file)
  final androidDir = Directory('$cwd/android/app');
  if (androidDir.existsSync()) {
    final f = File('$cwd/android/app/src/debug/AndroidManifest.xml');
    final changed = _writeAndroidDebugManifest(mode, f);
    results.add(changed
        ? '  ✓ Android debug manifest ${mode == _Mode.install ? "created" : "removed"}'
        : '  · Android debug manifest already ${mode == _Mode.install ? "present" : "absent or user-owned"}');
  } else {
    results.add('  · Android: no android/app directory (skipped)');
  }

  for (final r in results) {
    print(r);
  }

  print('');
  if (mode == _Mode.install) {
    print('Done. You can now run: flutter run');
    print('To revert later: dart run owlscope:teardown');
  } else {
    print('Reverted. Remove the import from your code and pubspec to fully detach:');
    print('  flutter pub remove owlscope');
  }
}

void runInstall() => _runSetup(_Mode.install);
void runUninstall() => _runSetup(_Mode.uninstall);
