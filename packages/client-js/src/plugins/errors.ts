import type { OwlScopeClientApi, OwlScopePlugin } from '../types.js';

export class ErrorsPlugin implements OwlScopePlugin {
  name = 'errors';

  private onError: ((e: ErrorEvent) => void) | null = null;
  private onRejection: ((e: PromiseRejectionEvent) => void) | null = null;

  install(client: OwlScopeClientApi): void {
    if (typeof window === 'undefined') return;

    this.onError = (e: ErrorEvent) => {
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

    this.onRejection = (e: PromiseRejectionEvent) => {
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

    window.addEventListener('error', this.onError);
    window.addEventListener('unhandledrejection', this.onRejection);
  }

  uninstall(): void {
    if (typeof window === 'undefined') return;
    if (this.onError) window.removeEventListener('error', this.onError);
    if (this.onRejection) window.removeEventListener('unhandledrejection', this.onRejection);
    this.onError = null;
    this.onRejection = null;
  }
}
