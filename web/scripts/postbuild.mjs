#!/usr/bin/env node
/**
 * After `vite build`: copy dist/index.html to dist/404.html. GitHub Pages serves 404.html for any
 * unknown path under the site, so a path-style deep link still boots the app (main.tsx turns the
 * path into the equivalent hash route).
 */

import { copyFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const dist = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist')
const index = join(dist, 'index.html')
if (!existsSync(index)) {
  console.error(`postbuild: ${index} is missing; run vite build first`)
  process.exit(1)
}
copyFileSync(index, join(dist, '404.html'))
console.log('postbuild: dist/404.html written')
