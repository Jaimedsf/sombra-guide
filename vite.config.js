import { defineConfig } from 'vite';

// Content Security Policy of the built site. GitHub Pages can't send headers, so it goes in a
// meta tag. Only the map tiles and the two geocoders are reached outside the site itself.
// Not applied to the dev server, whose live-reload client needs inline code and a websocket.
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self' https://tiles.openfreemap.org https://geocode.arcgis.com https://nominatim.openstreetmap.org",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

// right after <meta charset>, ahead of every tag that loads something
const csp = () => ({
  name: 'csp-meta',
  apply: 'build',
  transformIndexHtml(html) {
    const charset = '<meta charset="utf-8">';
    if (!html.includes(charset)) throw new Error(`index.html needs ${charset} for the CSP to follow it`);
    return html.replace(charset, `${charset}\n  <meta http-equiv="Content-Security-Policy" content="${CSP}">`);
  },
});

export default defineConfig({
  // relative asset paths, so the build works under any sub-path (e.g. GitHub Pages /sombra-guide/)
  base: './',
  plugins: [csp()],
  worker: { format: 'es' },
  build: {
    chunkSizeWarningLimit: 1200,
    // fonts stay files: inlined as data: URLs, the CSP's font-src 'self' would block them
    assetsInlineLimit: (file) => (/\.(woff2?|ttf|otf)$/.test(file) ? false : undefined),
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
