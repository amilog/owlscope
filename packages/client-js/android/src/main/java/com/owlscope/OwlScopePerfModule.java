package com.owlscope;

import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.os.BatteryManager;
import android.os.Build;
import android.os.Debug;
import android.os.PowerManager;
import android.view.Choreographer;

import androidx.annotation.NonNull;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.modules.core.DeviceEventManagerModule;

import java.io.File;
import java.io.FileInputStream;
import java.util.Timer;
import java.util.TimerTask;

/**
 * OwlScope Android perf collector. Dev-only.
 *
 * Public APIs used:
 *   - Choreographer            UI thread FPS, frame intervals
 *   - Debug.MemoryInfo         RSS / native heap
 *   - PowerManager.thermal*    thermal state + headroom (API 29 / 30+)
 *   - BatteryManager           level, charging, current draw (uA), temp
 *   - /sys/class/thermal/...   per-zone CPU/SoC temperature in C (best effort)
 *
 * Sampled at 1 Hz, emits a single `perf:sample` event the JS plugin
 * splits into the protocol's `performance:frame` / `performance:memory`
 * / `performance:thermal` events.
 *
 * Kept in plain Java (not Kotlin) so the package compiles on every RN
 * scaffold without the host project needing the Kotlin Gradle plugin.
 */
