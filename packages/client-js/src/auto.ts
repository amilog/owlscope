import { configure } from './index.js';

interface ProcessLike {
  env?: Record<string, string | undefined>;
}

const proc = (globalThis as { process?: ProcessLike }).process;
const isProd = proc?.env?.NODE_ENV === 'production';

if (!isProd) {
  // The auto entry assumes localhost — fine for browser/Node experiments
  // and React Native running on iOS simulator. For physical iOS / Android
  // emulator / Android device use `import { startOwlScope } from
  // 'owlscope/rn'` which auto-detects the host from the Metro bundler URL.
  configure({
    name: proc?.env?.npm_package_name ?? 'owlscope-app',
    autoDetect: true,
    plugins: {
      console: true,
      network: true,
      errors: true,
    },
  });
}

export {};
