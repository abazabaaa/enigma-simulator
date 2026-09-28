import { defineConfig, devices } from '@playwright/test'

/**
 * End-to-end tests drive the production build (`vite build` + `vite preview`) through the
 * state API `window.__enigma` and real keyboard events. Never pixel-based.
 *
 * The site is served under the same base path as on GitHub Pages ('/enigma-simulator/');
 * set VITE_BASE to test another base (it is read by vite.config.ts too).
 *
 * @playwright/test is pinned to 1.56.0 to match the Chromium build pre-installed in the dev
 * container (/opt/pw-browsers). Do not run `playwright install` there; CI installs its own.
 */

const PORT = Number(process.env.E2E_PORT ?? 4173)
const BASE = process.env.VITE_BASE ?? '/enigma-simulator/'
const ORIGIN = `http://127.0.0.1:${PORT}`

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `${ORIGIN}${BASE}`,
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        headless: true,
        launchOptions: {
          // SwiftShader WebGL for GPU-less machines; harmless today, required by the 3D chapters.
          args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
        },
      },
    },
  ],
  webServer: {
    command: `npm run build && npm run preview -- --host 127.0.0.1 --port ${PORT} --strictPort`,
    url: `${ORIGIN}${BASE}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
