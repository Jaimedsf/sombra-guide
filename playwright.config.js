import { defineConfig } from '@playwright/test';

// End-to-end tests in the Chrome already installed on the machine (and on GitHub's runners),
// so nothing else is downloaded. They run against a build made with --mode e2e, which only
// adds a handle on the map (window.__sombra), in its own folder so dist/ is never touched.
export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0, // the map tiles come from the network
  workers: 1,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: {
    baseURL: 'http://localhost:4173/',
    channel: 'chrome',
    viewport: { width: 1280, height: 800 },
    // WebGL 2 without a GPU (CI runners, headless)
    launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] },
  },
  webServer: {
    command: 'npx vite build --mode e2e --outDir dist-e2e --emptyOutDir && npx vite preview --outDir dist-e2e --port 4173 --strictPort',
    url: 'http://localhost:4173/',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
