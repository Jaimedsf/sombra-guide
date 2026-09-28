import { defineConfig } from 'vite';

export default defineConfig({
  // relative asset paths, so the build works under any sub-path (e.g. GitHub Pages /sombra-guide/)
  base: './',
  worker: { format: 'es' },
  build: { chunkSizeWarningLimit: 2500 },
});
