import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

// KEC GIS web app. In dev the map reads /plots.geojson from public/;
// in production set VITE_TILES_URL to the Martin MVT endpoint.
export default defineConfig({
  // relative base so the build works both at root (Firebase) and under a
  // sub-path (GitHub Pages: /Interactive-Master-Plan/)
  base: './',
  plugins: [react()],
  resolve: {
    alias: {
      '@kec/types': resolve(__dirname, '../../packages/types/src/index.ts'),
      '@': resolve(__dirname, 'src'),
    },
  },
  server: { port: 5173, host: true },
});
