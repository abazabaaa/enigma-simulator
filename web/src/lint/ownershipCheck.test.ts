/** scripts/ownership-check.mjs against a synthetic git repository in a temp dir. */

import { execFileSync, spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const SCRIPT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', 'scripts', 'ownership-check.mjs')

// An isolated git: no global config (no commit signing), fixed identity.
const ENV = {
  ...process.env,
  GIT_CONFIG_GLOBAL: '/dev/null',
  GIT_CONFIG_NOSYSTEM: '1',
  GIT_AUTHOR_NAME: 'Test',
  GIT_AUTHOR_EMAIL: 'test@example.com',
  GIT_COMMITTER_NAME: 'Test',
  GIT_COMMITTER_EMAIL: 'test@example.com',
  OWNERSHIP_PR: '',
  OWNERSHIP_BASE: '',
}

const MANIFEST = {
  version: 1,
  prs: {
    '02': { owns: ['web/src/lib/**', 'web/ownership.json'], stubs: ['web/src/machine-ui/index.ts'] },
    '04': { owns: ['web/src/machine-ui/**', 'web/e2e/{sync,stage2d}.spec.ts'] },
    '06': {
      owns: ['web/src/machine3d/**', '!web/src/machine3d/signal/**'],
      stubs: ['web/src/machine3d/signal/**'],
    },
    '07': {
      owns: ['web/src/chapters/i2-stepping/**'],
      amend: { tag: '[contracts-v2]', paths: ['web/src/contracts/**'] },
    },
    '17': { owns: ['**'] },
  },
  coordinator: ['CLAUDE.md', 'web/ownership.json'],
}

let repo = ''
const git = (...args: string[]) => execFileSync('git', args, { cwd: repo, env: ENV, encoding: 'utf8', stdio: 'pipe' })

function commit(files: Record<string, string>, message: string) {
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(dirname(join(repo, path)), { recursive: true })
    writeFileSync(join(repo, path), content)
  }
  git('add', '-A')
  git('commit', '-q', '-m', message)
}

function check(o: { args?: string[]; env?: Record<string, string>; cwd?: string } = {}) {
  const r = spawnSync(process.execPath, [SCRIPT, ...(o.args ?? [])], {
    cwd: o.cwd ?? join(repo, 'web'),
    env: { ...ENV, OWNERSHIP_BASE: 'main', ...o.env },
    encoding: 'utf8',
  })
  return { code: r.status, out: `${r.stdout}${r.stderr}` }
}

beforeAll(() => {
  repo = mkdtempSync(join(tmpdir(), 'ownership-'))
  git('init', '-q', '-b', 'main')
  commit({ 'web/ownership.json': JSON.stringify(MANIFEST), 'web/src/lib/a.ts': 'a', 'README.md': 'r' }, 'base')
})

afterAll(() => {
  if (repo) rmSync(repo, { recursive: true, force: true })
})

describe('ownership-check', () => {
  it('passes owned files and fails others, naming the owner', () => {
    git('checkout', '-q', '-b', 'claude/enigma/04-machine-ui', 'main')
    commit({ 'web/src/machine-ui/Keyboard.tsx': 'k', 'web/e2e/sync.spec.ts': 's' }, 'keyboard')
    let r = check()
    expect(r.code, r.out).toBe(0)
    expect(r.out).toMatch(/ownership: ok \(PR 04, 2 files in 1 commits/)

    commit({ 'web/src/lib/a.ts': 'changed' }, 'touch lib')
    r = check()
    expect(r.code).toBe(1)
    expect(r.out).toContain('web/src/lib/a.ts')
    expect(r.out).toContain('owned by PR 02')
    expect(r.out).not.toContain('machine-ui/Keyboard.tsx')
  })

  it('ignores merge commits and commits already on the base', () => {
    git('checkout', '-q', 'main')
    commit({ 'web/src/lib/b.ts': 'b' }, 'more lib on main')
    git('checkout', '-q', '-b', 'claude/enigma/04-second', 'main~1')
    commit({ 'web/src/machine-ui/Lampboard.tsx': 'l' }, 'lampboard')
    git('merge', '-q', '--no-edit', '--no-ff', 'main')
    const r = check()
    expect(r.code, r.out).toBe(0)
    expect(r.out).toContain('1 files in 1 commits')
  })

  it('reads the rules from the base, so a PR cannot grant itself files', () => {
    git('checkout', '-q', '-b', 'claude/enigma/04-grab', 'main')
    const grabbed = { ...MANIFEST, prs: { ...MANIFEST.prs, '04': { owns: ['**'] } } }
    commit({ 'web/ownership.json': JSON.stringify(grabbed), 'web/src/lib/c.ts': 'c' }, 'grab')
    const r = check()
    expect(r.code).toBe(1)
    expect(r.out).toContain('web/ownership.json')
    expect(r.out).toContain('owned by the coordinator')
    expect(r.out).toContain('web/src/lib/c.ts')
  })

  it('allows amend paths only in commits carrying the tag', () => {
    git('checkout', '-q', '-b', 'claude/enigma/07-pilot-i2', 'main')
    commit({ 'web/src/chapters/i2-stepping/index.ts': 'i2' }, 'chapter')
    commit({ 'web/src/contracts/lesson.ts': 'v2' }, 'Add optional fields [contracts-v2]')
    expect(check().code).toBe(0)
    commit({ 'web/src/contracts/stage.ts': 'x' }, 'sneak a contract change')
    const r = check()
    expect(r.code).toBe(1)
    expect(r.out).toContain('web/src/contracts/stage.ts')
    expect(r.out).not.toContain('lesson.ts')
  })

  it('supports stubs and ! exclusions', () => {
    git('checkout', '-q', '-b', 'claude/enigma/06-machine3d-core', 'main')
    commit({ 'web/src/machine3d/Case.tsx': 'c', 'web/src/machine3d/signal/index.tsx': 'stub' }, '3d core + stub')
    expect(check().code).toBe(0)
    git('checkout', '-q', '-b', 'claude/enigma/02-platform', 'main')
    commit({ 'web/src/machine-ui/index.ts': 'stub' }, 'stub for 04')
    expect(check().code).toBe(0)
    commit({ 'web/src/machine-ui/Keyboard.tsx': 'not a stub' }, 'overreach')
    expect(check().code).toBe(1)
  })

  it('takes the PR from --pr or OWNERSHIP_PR, and skips other branches', () => {
    git('checkout', '-q', '-b', 'claude/intelligent-hamilton-r0i6wz', 'main')
    commit({ 'web/src/anything.ts': 'x' }, 'integration work')
    let r = check()
    expect(r.code).toBe(0)
    expect(r.out).toContain('ownership: skipped')

    r = check({ args: ['--pr', '17'] })
    expect(r.code, r.out).toBe(0)
    r = check({ env: { OWNERSHIP_PR: 'claude/enigma/04-machine-ui' } })
    expect(r.code).toBe(1)
    expect(r.out).toContain('PR 04')
    r = check({ args: ['--pr', '55'] })
    expect(r.code).toBe(1)
    expect(r.out).toContain('PR 55 is not listed')
  })

  it('fails loudly when the base cannot be found', () => {
    const r = check({ args: ['--pr', '04'], env: { OWNERSHIP_BASE: 'origin/no-such-branch' } })
    expect(r.code).toBe(2)
    expect(r.out).toContain('origin/no-such-branch not found')
  })
})
