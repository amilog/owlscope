import 'package:flutter/scheduler.dart';
import 'package:flutter/widgets.dart';

import '../client.dart';
import '../events.dart';
import '../plugin.dart';

/// Streams summarised frame timings (build + raster) every [reportInterval].
class PerformancePlugin implements OwlScopePlugin {
  final Duration reportInterval;
  final double slowFrameThresholdMs;

  PerformancePlugin({
    this.reportInterval = const Duration(seconds: 1),
    this.slowFrameThresholdMs = 16.0,
  });

  TimingsCallback? _callback;
  final List<FrameTiming> _bucket = [];
  DateTime _lastReport = DateTime.now();

  @override
  String get name => 'performance';

  @override
  void install(OwlScope client) {
    final binding = WidgetsFlutterBinding.ensureInitialized();
    _callback = (timings) {
      _bucket.addAll(timings);
      final now = DateTime.now();
      if (now.difference(_lastReport) < reportInterval) return;

      final frames = _bucket.length;
      if (frames == 0) {
        _lastReport = now;
        return;
      }

      double sumBuild = 0, sumRaster = 0, maxBuild = 0, maxRaster = 0;
      int slow = 0;
      for (final t in _bucket) {
        final b = t.buildDuration.inMicroseconds / 1000.0;
        final r = t.rasterDuration.inMicroseconds / 1000.0;
        sumBuild += b;
        sumRaster += r;
        if (b > maxBuild) maxBuild = b;
        if (r > maxRaster) maxRaster = r;
        if (b > slowFrameThresholdMs || r > slowFrameThresholdMs) slow++;
      }

      client.emit(
        type: EventTypes.performance,
        payload: {
          'frames': frames,
          'avgBuildMs': (sumBuild / frames).toStringAsFixed(2),
          'avgRasterMs': (sumRaster / frames).toStringAsFixed(2),
          'maxBuildMs': maxBuild.toStringAsFixed(2),
          'maxRasterMs': maxRaster.toStringAsFixed(2),
          'slowFrames': slow,
          'slowThresholdMs': slowFrameThresholdMs,
          'windowMs': reportInterval.inMilliseconds,
        },
        meta: {'duration': reportInterval.inMilliseconds.toDouble()},
      );

      _bucket.clear();
      _lastReport = now;
    };

    binding.addTimingsCallback(_callback!);
  }

  @override
  void uninstall() {
    if (_callback != null) {
      WidgetsBinding.instance.removeTimingsCallback(_callback!);
      _callback = null;
    }
  }
}
