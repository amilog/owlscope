import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

const externalOpts = { exclude: ['@owlscope/protocol'] };

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin(externalOpts)],
    build: {
      rollupOptions: {
        input: { index: resolve(__dirname, 'src/main/index.ts') },
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin(externalOpts)],
    build: {
      rollupOptions: {
        input: { index: resolve(__dirname, 'src/preload/index.ts') },
      },
    },
  },
  renderer: {
    root: resolve(__dirname, 'src/renderer'),
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src/renderer/src'),
      },
    },
    plugins: [react()],
    build: {
      rollupOptions: {
        input: resolve(__dirname, 'src/renderer/index.html'),
      },
    },
    server: {
      port: 5180,
      strictPort: true,
      fs: {
        allow: [resolve(__dirname, '../..')],
      },
    },
    optimizeDeps: {
      exclude: ['@owlscope/protocol'],
    },
  },
});