public class OwlScopePerfModule extends ReactContextBaseJavaModule
    implements Choreographer.FrameCallback {

  private final ReactApplicationContext reactContext;
  private final Choreographer choreographer = Choreographer.getInstance();

  private long lastFrameTimeNs = 0;
  private int frameCount = 0;
  private double maxFrameMs = 0.0;
  private double sumFrameMs = 0.0;
  private int slowFrames = 0;
  private int frozenFrames = 0;
  private Timer sampleTimer;
  private volatile boolean running = false;

  public OwlScopePerfModule(ReactApplicationContext reactContext) {
    super(reactContext);
    this.reactContext = reactContext;
  }

  @NonNull
  @Override
  public String getName() {
    return "OwlScopePerf";
  }

  @ReactMethod
  public void start() {
    if (running) return;
    running = true;
    lastFrameTimeNs = 0;
    frameCount = 0;
    maxFrameMs = 0.0;
    sumFrameMs = 0.0;
    slowFrames = 0;
    frozenFrames = 0;
    choreographer.postFrameCallback(this);
    sampleTimer = new Timer();
    sampleTimer.schedule(
        new TimerTask() {
          @Override
          public void run() {
            emitSample();
          }
        },
        1000,
        1000);
  }

  @ReactMethod
  public void stop() {
    running = false;
    if (sampleTimer != null) {
      sampleTimer.cancel();
      sampleTimer = null;
    }
    choreographer.removeFrameCallback(this);
  }

  @ReactMethod
  public void addListener(String name) {
    /* RN event-emitter contract; nothing to do here. */
  }

  @ReactMethod
  public void removeListeners(int count) {
    /* RN event-emitter contract; nothing to do here. */
  }

  @Override
  public void doFrame(long frameTimeNanos) {
    if (lastFrameTimeNs > 0) {
      double deltaMs = (frameTimeNanos - lastFrameTimeNs) / 1_000_000.0;
      if (deltaMs > maxFrameMs) maxFrameMs = deltaMs;
      sumFrameMs += deltaMs;
      if (deltaMs > 16.7) slowFrames++;
      if (deltaMs > 700.0) frozenFrames++;
    }
    lastFrameTimeNs = frameTimeNanos;
    frameCount++;
    if (running) choreographer.postFrameCallback(this);
  }

  private void emitSample() {
    int frames = frameCount;
    double avgMs = frames > 0 ? sumFrameMs / frames : 0.0;

    WritableMap sample = Arguments.createMap();
    sample.putDouble("fps", frames);
    sample.putInt("frames", frames);
    sample.putDouble("avgFrameMs", avgMs);
    sample.putDouble("maxFrameMs", maxFrameMs);
    sample.putInt("slowFrames", slowFrames);
    sample.putInt("frozenFrames", frozenFrames);

    frameCount = 0;
    maxFrameMs = 0.0;
    sumFrameMs = 0.0;
    slowFrames = 0;
    frozenFrames = 0;

    sample.putMap("memory", memoryStats());
    sample.putMap("thermal", thermalStats());
    sample.putMap("battery", batteryStats());
    sample.putString("platform", "android");

    try {
      reactContext
          .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
          .emit("perf:sample", sample);
    } catch (Throwable ignore) {
      // RN bridge can be torn down during reload.
    }
  }

  private WritableMap memoryStats() {
    WritableMap map = Arguments.createMap();
    try {
      Debug.MemoryInfo info = new Debug.MemoryInfo();
      Debug.getMemoryInfo(info);
      map.putDouble("rssMb", info.getTotalPss() / 1024.0);
      map.putDouble("nativeHeapMb", Debug.getNativeHeapAllocatedSize() / 1024.0 / 1024.0);
    } catch (Throwable ignore) {
      // best-effort
    }
    return map;
  }

  private WritableMap thermalStats() {
    WritableMap map = Arguments.createMap();
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      try {
        PowerManager pm =
            (PowerManager) reactContext.getSystemService(Context.POWER_SERVICE);
        String state;
        switch (pm.getCurrentThermalStatus()) {
          case PowerManager.THERMAL_STATUS_NONE:
            state = "nominal";
            break;
          case PowerManager.THERMAL_STATUS_LIGHT:
          case PowerManager.THERMAL_STATUS_MODERATE:
            state = "fair";
            break;
          case PowerManager.THERMAL_STATUS_SEVERE:
            state = "serious";
            break;
          case PowerManager.THERMAL_STATUS_CRITICAL:
          case PowerManager.THERMAL_STATUS_EMERGENCY:
          case PowerManager.THERMAL_STATUS_SHUTDOWN:
            state = "critical";
            break;
          default:
            state = "unknown";
        }
        map.putString("state", state);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
          try {
            float headroom = pm.getThermalHeadroom(0);
            if (!Float.isNaN(headroom)) map.putDouble("headroom", headroom);
          } catch (Throwable ignore) {
            // OEM may not implement
          }
        }
      } catch (Throwable ignore) {
        map.putString("state", "unknown");
      }
    } else {
      map.putString("state", "unknown");
    }

    // Best-effort CPU/SoC zone read. Many modern Android builds restrict
    // /sys/class/thermal under SELinux but it still works on a lot of
    // dev devices.
    try {
      for (int i = 0; i < 10; i++) {
        File typeFile = new File("/sys/class/thermal/thermal_zone" + i + "/type");
        if (!typeFile.canRead()) break;
        String type = readFile(typeFile).trim().toLowerCase();
        File tempFile = new File("/sys/class/thermal/thermal_zone" + i + "/temp");
        if ((type.contains("cpu") || type.contains("soc") || type.contains("tsens"))
            && tempFile.canRead()) {
          String raw = readFile(tempFile).trim();
          try {
            long milli = Long.parseLong(raw);
            double celsius = milli / 1000.0;
            if (celsius > 5.0 && celsius < 120.0) {
              map.putDouble("cpuTempC", celsius);
              break;
            }
          } catch (NumberFormatException nfe) {
            // skip
          }
        }
      }
    } catch (Throwable ignore) {
      // ignore
    }

    return map;
  }

  private WritableMap batteryStats() {
    WritableMap map = Arguments.createMap();
    try {
      BatteryManager bm =
          (BatteryManager) reactContext.getSystemService(Context.BATTERY_SERVICE);
      int level = bm.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY);
      if (level >= 0) map.putInt("level", level);

      int currentNow = bm.getIntProperty(BatteryManager.BATTERY_PROPERTY_CURRENT_NOW);
      // µA; sign convention varies by OEM. Typically negative = drain.
      map.putInt("currentNowUa", currentNow);

      IntentFilter ifilter = new IntentFilter(Intent.ACTION_BATTERY_CHANGED);
      Intent s = reactContext.registerReceiver(null, ifilter);
      if (s != null) {
        int tempTenths = s.getIntExtra(BatteryManager.EXTRA_TEMPERATURE, -1);
        if (tempTenths > 0) map.putDouble("batteryTempC", tempTenths / 10.0);
        int voltageMv = s.getIntExtra(BatteryManager.EXTRA_VOLTAGE, -1);
        if (voltageMv > 0) map.putInt("voltageMv", voltageMv);
        int status = s.getIntExtra(BatteryManager.EXTRA_STATUS, -1);
        String state;
        if (status == BatteryManager.BATTERY_STATUS_CHARGING) state = "charging";
        else if (status == BatteryManager.BATTERY_STATUS_FULL) state = "full";
        else if (status == BatteryManager.BATTERY_STATUS_DISCHARGING
            || status == BatteryManager.BATTERY_STATUS_NOT_CHARGING) state = "unplugged";
        else state = "unknown";
        map.putString("state", state);
      }
    } catch (Throwable ignore) {
      // best-effort
    }
    return map;
  }

  private static String readFile(File f) {
    try (FileInputStream in = new FileInputStream(f)) {
      byte[] buf = new byte[64];
      int n = in.read(buf);
      return n > 0 ? new String(buf, 0, n) : "";
    } catch (Throwable t) {
      return "";
    }
  }

  @Override
  public void invalidate() {
    super.invalidate();
    stop();
  }
}
