import type { OwlScopeClientApi, OwlScopePlugin, LogLevel } from '../types.js';

export interface ConsolePluginOptions {
  levels?: LogLevel[];
  preserveOriginal?: boolean;
}

const ALL_LEVELS: LogLevel[] = ['log', 'info', 'warn', 'error', 'debug'];

export class ConsolePlugin implements OwlScopePlugin {
  name = 'console';
  private levels: LogLevel[];
  private preserveOriginal: boolean;
  private originals: Partial<Record<LogLevel, (...args: unknown[]) => void>> = {};

  constructor(opts: ConsolePluginOptions = {}) {
    this.levels = opts.levels ?? ALL_LEVELS;
    this.preserveOriginal = opts.preserveOriginal ?? true;
  }

  install(client: OwlScopeClientApi): void {
    if (typeof console === 'undefined') return;

    for (const level of this.levels) {
      const original = console[level]?.bind(console);
      if (typeof original !== 'function') continue;
      this.originals[level] = original;

      console[level] = (...args: unknown[]) => {
        try {
          client.emit({
            type: 'console',
            level,
            payload: { args },
          });
        } catch {
          /* ignore */
        }
        if (this.preserveOriginal) {
          original(...args);
        }
      };
    }
  }

  uninstall(): void {
    for (const level of this.levels) {
      const original = this.originals[level];
      if (original) {
        console[level] = original;
      }
    }
    this.originals = {};
  }
}
