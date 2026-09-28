/**
 * Tests for generate.mjs (Node's built-in runner): `cd tools/oracles && npm test`.
 *
 * They need what generate.mjs needs (npm ci here, python3, py-enigma), except the disagreement test,
 * which swaps py-enigma for a stand-in. The committed fixture is never modified: every run that
 * changes a fixture works on a copy in a temporary directory.
 */

import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { chmodSync, copyFileSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { after, describe, test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { agree, buildCases } from './generate.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const GENERATE = path.join(HERE, 'generate.mjs')
const FIXTURE = path.resolve(HERE, '..', '..', 'web', 'src', 'engine', '__fixtures__', 'oracle-vectors.json')

const temp = mkdtempSync(path.join(tmpdir(), 'enigma-oracles-'))
after(() => rmSync(temp, { recursive: true, force: true }))

function generate(args, env = {}) {
  return spawnSync(process.execPath, [GENERATE, ...args], {
    encoding: 'utf8',
    env: { ...process.env, ...env },
    maxBuffer: 64 * 1024 * 1024,
  })
}

/** Copy the committed fixture to the temp directory, optionally changing one byte. */
function copyWithByte(name, offsetOf, replace) {
  const target = path.join(temp, name)
  copyFileSync(FIXTURE, target)
  if (offsetOf) {
    const bytes = readFileSync(target)
    const at = offsetOf(bytes.toString('latin1'))
    assert.ok(at > 0 && at < bytes.length, 'offset inside the file')
    bytes[at] = replace(bytes[at])
    writeFileSync(target, bytes)
  }
  return target
}

describe('buildCases', () => {
  test('is deterministic and follows the plan: 1,000 cases, I/M3/M4, 200 long texts, 0–13 plugs', () => {
    const a = buildCases()
    assert.deepEqual(a, buildCases())
    assert.equal(a.length, 1000)
    assert.equal(a.filter((c) => c.plaintext.length === 1000).length, 200)
    assert.ok(a.every((c) => c.plaintext.length === 1000 || (c.plaintext.length >= 20 && c.plaintext.length <= 60)))
    assert.deepEqual(new Set(a.map((c) => c.config.model)), new Set(['I', 'M3', 'M4']))
    assert.deepEqual(new Set(a.map((c) => c.config.plugboard.length)), new Set(Array.from({ length: 14 }, (_, k) => k)))
    for (const r of ['IV', 'V', 'VI', 'VII', 'VIII']) assert.ok(a.some((c) => c.config.rotors.includes(r)), r)
    assert.notDeepEqual(buildCases(1), a, 'the seed matters')
  })
})

describe('agree', () => {
  test('keeps agreeing oracles, skips unsupported ones and reports every disagreement', () => {
    const cases = [
      { id: 'x', config: {}, plaintext: 'AAA' },
      { id: 'y', config: {}, plaintext: 'BBB' },
    ]
    const ok = { ciphertext: 'QRS', finalPositions: 'ABD' }
    const results = {
      reference: new Map([['x', { id: 'x', ...ok }], ['y', { id: 'y', ...ok }]]),
      ondoher: new Map([['x', { id: 'x', ...ok }], ['y', { id: 'y', ...ok, finalPositions: 'ABC' }]]),
      pyEnigma: new Map([['x', { id: 'x', unsupported: 'reflector' }], ['y', { id: 'y', ...ok, ciphertext: 'QRT' }]]),
    }
    const { finished, disagreements } = agree(cases, results)
    assert.deepEqual(finished[0].oracles, ['reference', 'ondoher'])
    assert.deepEqual(
      disagreements.map((d) => `${d.id}:${d.oracle}`),
      ['y:ondoher', 'y:pyEnigma'],
    )
  })
})

describe('generate.mjs --check', () => {
  test('passes on an unmodified copy of the committed fixture', () => {
    const r = generate(['--check', '--fixture', copyWithByte('clean.json')])
    assert.equal(r.status, 0, r.stderr)
    assert.match(r.stdout, /OK .* is up to date \(1000 cases/)
  })

  test('exits 1 after one ciphertext byte is flipped', () => {
    const target = copyWithByte(
      'ciphertext.json',
      (text) => text.indexOf('"ciphertext":"', text.indexOf('"id":"case-0500"')) + '"ciphertext":"'.length + 7,
      (byte) => (byte === 0x41 ? 0x42 : 0x41), // still a capital letter, so the JSON stays valid
    )
    const r = generate(['--check', '--fixture', target])
    assert.equal(r.status, 1, r.stdout + r.stderr)
    assert.match(r.stderr, /STALE .*ciphertext\.json/)
  })

  test('exits 1 after one byte of the header is flipped', () => {
    const target = copyWithByte(
      'header.json',
      (text) => text.indexOf('"seed": ') + '"seed": '.length + 7,
      (byte) => (byte === 0x38 ? 0x39 : 0x38),
    )
    const r = generate(['--check', '--fixture', target])
    assert.equal(r.status, 1, r.stdout + r.stderr)
    assert.match(r.stderr, /STALE/)
  })

  test('exits 1 when the fixture is missing', () => {
    const r = generate(['--check', '--fixture', path.join(temp, 'missing.json')])
    assert.equal(r.status, 1, r.stdout + r.stderr)
  })
})

describe('generate.mjs with a disagreeing oracle', () => {
  test('exits 2, names the case and writes nothing', () => {
    // A stand-in for py-enigma: the reference's answers, with one letter of case-0007 changed.
    const script = path.join(temp, 'fake_py_batch.py')
    writeFileSync(
      script,
      [
        'import json, sys',
        `sys.path.insert(0, ${JSON.stringify(HERE)})`,
        'import ref_batch',
        'for line in sys.stdin:',
        '    if not line.strip():',
        '        continue',
        '    results = [ref_batch.run_case(c) for c in json.loads(line)]',
        '    for r in results:',
        "        r.pop('doubleSteps')",
        "        if r['id'] == 'case-0007':",
        "            c = r['ciphertext']",
        "            r['ciphertext'] = c[:3] + ('B' if c[3] == 'A' else 'A') + c[4:]",
        "    print(json.dumps({'oracle': 'pyEnigma', 'version': '1.0.2', 'results': results}))",
        '',
      ].join('\n'),
    )
    const python = path.join(temp, 'fake-python')
    writeFileSync(python, `#!/bin/sh\nexec python3 ${JSON.stringify(script)}\n`)
    chmodSync(python, 0o755)
    const out = path.join(temp, 'never-written.json')
    const r = generate(['--fixture', out], { PY_ENIGMA_PYTHON: python })
    assert.equal(r.status, 2, r.stdout + r.stderr)
    assert.match(r.stderr, /DISAGREEMENT: 1 case/)
    assert.match(r.stderr, /case-0007 pyEnigma/)
    assert.equal(existsSync(out), false)
  })
})
