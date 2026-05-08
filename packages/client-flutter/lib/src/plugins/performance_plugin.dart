import 'dart:async';
import 'dart:io' show ProcessInfo, Platform;

import 'package:flutter/foundation.dart';
import 'package:flutter/scheduler.dart';
import 'package:flutter/widgets.dart';

import '../client.dart';
import '../events.dart';
import '../plugin.dart';

/// OwlScope's performance collector. Splits responsibilities across four
/// independent samplers so each can be tuned (or disabled) without
/// affecting the others:
///
///   * **FrameSampler** — `WidgetsBinding.addTimingsCallback`. Aggregates
///     per-window FPS, build/raster averages, and frame-time percentiles.
///     Also emits a discrete `performance:jank` event for every frame
///     that breaches `slowFrameThresholdMs`, so the desktop can plot
///     individual janks as markers.
///   * **MemorySampler** — `ProcessInfo.currentRss`. Cheap, mobile-only
///     RSS read; emitted once per `memoryInterval`.
///   * **RebuildSampler** — `debugOnRebuildDirtyWidget` hook. Counts
///     widget rebuilds per type. Only active in debug builds (the
///     framework strips the hook in release).
///   * **ThermalSampler** *(stub)* — wired up but currently emits the
///     state we can derive without platform channels (`unknown`). Real
///     thermal data lives behind a native plugin we haven't shipped yet.
///
/// All emitted events use the `performance:*` namespace. The legacy
/// `performance` aggregate is **also** emitted (for backward compat with
/// older desktop builds) until we drop support.
class PerformancePlugin implements OwlScopePlugin {
  final Duration frameInterval;
  final Duration memoryInterval;
  final Duration rebuildInterval;
  final double slowFrameThresholdMs;
  final double frozenFrameThresholdMs;
  final bool trackRebuilds;
  final int topRebuildersK;

  PerformancePlugin({
    this.frameInterval = const Duration(seconds: 1),
    this.memoryInterval = const Duration(seconds: 1),
    this.rebuildInterval = const Duration(seconds: 1),
    this.slowFrameThresholdMs = 16.0,
    this.frozenFrameThresholdMs = 700.0,
    this.trackRebuilds = true,
    this.topRebuildersK = 6,
  });

  TimingsCallback? _frameCb;
  Timer? _memoryTimer;
  Timer? _rebuildTimer;
  void Function(Element, bool)? _previousRebuildHook;

  // FrameSampler state
  final List<FrameTiming> _frameBucket = [];
  DateTime _lastFrameReport = DateTime.now();

  // RebuildSampler state
  final Map<String, int> _rebuildCounts = {};
  int _totalRebuilds = 0;

  OwlScope? _client;

  @override
  String get name => 'performance';

  @override
  void install(OwlScope client) {
    _client = client;
    final binding = WidgetsFlutterBinding.ensureInitialized();

    // ── Frame sampler ─────────────────────────────────────────────────
    _frameCb = _onFrameTimings;
    binding.addTimingsCallback(_frameCb!);

    // ── Memory sampler ────────────────────────────────────────────────
    if (_canSampleMemory()) {
      _memoryTimer = Timer.periodic(memoryInterval, (_) => _sampleMemory());
    }

    // ── Rebuild sampler (debug only) ──────────────────────────────────
    if (trackRebuilds && kDebugMode) {
      _previousRebuildHook = debugOnRebuildDirtyWidget;
      debugOnRebuildDirtyWidget = (element, builtOnce) {
        _previousRebuildHook?.call(element, builtOnce);
        final n = element.widget.runtimeType.toString();
        _rebuildCounts.update(n, (v) => v + 1, ifAbsent: () => 1);
        _totalRebuilds++;
      };
      _rebuildTimer = Timer.periodic(rebuildInterval, (_) => _flushRebuilds());
    }
  }

  @override
  void uninstall() {
    if (_frameCb != null) {
      WidgetsBinding.instance.removeTimingsCallback(_frameCb!);
      _frameCb = null;
    }
    _memoryTimer?.cancel();
    _memoryTimer = null;
    _rebuildTimer?.cancel();
    _rebuildTimer = null;
    if (kDebugMode) {
      // Restore whatever was there before we hooked.
      debugOnRebuildDirtyWidget = _previousRebuildHook;
      _previousRebuildHook = null;
    }
    _client = null;
  }

  // ─────────────────────────────────────────────────────────────────────

