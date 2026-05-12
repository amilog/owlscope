import { NativeModules, Platform } from 'react-native';
import { configure, getClient } from './index.js';
import { PerformancePlugin } from './plugins/performance.js';

export interface StartOptions {
  /** Display name for the desktop sidebar. Defaults to `'rn-app'`. */
  name?: string;
  /** OwlScope server port. Defaults to `9090`. */
  port?: number;
  /** Override the auto-detected host. Use only if `startOwlScope()`
   *  picks the wrong one (eg. you run on a real device on a different
   *  Wi-Fi to the dev Mac). */
  host?: string;
  /** Set to `false` to also start in production builds — never recommended. */
  guardProduction?: boolean;
  /** Forwards to the underlying transport — set to `false` to surface
   *  connection errors in the Metro console. */
  silent?: boolean;
}

/** Resolve the host to use for the WebSocket connection back to the dev Mac.
 *
 *  Strategy: trust Metro's `scriptURL` everywhere, because whatever host
 *  Metro is reachable on is also where the OwlScope desktop is — both
 *  run on the dev Mac. This automatically does the right thing across
 *  every target without per-platform branching:
 *
 *  - **iOS simulator** → scriptURL host is `localhost`
 *  - **iOS physical device** → scriptURL host is the Mac's LAN IP
 *  - **Android emulator** → scriptURL host is `10.0.2.2`
 *  - **Android USB device** (with `adb reverse`) → scriptURL host is `localhost`
 *  - **Android Wi-Fi device** → scriptURL host is the Mac's LAN IP
 *
 *  Falls back to `10.0.2.2` on Android / `localhost` elsewhere only when
 *  Metro hasn't published a scriptURL (eg. JSC/Hermes loaded a baked
 *  bundle). Same pattern Reactotron uses.
 */
function resolveHost(): string {
  const scriptURL = (NativeModules as { SourceCode?: { scriptURL?: string } })
    .SourceCode?.scriptURL;
  if (scriptURL) {
    const hostname = scriptURL.split('://')[1]?.split(':')[0]?.split('/')[0];
    if (hostname && hostname !== '0.0.0.0') return hostname;
  }
  return Platform.OS === 'android' ? '10.0.2.2' : 'localhost';
}

/** One-line installer for React Native apps.
 *
 *  ```ts
 *  // index.js
 *  import { startOwlScope } from 'owlscope/rn';
 *  if (__DEV__) startOwlScope({ name: 'my-app' });
 *  ```
 *
 *  Picks a sane host automatically (Metro bundler IP on a real iOS device,
 *  `10.0.2.2` on the Android emulator, `localhost` on the iOS simulator and
 *  Android USB) and installs the console + network + errors plugins.
 *
 *  Production builds are no-op — the function returns early when
 *  `process.env.NODE_ENV === 'production'`, so it is safe to leave in your
 *  shipping bundle. */
export function startOwlScope(opts: StartOptions = {}): void {
  if (opts.guardProduction !== false) {
    const proc = (globalThis as { process?: { env?: Record<string, string | undefined> } })
      .process;
    if (proc?.env?.NODE_ENV === 'production') return;
  }

  const host = opts.host ?? resolveHost();
  const port = opts.port ?? 9090;
  const silent = opts.silent ?? true;

  if (!silent) {
    // eslint-disable-next-line no-console
    console.info(`[owlscope] connecting to ws://${host}:${port}`);
  }

  configure({
    name: opts.name ?? 'rn-app',
    platform: 'react-native',
    framework: frameworkLabel(),
    host,
    port,
    silent,
    plugins: {
      console: true,
      network: true,
      errors: true,
    },
  });

  // The performance plugin is RN-specific (depends on the OwlScopePerf
  // native module), so it lives outside the cross-platform default set.
  // No-ops gracefully when the native module isn't linked yet (eg. user
  // hasn't run `pod install` after upgrading).
  const client = getClient();
  if (client) {
    client.use(new PerformancePlugin());
    const linked = !!(NativeModules as { OwlScopePerf?: unknown }).OwlScopePerf;
    // Always emit status — surfacing the diagnostic in OwlScope's own Logs
    // panel rather than the dev terminal makes it impossible to miss
    // (modern RN sends console output to React DevTools, not Metro).
    if (linked) {
      client.info('[owlscope] native perf module linked — FPS / memory / thermal / battery active');
    } else {
      const fix =
        Platform.OS === 'ios'
          ? 'cd ios && pod install && rebuild the app (Xcode or `npx react-native run-ios`)'
          : 'rebuild the app via `npx react-native run-android` — Metro reload alone is not enough';
      client.warn(
        `[owlscope] OwlScopePerf native module NOT linked on ${Platform.OS}. Performance panel will stay empty. Fix: ${fix}.`,
      );
    }
  }
}

/** Carried in the handshake so the desktop sidebar can distinguish the
 *  same app running on iOS vs Android (otherwise both rows show the
 *  same name and are indistinguishable). */
function frameworkLabel(): string {
  if (Platform.OS === 'ios') return 'iOS';
  if (Platform.OS === 'android') return 'Android';
  return Platform.OS;
}
