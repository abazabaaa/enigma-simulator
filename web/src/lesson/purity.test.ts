/**
 * L4 purity (PLAN §3.13): the static import closure of every chapters/<id>/gates.ts, lesson/recall/pool.ts and
 * lesson/fixture/gates.ts stays inside engine/, lib/{rng,toy,keyspace}.ts, contracts/, lesson/{rules,kinds/*}.ts,
 * crypto/ (no *.worker.ts, no *Client.ts) and the same chapter's gates|facts|data*.ts; it contains no
 * import.meta, no ?worker/?raw/?url import, no .tsx file, no react and no Math.random. Type-only imports are
 * erased at build time and are not followed.
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const rel = (f: string) => relative(SRC, f).split('\\').join('/')

/** Source with comments and string contents blanked (keeps import specifiers readable separately). */
function stripComments(code: string): string {
  return code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1')
}

/** Value imports and re-exports of a module (type-only ones are erased and skipped). */
export function valueImports(code: string): string[] {
  const clean = stripComments(code)
  const out: string[] = []
  const stmt = /(?:^|[\n;])\s*(import|export)\s+(type\s+)?([^'";]*?)\s*from\s*['"]([^'"]+)['"]/g
  for (const m of clean.matchAll(stmt)) {
    if (m[2]) continue
    out.push(m[4]!)
  }
  for (const m of clean.matchAll(/(?:^|[\n;])\s*import\s*['"]([^'"]+)['"]/g)) out.push(m[1]!)
  for (const m of clean.matchAll(/\bimport\(\s*['"]([^'"]+)['"]\s*\)/g)) out.push(m[1]!)
  return out
}

function resolveImport(from: string, spec: string): string | null {
  if (!spec.startsWith('.')) return null
  const base = resolve(dirname(from), spec.replace(/\?.*$/, ''))
  for (const c of [base, `${base}.ts`, `${base}.tsx`, join(base, 'index.ts'), join(base, 'index.tsx')]) {
    if (existsSync(c) && !c.endsWith('/') && readdirSafe(c) === null) return c
  }
  return null
}

function readdirSafe(p: string): string[] | null {
  try {
    return readdirSync(p)
  } catch {
    return null
  }
}

function allowed(root: string, file: string): boolean {
  const f = rel(file)
  const r = rel(root)
  const own = dirname(r)
  if (f.startsWith('engine/') && !f.includes('__tests__')) return true
  if (/^lib\/(rng|toy|keyspace)\.ts$/.test(f)) return true
  if (f.startsWith('contracts/') && !f.endsWith('.test.ts')) return true
  if (/^lesson\/rules\.ts$/.test(f) || /^lesson\/kinds\/[^/]+\.ts$/.test(f)) return true
  if (f.startsWith('crypto/') && !/\.worker\.ts$|Client\.ts$/.test(f)) return true
  if (dirname(f) === own && /^(gates|facts|pool|data[^/]*)\.ts$/.test(f.slice(own.length + 1))) return true
  return false
}

export function purityProblems(root: string): string[] {
  const problems: string[] = []
  const seen = new Set<string>()
  const stack = [root]
  while (stack.length) {
    const file = stack.pop()!
    if (seen.has(file)) continue
    seen.add(file)
    const where = rel(file)
    if (!allowed(root, file)) problems.push(`${where}: outside the allowed closure`)
    if (file.endsWith('.tsx')) problems.push(`${where}: .tsx in the closure`)
    const code = readFileSync(file, 'utf8')
    const clean = stripComments(code)
    if (/\bimport\.meta\b/.test(clean)) problems.push(`${where}: uses import.meta`)
    if (/\bMath\.random\b/.test(clean)) problems.push(`${where}: uses Math.random`)
    for (const spec of valueImports(code)) {
      if (/\?(worker|raw|url)\b/.test(spec)) problems.push(`${where}: imports ${spec}`)
      if (/^react(-dom)?(\/|$)/.test(spec)) problems.push(`${where}: imports ${spec}`)
      const target = resolveImport(file, spec)
      if (target) stack.push(target)
      else if (!spec.startsWith('.')) problems.push(`${where}: imports the package ${spec}`)
      else problems.push(`${where}: cannot resolve ${spec}`)
    }
  }
  return problems
}

function roots(): string[] {
  const chapters = join(SRC, 'chapters')
  const out = readdirSync(chapters)
    .map((id) => join(chapters, id, 'gates.ts'))
    .filter((f) => existsSync(f))
  return [...out, join(SRC, 'lesson/recall/pool.ts'), join(SRC, 'lesson/fixture/gates.ts')]
}

describe('L4 purity', () => {
  it.each(roots().map((f) => [rel(f), f] as const))('%s', (_name, file) => {
    expect(purityProblems(file)).toEqual([])
  })

  it('catches violations (self-test)', () => {
    expect(valueImports("import type { A } from 'react'\nimport { b } from './b'\nexport * from './c'")).toEqual([
      './b',
      './c',
    ])
    expect(valueImports("import x from 'react'")).toEqual(['react'])
    expect(purityProblems(join(SRC, 'lesson/bind.ts'))).toEqual(['lesson/bind.ts: outside the allowed closure'])
    const widget = join(SRC, 'lesson/kinds/widgets/LetterAnswer.tsx')
    if (existsSync(widget)) expect(purityProblems(widget).some((p) => p.includes('.tsx'))).toBe(true)
  })
})