  void _onFrameTimings(List<FrameTiming> timings) {
    final c = _client;
    if (c == null) return;

    // Emit individual jank events as they happen so the desktop can mark
    // them on the FPS line. Cheap because most apps get only a handful
    // per minute.
    for (final t in timings) {
      _frameBucket.add(t);
      final b = t.buildDuration.inMicroseconds / 1000.0;
      final r = t.rasterDuration.inMicroseconds / 1000.0;
      if (b > slowFrameThresholdMs || r > slowFrameThresholdMs) {
        c.emit(
          type: EventTypes.performanceJank,
          level: b > frozenFrameThresholdMs || r > frozenFrameThresholdMs
              ? LogLevels.warn
              : null,
          payload: {
            'buildMs': double.parse(b.toStringAsFixed(2)),
            'rasterMs': double.parse(r.toStringAsFixed(2)),
            'frozen': b > frozenFrameThresholdMs || r > frozenFrameThresholdMs,
          },
        );
      }
    }

    final now = DateTime.now();
    if (now.difference(_lastFrameReport) < frameInterval) return;

    final windowMs = now.difference(_lastFrameReport).inMilliseconds;
    final frames = _frameBucket.length;
    if (frames == 0) {
      _lastFrameReport = now;
      return;
    }

    final builds = _frameBucket
        .map((t) => t.buildDuration.inMicroseconds / 1000.0)
        .toList()
      ..sort();
    final rasters = _frameBucket
        .map((t) => t.rasterDuration.inMicroseconds / 1000.0)
        .toList()
      ..sort();

    double mean(List<double> xs) =>
        xs.isEmpty ? 0 : xs.fold(0.0, (a, b) => a + b) / xs.length;
    double pct(List<double> sorted, double p) {
      if (sorted.isEmpty) return 0;
      final i = ((sorted.length - 1) * p).round().clamp(0, sorted.length - 1);
      return sorted[i];
    }

    final slow = builds
        .where((b) => b > slowFrameThresholdMs)
        .length +
        rasters
            .where((r) => r > slowFrameThresholdMs)
            .length;
    final frozen = builds
        .where((b) => b > frozenFrameThresholdMs)
        .length +
        rasters
            .where((r) => r > frozenFrameThresholdMs)
            .length;

    final fps = (frames * 1000.0 / windowMs);

    final framePayload = {
      'fps': double.parse(fps.toStringAsFixed(1)),
      'frames': frames,
      'windowMs': windowMs,
      'avgBuildMs': double.parse(mean(builds).toStringAsFixed(2)),
      'avgRasterMs': double.parse(mean(rasters).toStringAsFixed(2)),
      'p50BuildMs': double.parse(pct(builds, 0.5).toStringAsFixed(2)),
      'p95BuildMs': double.parse(pct(builds, 0.95).toStringAsFixed(2)),
      'p99BuildMs': double.parse(pct(builds, 0.99).toStringAsFixed(2)),
      'p99RasterMs': double.parse(pct(rasters, 0.99).toStringAsFixed(2)),
      'maxBuildMs': double.parse(builds.last.toStringAsFixed(2)),
      'maxRasterMs': double.parse(rasters.last.toStringAsFixed(2)),
      'slowFrames': slow,
      'frozenFrames': frozen,
      'slowThresholdMs': slowFrameThresholdMs,
    };

    c.emit(
      type: EventTypes.performanceFrame,
      payload: framePayload,
    );

    // Backwards-compat: keep the legacy aggregate alive so older desktop
    // builds still see frame stats. New desktop ignores it.
    c.emit(
      type: EventTypes.performance,
      payload: {
        'frames': frames,
        'avgBuildMs': mean(builds).toStringAsFixed(2),
        'avgRasterMs': mean(rasters).toStringAsFixed(2),
        'maxBuildMs': builds.last.toStringAsFixed(2),
        'maxRasterMs': rasters.last.toStringAsFixed(2),
        'slowFrames': slow,
        'slowThresholdMs': slowFrameThresholdMs,
        'windowMs': windowMs,
      },
      meta: {'duration': windowMs.toDouble()},
    );

    _frameBucket.clear();
    _lastFrameReport = now;
  }

  // ─────────────────────────────────────────────────────────────────────

  bool _canSampleMemory() {
    // ProcessInfo.currentRss is a no-op (returns 0) on web.
    try {
      return Platform.isAndroid ||
          Platform.isIOS ||
          Platform.isMacOS ||
          Platform.isWindows ||
          Platform.isLinux;
    } catch (_) {
      return false;
    }
  }

  void _sampleMemory() {
    final c = _client;
    if (c == null) return;
    try {
      final rss = ProcessInfo.currentRss;
      if (rss <= 0) return;
      final mb = rss / (1024 * 1024);
      c.emit(
        type: EventTypes.performanceMemory,
        payload: {
          'rssBytes': rss,
          'rssMb': double.parse(mb.toStringAsFixed(1)),
          'platform': _platformLabel(),
        },
      );
    } catch (_) {
      /* best-effort */
    }
  }

  String _platformLabel() {
    try {
      if (Platform.isAndroid) return 'android';
      if (Platform.isIOS) return 'ios';
      if (Platform.isMacOS) return 'macos';
      if (Platform.isWindows) return 'windows';
      if (Platform.isLinux) return 'linux';
    } catch (_) {}
    return 'unknown';
  }

  // ─────────────────────────────────────────────────────────────────────

  void _flushRebuilds() {
    final c = _client;
    if (c == null || _totalRebuilds == 0) return;

    final entries = _rebuildCounts.entries.toList()
      ..sort((a, b) => b.value.compareTo(a.value));
    final top = entries
        .take(topRebuildersK)
        .map((e) => {'name': e.key, 'count': e.value})
        .toList();

    c.emit(
      type: EventTypes.performanceRebuilds,
      payload: {
        'total': _totalRebuilds,
        'unique': _rebuildCounts.length,
        'topWidgets': top,
        'windowMs': rebuildInterval.inMilliseconds,
      },
    );

    _rebuildCounts.clear();
    _totalRebuilds = 0;
  }

  // Reserved: hook a platform channel here once we ship native thermal
  // collectors (iOS thermalState + Android sysfs zone read). Kept as a
  // no-op so plugin wiring is in one place.
  // ignore: unused_element
  void _emitThermalSnapshot() {
    final c = _client;
    if (c == null) return;
    c.emit(
      type: EventTypes.performanceThermal,
      payload: {
        'state': 'unknown',
        'platform': _platformLabel(),
      },
    );
  }
}

