import { configure } from './index.js';

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

interface RnPlatform {
  OS: 'ios' | 'android' | string;
}
interface RnSourceCode {
  scriptURL?: string;
}
interface RnNativeModules {
  SourceCode?: RnSourceCode;
}

/** Resolve the host to use for the WebSocket connection back to the dev Mac.
 *
 *  - **Android emulator**: `10.0.2.2` (the emulator's NAT alias for the host)
 *  - **iOS simulator**: `localhost`
 *  - **Physical device** (USB / LAN): the IP of the Metro bundler — read off
 *    `NativeModules.SourceCode.scriptURL`, which always points at the dev
 *    machine when running through Metro.
 *
 *  Falls back to `localhost` if React Native can't be required (for example
 *  when this entry is imported from a Jest test). */
function resolveHost(): string {
  let Platform: RnPlatform | undefined;
  let NativeModules: RnNativeModules | undefined;
  try {
    const req = (globalThis as unknown as { require?: (m: string) => unknown }).require;
    if (typeof req !== 'function') return 'localhost';
    const rn = req('react-native') as {
      Platform: RnPlatform;
      NativeModules: RnNativeModules;
    };
    Platform = rn.Platform;
    NativeModules = rn.NativeModules;
  } catch {
    return 'localhost';
  }

  if (Platform?.OS === 'android') return '10.0.2.2';

  const scriptURL = NativeModules?.SourceCode?.scriptURL;
  if (scriptURL) {
    try {
      return new URL(scriptURL).hostname;
    } catch {
      /* fall through */
    }
  }
  return 'localhost';
}

/** One-line installer for React Native apps.
 *
 *  ```ts
 *  // index.js
 *  import { startOwlScope } from 'owlscope/rn';
 *  if (__DEV__) startOwlScope({ name: 'my-app' });
 *  ```
 *
 *  Picks a sane host automatically (Metro bundler IP on a real device,
 *  `10.0.2.2` on the Android emulator, `localhost` on the iOS simulator)
 *  and installs the console + network + errors plugins.
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

  configure({
    name: opts.name ?? detectAppName() ?? 'rn-app',
    host,
    port: opts.port ?? 9090,
    silent: opts.silent ?? true,
    plugins: {
      console: true,
      network: true,
      errors: true,
    },
  });
}

/** Best-effort: read the consumer's app.json so we can default the
 *  client name to "<their-app>" rather than the generic "rn-app". Falls
 *  back to undefined if Metro doesn't make app.json reachable from this
 *  package's directory (which it usually does — it lives at the project
 *  root of every RN app). */
function detectAppName(): string | undefined {
  try {
    const req = (globalThis as unknown as { require?: (m: string) => unknown }).require;
    if (typeof req !== 'function') return undefined;
    const appJson = req('../../../app.json') as { name?: string; displayName?: string };
    return appJson.name ?? appJson.displayName;
  } catch {
    return undefined;
  }
}
