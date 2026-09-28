#!/usr/bin/env node
/**
 * Ownership check (PLAN §5.1, §6.0 item 3): every file a PR branch changes must belong to that PR.
 *
 *   node scripts/ownership-check.mjs [--pr NN] [--base <ref>]
 *
 * PR number: --pr, else OWNERSHIP_PR (a number or a branch name; CI passes github.head_ref), else the
 * current branch claude/enigma/NN-*. Any other branch (integration, master) prints
 * "ownership: skipped" and exits 0.
 * Base: --base, else OWNERSHIP_BASE, else origin/claude/intelligent-hamilton-r0i6wz.
 * Changed files: every file touched by a non-merge commit in <base>..HEAD (renames count as a
 * delete plus an add). A file passes when it matches the PR's `owns` (or `stubs`) globs, or its
 * `amend.paths` when that commit's message contains `amend.tag`.
 * The rules come from web/ownership.json AT THE BASE when the base has one (a PR cannot grant itself
 * files), else from the working tree. Globs are repository-root relative: `**`, `*`, `?`, `{a,b}`,
 * and a leading `!` excludes.
 */

import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const DEFAULT_BASE = 'origin/claude/intelligent-hamilton-r0i6wz'
const MANIFEST = 'web/ownership.json'

function git(args, cwd) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] })
}

function tryGit(args, cwd) {
  try {
    return git(args, cwd)
  } catch {
    return null
  }
}

/** '**' any path, '*' within a segment, '?' one character, '{a,b}' alternatives. */
export function globToRegExp(glob) {
  let re = ''
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i]
    if (c === '*' && glob[i + 1] === '*') {
      if (glob[i + 2] === '/') {
        re += '(?:.*/)?'
        i += 2
      } else {
        re += '.*'
        i += 1
      }
    } else if (c === '*') re += '[^/]*'
    else if (c === '?') re += '[^/]'
    else if (c === '{') re += '(?:'
    else if (c === '}') re += ')'
    else if (c === ',') re += '|'
    else re += c.replace(/[.+^$()|[\]\\]/g, '\\$&')
  }
  return new RegExp(`^${re}$`)
}

/** A file matches a list when it matches a positive glob and no `!` glob. */
export function matchesAny(file, globs = []) {
  let hit = false
  for (const g of globs) {
    if (g.startsWith('!')) {
      if (globToRegExp(g.slice(1)).test(file)) return false
    } else if (!hit && globToRegExp(g).test(file)) hit = true
  }
  return hit
}

function parseArgs(argv) {
  const out = {}
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--pr') out.pr = argv[++i]
    else if (argv[i] === '--base') out.base = argv[++i]
  }
  return out
}

/** 'NN' from '2', '02', or a branch name claude/enigma/NN-name; null otherwise. */
export function prFrom(value) {
  if (!value) return null
  const v = String(value).trim()
  if (/^\d{1,2}$/.test(v)) return v.padStart(2, '0')
  const m = /^(?:refs\/heads\/)?claude\/enigma\/(\d{2})-/.exec(v)
  return m ? m[1] : null
}

function main() {
  const args = parseArgs(process.argv.slice(2))
  const cwd = process.cwd()
  const root = tryGit(['rev-parse', '--show-toplevel'], cwd)?.trim()
  if (!root) {
    console.error('ownership: not inside a git repository')
    process.exit(2)
  }
  const branch = tryGit(['branch', '--show-current'], root)?.trim() ?? ''
  const pr = prFrom(args.pr) ?? prFrom(process.env.OWNERSHIP_PR) ?? prFrom(branch)
  if (!pr) {
    console.log(`ownership: skipped (branch ${branch || '(detached)'} is not a PR branch)`)
    return
  }

  const base = args.base ?? process.env.OWNERSHIP_BASE ?? DEFAULT_BASE
  if (tryGit(['rev-parse', '--verify', '--quiet', `${base}^{commit}`], root) === null) {
    console.error(`ownership: base ${base} not found. Fetch it, or set OWNERSHIP_BASE=origin/<base branch>.`)
    process.exit(2)
  }

  const fromBase = tryGit(['show', `${base}:${MANIFEST}`], root)
  const manifestText = fromBase ?? readFileSync(join(root, MANIFEST), 'utf8')
  const manifest = JSON.parse(manifestText)
  const rules = manifest.prs?.[pr]
  if (!rules) {
    console.error(`ownership: PR ${pr} is not listed in ${MANIFEST}${fromBase ? ` at ${base}` : ''}`)
    process.exit(1)
  }

  const commits = git(['rev-list', '--no-merges', `${base}..HEAD`], root).split('\n').filter(Boolean)
  const violations = []
  const files = new Set()
  for (const sha of commits) {
    const message = git(['log', '-1', '--format=%B', sha], root)
    const changed = git(['diff-tree', '--no-commit-id', '--name-only', '-r', '--no-renames', sha], root)
      .split('\n')
      .filter(Boolean)
    const amend = rules.amend && message.includes(rules.amend.tag) ? rules.amend.paths : []
    for (const file of changed) {
      files.add(file)
      if (matchesAny(file, rules.owns) || matchesAny(file, rules.stubs) || matchesAny(file, amend)) continue
      violations.push({ file, sha: sha.slice(0, 7) })
    }
  }

  if (violations.length) {
    const ownerOf = (file) => {
      if (matchesAny(file, manifest.coordinator)) return 'the coordinator'
      const owners = Object.entries(manifest.prs)
        .filter(([n, r]) => n !== pr && n !== '17' && (matchesAny(file, r.owns) || matchesAny(file, r.stubs)))
        .map(([n]) => `PR ${n}`)
      return owners.length ? owners.join(', ') : 'nobody'
    }
    console.error(`ownership: FAIL (PR ${pr}, base ${base}): files outside this PR's ownership:`)
    for (const v of violations) console.error(`  ${v.file}  (commit ${v.sha}; owned by ${ownerOf(v.file)})`)
    console.error('Report BLOCKED with the exact diff instead of editing files you do not own (PLAN §6.0 item 3).')
    process.exit(1)
  }
  console.log(`ownership: ok (PR ${pr}, ${files.size} files in ${commits.length} commits since ${base})`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main()
