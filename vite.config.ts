/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// `base: './'` keeps all asset paths relative, so the build works on
// GitHub Pages (served from /<repo>/) as well as locally.
export default defineConfig({
  base: './',
  plugins: [react()],
  worker: { format: 'es' },
  build: { chunkSizeWarningLimit: 1600 },
  optimizeDeps: { exclude: ['manifold-3d'] },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    testTimeout: 30000,
  },
});
