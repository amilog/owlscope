import type { OwlScopeClientApi, OwlScopePlugin } from '../types.js';

interface RnErrorUtils {
  getGlobalHandler?: () => ((err: Error, isFatal?: boolean) => void) | undefined;
  setGlobalHandler: (handler: (err: Error, isFatal?: boolean) => void) => void;
}

interface GlobalShape {
  ErrorUtils?: RnErrorUtils;
  HermesInternal?: unknown;
  process?: { on?: (event: string, handler: (...a: unknown[]) => void) => void };
}

/** Captures uncaught errors and unhandled promise rejections across browser,
 *  React Native (Hermes/JSC), and Node. Each environment exposes a different
 *  global, so we feature-detect rather than hard-coding `window`. */
export class ErrorsPlugin implements OwlScopePlugin {
  name = 'errors';

  private onErrorListener: ((e: ErrorEvent) => void) | null = null;
  private onRejectionListener: ((e: PromiseRejectionEvent) => void) | null = null;
  private rnPreviousHandler: ((err: Error, isFatal?: boolean) => void) | null = null;
  private rnRestored = false;

  install(client: OwlScopeClientApi): void {
    const g = globalThis as unknown as GlobalShape;

    // ── Browser & Electron renderer ────────────────────────────────────
    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      this.onErrorListener = (e: ErrorEvent) => {
        try {
          client.emit({
            type: 'error',
            level: 'error',
            payload: {
              message: e.message,
              filename: e.filename,
              line: e.lineno,
              column: e.colno,
              error: e.error?.toString?.(),
            },
            meta: {
              stackTrace: e.error?.stack,
              source: 'window.onerror',
            },
          });
        } catch {
          /* ignore */
        }
      };

      this.onRejectionListener = (e: PromiseRejectionEvent) => {
        const reason = e.reason as unknown;
        let message = 'unhandled rejection';
        let stack: string | undefined;
        if (reason instanceof Error) {
          message = reason.message;
          stack = reason.stack;
        } else if (typeof reason === 'string') {
          message = reason;
        } else {
          try {
            message = JSON.stringify(reason);
          } catch {
            /* ignore */
          }
        }
        try {
          client.emit({
            type: 'error',
            level: 'error',
            payload: { message, reason },
            meta: { stackTrace: stack, source: 'unhandledrejection' },
          });
        } catch {
          /* ignore */
        }
      };

      window.addEventListener('error', this.onErrorListener);
      window.addEventListener('unhandledrejection', this.onRejectionListener);
      return;
    }

    // ── React Native (Hermes / JSC) ────────────────────────────────────
    if (g.ErrorUtils && typeof g.ErrorUtils.setGlobalHandler === 'function') {
      this.rnPreviousHandler = g.ErrorUtils.getGlobalHandler?.() ?? null;
      g.ErrorUtils.setGlobalHandler((err, isFatal) => {
        try {
          client.emit({
            type: 'error',
            level: 'error',
            payload: {
              message: err?.message ?? String(err),
              fatal: Boolean(isFatal),
            },
            meta: {
              stackTrace: err?.stack,
              source: isFatal ? 'rn-fatal' : 'rn-handler',
            },
          });
        } catch {
          /* ignore */
        }
        // Always defer to the previous handler so RedBox / Hermes still fires.
        this.rnPreviousHandler?.(err, isFatal);
      });
      this.rnRestored = false;
      return;
    }

    // ── Node.js ────────────────────────────────────────────────────────
    if (g.process && typeof g.process.on === 'function') {
      g.process.on('uncaughtException', (err: unknown) => {
        const e = err as { message?: string; stack?: string };
        try {
          client.emit({
            type: 'error',
            level: 'error',
            payload: { message: e?.message ?? String(err) },
            meta: { stackTrace: e?.stack, source: 'uncaughtException' },
          });
        } catch {
          /* ignore */
        }
      });
      g.process.on('unhandledRejection', (reason: unknown) => {
        const e = reason as { message?: string; stack?: string };
        try {
          client.emit({
            type: 'error',
            level: 'error',
            payload: { message: e?.message ?? String(reason) },
            meta: { stackTrace: e?.stack, source: 'unhandledRejection' },
          });
        } catch {
          /* ignore */
        }
      });
      return;
    }
  }

  uninstall(): void {
    if (typeof window !== 'undefined' && typeof window.removeEventListener === 'function') {
      if (this.onErrorListener) window.removeEventListener('error', this.onErrorListener);
      if (this.onRejectionListener)
        window.removeEventListener('unhandledrejection', this.onRejectionListener);
      this.onErrorListener = null;
      this.onRejectionListener = null;
      return;
    }

    const g = globalThis as unknown as GlobalShape;
    if (
      g.ErrorUtils &&
      typeof g.ErrorUtils.setGlobalHandler === 'function' &&
      !this.rnRestored
    ) {
      g.ErrorUtils.setGlobalHandler(this.rnPreviousHandler ?? (() => {}));
      this.rnPreviousHandler = null;
      this.rnRestored = true;
    }
  }
}
