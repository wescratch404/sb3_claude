/**
 * Vite configuration.
 *
 *  - `npm run build`         → normal multi-file production build in /dist
 *                              (served by the Node/Express server in /server).
 *  - `npm run build:single`  → everything inlined into one self-contained
 *                              index.html (handy for offline use or hosting
 *                              as a single static file).
 */
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

export default defineConfig(({ mode }) => ({
  plugins: [react(), ...(mode === 'single' ? [viteSingleFile()] : [])],
  build: {
    outDir: mode === 'single' ? 'dist-single' : 'dist',
    chunkSizeWarningLimit: 2000,
  },
  server: {
    // During development, forward API calls to the Node server (npm start).
    proxy: { '/api': 'http://localhost:5174' },
  },
}));
