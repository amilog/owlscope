import { configure } from './index.js';

interface ProcessLike {
  env?: Record<string, string | undefined>;
  versions?: { node?: string };
}

const proc = (globalThis as { process?: ProcessLike }).process;
const isProd = proc?.env?.NODE_ENV === 'production';

if (!isProd) {
  configure({
    name:
      (typeof document !== 'undefined' && document.title) ||
      proc?.env?.npm_package_name ||
      'owlscope-app',
    autoDetect: true,
    plugins: {
      console: true,
      network: true,
      errors: true,
      performance: true,
      storage: true,
    },
  });
}

export {};
