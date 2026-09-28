/**
 * L5 bans (PLAN §3.13), run by `npm test`:
 *  - e2e/: no waitForTimeout, test.only, page.pause or toHaveScreenshot; every spec imports test and
 *    expect from ./fixtures (or ../fixtures), never from @playwright/test, and carries a tag;
 *  - src/: no console logging with .log, except under src/debug;
 *  - no `.solve(` in chapter scenes or items.tsx;
 *  - every *.test.tsx starts with the happy-dom environment line;
 *  - no 1900–1949 year in chapter scenes or items.tsx (dates live in facts.ts).
 */

import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const HERE = fileURLToPath(import.meta.url)
const WEB = resolve(dirname(HERE), '..', '..')

/** 01's spec predates the fixtures; it is exempt from the import and tag rules (approved by the coordinator). */
const LEGACY_SPECS = new Set(['e2e/engine.spec.ts'])

function walk(dir: string): string[] {
  let out: string[] = []
  for (const entry of readdirSync(join(WEB, dir), { withFileTypes: true })) {
    const path = `${dir}/${entry.name}`
    if (entry.isDirectory()) out = out.concat(walk(path))
    else out.push(path)
  }
  return out
}

const read = (file: string) => readFileSync(join(WEB, file), 'utf8')
const posix = (p: string) => p.split(sep).join('/')
const SELF = posix(relative(WEB, HERE))

const e2eFiles = walk('e2e').filter((f) => /\.(ts|tsx|js|mjs)$/.test(f))
const specs = e2eFiles.filter((f) => f.endsWith('.spec.ts'))
const srcFiles = walk('src').filter((f) => /\.(ts|tsx)$/.test(f) && f !== SELF)
const chapterUi = srcFiles.filter((f) => /^src\/chapters\/[^/]+\/(scenes\/.*|items\.tsx)$/.test(f))

/** The lines of `file` matching `re`, as "file:line: text". */
function offending(files: readonly string[], re: RegExp): string[] {
  const hits: string[] = []
  for (const f of files) {
    read(f)
      .split('\n')
      .forEach((line, i) => {
        if (re.test(line)) hits.push(`${f}:${i + 1}: ${line.trim()}`)
      })
  }
  return hits
}

const BANNED_E2E = /waitForTimeout|test\.only|describe\.only|page\.pause|toHaveScreenshot/
/** A value (not `import type`) import of @playwright/test; the clause is braces, a name or `* as x`. */
const PLAYWRIGHT_VALUE_IMPORT =
  /^\s*import\s+(?!type\b)(?:\{[^}]*\}|[\w$]+(?:\s*,\s*\{[^}]*\})?|\*\s+as\s+[\w$]+)\s+from\s+['"]@playwright\/test['"]/m
const FIXTURE_IMPORT = /import\s+\{[^}]*\btest\b[^}]*\}\s+from\s+['"](\.\/|\.\.\/)+fixtures['"]/
const TAG = /@(smoke|platform|area:[\w-]+|chapter:[\w-]+|3d|sync|walk)\b/
const CONSOLE_LOG = new RegExp(`console\\.${'log'}\\(`)
const YEAR = /\b19[0-4]\d\b/

describe('L5 bans', () => {
  it('finds the files it checks', () => {
    expect(specs.length).toBeGreaterThan(0)
    expect(srcFiles.length).toBeGreaterThan(20)
  })

  it('e2e: no waitForTimeout, .only, page.pause or toHaveScreenshot', () => {
    expect(offending(e2eFiles, BANNED_E2E)).toEqual([])
  })

  it('e2e: specs import test and expect from the fixtures, never from @playwright/test', () => {
    const bad = specs
      .filter((f) => !LEGACY_SPECS.has(f))
      .filter((f) => PLAYWRIGHT_VALUE_IMPORT.test(read(f)) || !FIXTURE_IMPORT.test(read(f)))
    expect(bad).toEqual([])
  })

  it('e2e: every spec carries a tag', () => {
    expect(specs.filter((f) => !LEGACY_SPECS.has(f) && !TAG.test(read(f)))).toEqual([])
  })

  it('src: no console .log outside src/debug', () => {
    expect(offending(srcFiles.filter((f) => !f.startsWith('src/debug/')), CONSOLE_LOG)).toEqual([])
  })

  it('chapters: no .solve( in scenes or items.tsx', () => {
    expect(offending(chapterUi, /\.solve\(/)).toEqual([])
  })

  it('chapters: no 1900–1949 years in scenes or items.tsx (dates live in facts.ts)', () => {
    expect(offending(chapterUi, YEAR)).toEqual([])
  })

  it('every *.test.tsx starts with the happy-dom environment line', () => {
    const bad = srcFiles.filter((f) => f.endsWith('.test.tsx') && !read(f).startsWith('// @vitest-environment happy-dom'))
    expect(bad).toEqual([])
  })

  it('the patterns catch what they should', () => {
    expect(BANNED_E2E.test('await page.waitForTimeout(100)')).toBe(true)
    expect(BANNED_E2E.test('test.only(')).toBe(true)
    expect(PLAYWRIGHT_VALUE_IMPORT.test("import { test, expect } from '@playwright/test'")).toBe(true)
    expect(PLAYWRIGHT_VALUE_IMPORT.test("import type { Page } from '@playwright/test'")).toBe(false)
    expect(PLAYWRIGHT_VALUE_IMPORT.test("import {\n  test,\n  expect,\n} from '@playwright/test'")).toBe(true)
    expect(PLAYWRIGHT_VALUE_IMPORT.test("import pw from '@playwright/test'")).toBe(true)
    // A value import of another module followed later by a type-only Playwright import is fine.
    const mixed = "import { dimmedParts } from '../src/contracts/stage'\nimport type { Page } from '@playwright/test'"
    expect(PLAYWRIGHT_VALUE_IMPORT.test(mixed)).toBe(false)
    expect(FIXTURE_IMPORT.test("import { expect, test } from '../fixtures'")).toBe(true)
    expect(CONSOLE_LOG.test(['console', 'log("x")'].join('.'))).toBe(true)
    expect(YEAR.test('in 1932 Rejewski')).toBe(true)
    expect(YEAR.test('1950 or 21932')).toBe(false)
    expect(TAG.test("{ tag: '@area:machine-ui' }")).toBe(true)
  })
})
