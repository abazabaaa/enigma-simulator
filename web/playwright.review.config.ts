import { defineConfig, devices } from '@playwright/test'
import { ORIGIN, WEB_SERVER } from './playwright.config'

/**
 * The headless review walk (`npm run review -- --grep "<tags>"`): scripts under e2e/review write
 * screenshots, console logs, stage reports and axe results to review-artifacts/ for the reviewer
 * to read. Same build and server as playwright.config.ts; E2E_PORT is required locally.
 */

const BASE = process.env.VITE_BASE ?? '/enigma-simulator/'

export default defineConfig({
  testDir: './e2e/review',
  outputDir: 'review-artifacts/',
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  workers: 1,
  reporter: 'list',
  use: {
    ...devices['Desktop Chrome'],
    baseURL: `${ORIGIN}${BASE}`,
    headless: true,
    trace: 'off',
    launchOptions: {
      args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
    },
  },
  webServer: WEB_SERVER,
})
