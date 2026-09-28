#!/usr/bin/env node
/**
 * Bundle budgets (PLAN §6.0 item 5, §7.1), from dist/.vite/manifest.json. Sizes are gzip (level 9)
 * sums of JS chunks. Exit 1 when anything is over budget.
 *   entry       index.html's chunk plus its static imports                      ≤ 170 kB
 *   3D          static closure of src/machine3d/index.tsx, minus the entry      ≤ 400 kB (never in the entry)
 *   effects     static closure of src/machine3d/effects/index.tsx, minus the above ≤ 130 kB
 *   chapter     each src/chapters/<id>/index.ts chunk on its own                  ≤ 80 kB
 *   code editor static closures of src/code/CodeEditor.tsx and of the CodeMirror module it lazy-loads
 *               (src/code/codemirror.tsx), minus the entry                      ≤ 150 kB
 */

import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gzipSync } from 'node:zlib'

const KB = 1024
const BUDGETS = { entry: 170 * KB, '3d': 400 * KB, effects: 130 * KB, chapter: 80 * KB, codeEditor: 150 * KB }

const dist = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist')
const manifestPath = join(dist, '.vite', 'manifest.json')
if (!existsSync(manifestPath)) {
  console.error(`budget: ${manifestPath} is missing; run npm run build first`)
  process.exit(1)
}
/** @type {Record<string, { file: string; isEntry?: boolean; imports?: string[]; dynamicImports?: string[] }>} */
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))

const gzCache = new Map()
/** @param {string} file */
function gz(file) {
  if (!gzCache.has(file)) gzCache.set(file, gzipSync(readFileSync(join(dist, file)), { level: 9 }).length)
  return gzCache.get(file)
}

/** Manifest keys reachable from `key` through static imports (including `key`). */
function closure(key) {
  const seen = new Set()
  const stack = [key]
  while (stack.length) {
    const k = stack.pop()
    if (seen.has(k) || !manifest[k]) continue
    seen.add(k)
    for (const i of manifest[k].imports ?? []) stack.push(i)
  }
  return seen
}

const jsFiles = (keys) => new Set([...keys].map((k) => manifest[k].file).filter((f) => f.endsWith('.js')))
const size = (files) => [...files].reduce((sum, f) => sum + gz(f), 0)
const minus = (a, ...bs) => new Set([...a].filter((x) => !bs.some((b) => b.has(x))))

const rows = []
let failed = false
function row(name, files, budget, note = '') {
  const bytes = size(files)
  const ok = bytes <= budget
  if (!ok) failed = true
  rows.push({ name, kb: (bytes / KB).toFixed(1), budget: (budget / KB).toFixed(0), status: ok ? 'ok' : 'OVER', note })
}

const entryKey = Object.keys(manifest).find((k) => manifest[k].isEntry && k.endsWith('index.html'))
if (!entryKey) {
  console.error('budget: no index.html entry in the manifest')
  process.exit(1)
}
const entryKeys = closure(entryKey)
const entry = jsFiles(entryKeys)
row('entry', entry, BUDGETS.entry, `${entry.size} files`)

const THREE_D = 'src/machine3d/index.tsx'
let threeD = new Set()
if (manifest[THREE_D]) {
  if (entryKeys.has(THREE_D)) {
    failed = true
    const note = `${THREE_D} is statically imported by the entry`
    rows.push({ name: '3D in entry', kb: '-', budget: '-', status: 'OVER', note })
  }
  threeD = minus(jsFiles(closure(THREE_D)), entry)
  row('3D', threeD, BUDGETS['3d'])
} else {
  rows.push({ name: '3D', kb: '-', budget: '400', status: 'n/a', note: 'not built' })
}

const EFFECTS = 'src/machine3d/effects/index.tsx'
if (manifest[EFFECTS]) row('effects', minus(jsFiles(closure(EFFECTS)), entry, threeD), BUDGETS.effects)
else rows.push({ name: 'effects', kb: '-', budget: '130', status: 'n/a', note: 'not built' })

const EDITOR = 'src/code/CodeEditor.tsx'
const CODEMIRROR = 'src/code/codemirror.tsx'
if (manifest[EDITOR]) {
  const keys = new Set([...closure(EDITOR), ...closure(CODEMIRROR)])
  row('code editor', minus(jsFiles(keys), entry), BUDGETS.codeEditor, manifest[CODEMIRROR] ? 'with CodeMirror' : '')
}
else rows.push({ name: 'code editor', kb: '-', budget: '150', status: 'n/a', note: 'not built' })

const chapters = Object.keys(manifest)
  .filter((k) => /^src\/chapters\/[^/]+\/index\.ts$/.test(k))
  .sort()
for (const k of chapters) row(`chapter ${k.split('/')[2]}`, new Set([manifest[k].file]), BUDGETS.chapter)

const width = Math.max(...rows.map((r) => r.name.length))
console.log(`${'chunk'.padEnd(width)}  ${'gzip kB'.padStart(8)}  ${'budget'.padStart(6)}  status`)
for (const r of rows) {
  const note = r.note ? `  (${r.note})` : ''
  console.log(`${r.name.padEnd(width)}  ${r.kb.padStart(8)}  ${r.budget.padStart(6)}  ${r.status}${note}`)
}
if (failed) {
  console.error('budget: over budget')
  process.exit(1)
}
console.log('budget: ok')
