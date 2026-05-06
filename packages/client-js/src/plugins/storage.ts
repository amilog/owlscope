import type { OwlScopeClientApi, OwlScopePlugin } from '../types.js';

type Op = 'set' | 'remove' | 'clear';

interface Originals {
  setItem: typeof Storage.prototype.setItem;
  removeItem: typeof Storage.prototype.removeItem;
  clear: typeof Storage.prototype.clear;
}

function wrap(
  storage: Storage,
  area: 'localStorage' | 'sessionStorage',
  client: OwlScopeClientApi,
): Originals {
  const originals: Originals = {
    setItem: storage.setItem.bind(storage),
    removeItem: storage.removeItem.bind(storage),
    clear: storage.clear.bind(storage),
  };

  const emit = (op: Op, key?: string, value?: string) => {
    try {
      client.emit({
        type: 'storage',
        payload: { area, op, key, value },
      });
    } catch {
      /* ignore */
    }
  };

  storage.setItem = function (key: string, value: string) {
    emit('set', key, value);
    return originals.setItem(key, value);
  };
  storage.removeItem = function (key: string) {
    emit('remove', key);
    return originals.removeItem(key);
  };
  storage.clear = function () {
    emit('clear');
    return originals.clear();
  };

  return originals;
}

function restore(storage: Storage, originals: Originals) {
  storage.setItem = originals.setItem;
  storage.removeItem = originals.removeItem;
  storage.clear = originals.clear;
}

export class StoragePlugin implements OwlScopePlugin {
  name = 'storage';
  private localOriginals: Originals | null = null;
  private sessionOriginals: Originals | null = null;

  install(client: OwlScopeClientApi): void {
    if (typeof window === 'undefined') return;
    try {
      this.localOriginals = wrap(window.localStorage, 'localStorage', client);
    } catch {
      /* sandboxed */
    }
    try {
      this.sessionOriginals = wrap(window.sessionStorage, 'sessionStorage', client);
    } catch {
      /* sandboxed */
    }
  }

  uninstall(): void {
    if (typeof window === 'undefined') return;
    if (this.localOriginals) restore(window.localStorage, this.localOriginals);
    if (this.sessionOriginals) restore(window.sessionStorage, this.sessionOriginals);
    this.localOriginals = null;
    this.sessionOriginals = null;
  }
}
