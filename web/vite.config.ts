import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vitest/config'

// GitHub Pages serves the site from https://<owner>.github.io/enigma-simulator/.
// Override with VITE_BASE=/ (e.g. for a root-hosted preview); Playwright reads the same variable.
const base = process.env.VITE_BASE ?? '/enigma-simulator/'

// https://vite.dev/config/
export default defineConfig({
  base,
  plugins: [react(), tailwindcss()],
  test: {
    // Only unit tests under src/; Playwright specs in e2e/ are run by `npm run e2e`.
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
})
