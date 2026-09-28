import { defineConfig, devices } from '@playwright/test'

/**
 * End-to-end tests drive the production build (`vite build` + `vite preview`) through the
 * state APIs `window.__enigma`, `window.__stage` and `window.__course` and real input events.
 * Never pixel-based.
 *
 * Projects (tags live in test titles):
 *   2d    every spec except @3d and @walk, forced 2D stage, reduced motion
 *   3d    @3d and @sync specs, forced 3D stage (falls back to 2D until the 3D view exists)
 *   walk     the full course walk (@walk), 2D stage
 *   walk-3d  the same walk on the 3D stage (SwiftShader here and in CI)
 *
 * The site is served under the same base path as on GitHub Pages ('/enigma-simulator/');
 * set VITE_BASE to test another base (it is read by vite.config.ts too).
 *
 * @playwright/test is pinned to 1.56.0 to match the Chromium build pre-installed in the dev
 * container (/opt/pw-browsers). Do not run `playwright install` there; CI installs its own.
 */

const CI = !!process.env.CI
if (!process.env.E2E_PORT && !CI) throw new Error('Set E2E_PORT: builders 41NN, reviewers 51NN')

const PORT = Number(process.env.E2E_PORT ?? 4173)
const BASE = process.env.VITE_BASE ?? '/enigma-simulator/'
export const ORIGIN = `http://127.0.0.1:${PORT}`

/** Worker option read by e2e/fixtures.ts. */
interface StageOption {
  stage: '2d' | '3d'
}

// SwiftShader WebGL for GPU-less machines (the dev box and CI runners).
const CHROMIUM_ARGS = [
  '--use-gl=angle',
  '--use-angle=swiftshader',
  '--enable-unsafe-swiftshader',
  '--ignore-gpu-blocklist',
]

export const WEB_SERVER = {
  command: `npm run build && npm run preview -- --host 127.0.0.1 --port ${PORT} --strictPort`,
  url: `${ORIGIN}${BASE}`,
  reuseExistingServer: false,
  timeout: 180_000,
}

export default defineConfig<object, StageOption>({
  testDir: './e2e',
  testIgnore: ['review/**'],
  fullyParallel: true,
  forbidOnly: true,
  retries: CI ? 1 : 0,
  workers: CI ? 2 : 1,
  failOnFlakyTests: CI,
  reporter: CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    ...devices['Desktop Chrome'],
    baseURL: `${ORIGIN}${BASE}`,
    headless: true,
    trace: 'retain-on-failure',
    launchOptions: { args: CHROMIUM_ARGS },
  },
  projects: [
    { name: '2d', grepInvert: /@3d|@walk/, use: { stage: '2d', contextOptions: { reducedMotion: 'reduce' } } },
    { name: '3d', grep: /@3d|@sync/, use: { stage: '3d', contextOptions: { reducedMotion: 'no-preference' } } },
    { name: 'walk', grep: /@walk/, use: { stage: '2d' }, timeout: 300_000 },
    { name: 'walk-3d', grep: /@walk/, use: { stage: '3d' }, timeout: 600_000 },
  ],
  webServer: WEB_SERVER,
})
