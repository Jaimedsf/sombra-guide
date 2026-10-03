import { defineConfig } from 'vite';

export default defineConfig({
  // relative asset paths, so the build works under any sub-path (e.g. GitHub Pages /sombra-guide/)
  base: './',
  worker: { format: 'es' },
  build: {
    chunkSizeWarningLimit: 1200,
    rolldownOptions: {
      output: {
        // the libraries change far less often than the app: in chunks of their own, a release
        // only makes browsers download the small app chunk again
        codeSplitting: {
          groups: [
            { name: 'maplibre', test: /node_modules[\\/]maplibre-gl/ },
            { name: 'three', test: /node_modules[\\/]three/ },
          ],
        },
      },
    },
  },
});
