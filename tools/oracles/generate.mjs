#!/usr/bin/env node
/**
 * Three-oracle agreement vectors for the TypeScript Enigma engine (web/src/engine).
 *
 *   cd tools/oracles
 *   npm ci                                      # @ondoher/enigma 1.0.14 (exact, pinned by this directory's lockfile)
 *   npm run setup:py                            # once: git-ignored venv .venv with py-enigma 1.0.2
 *   node generate.mjs                           # (re)write web/src/engine/__fixtures__/oracle-vectors.json
 *   node generate.mjs --check                   # regenerate in memory and diff; exit 1 when the file is stale
 *   node generate.mjs --check --fixture <path>  # the same against another copy (generate.test.mjs uses it)
 *
 * 1,000 configurations come from mulberry32(20260928): Enigma I, M3 and M4 in turn; every rotor
 * including IV–VIII and the Greek rotors; rings drawn uniformly or pinned to the A and Z extremes;
 * 0–13 plugboard pairs; 200 texts of 1,000 letters and 800 texts of 20–60 letters. Start positions
 * are sometimes placed on or just before a notch, so short texts also reach the double step.
 *
 * Every case is computed by every oracle that supports it:
 *   reference  tools/reference_enigma.py via ref_batch.py (in the repo; supports everything)
 *   ondoher    @ondoher/enigma 1.0.14 (npm, MIT), in process (supports everything)
 *   pyEnigma   py-enigma 1.0.2 (PyPI, MIT) via py_batch.py (no UKW-A; at most 10 plugboard pairs)
 * An oracle agrees when its ciphertext AND its final window letters equal the reference's. Any
 * disagreement fails the run and nothing is written. Each case records the oracles that computed it
 * (`oracles`), which always includes the reference and at least one other.
 *
 * The engine is not an oracle here: web/src/engine/__tests__/oracles.test.ts checks that the engine
 * reproduces every case, so `npm test` in web/ never needs these oracles installed.
 *
 * Environment: PYTHON (the interpreter for ref_batch.py, default python3) and PY_ENIGMA_PYTHON (the
 * interpreter with py-enigma, default .venv/bin/python if present, else python3).
 *
 * Exit codes: 0 ok · 1 stale fixture (--check) · 2 disagreement, coverage or size failure · 3 oracle missing.
 */

import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Enigma, inventory } from '@ondoher/enigma'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '..', '..')
const DEFAULT_FIXTURE = path.join(ROOT, 'web', 'src', 'engine', '__fixtures__', 'oracle-vectors.json')

export const SEED = 20260928
const CASE_COUNT = 1000
const LONG_EVERY = 5 // every 5th case is a long text: 200 of 1,000
const LONG_LENGTH = 1000
const SHORT_MIN = 20
const SHORT_MAX = 60
const MAX_BYTES = 1_500_000
const BATCH_SIZE = 100

const ONDOHER_VERSION = '1.0.14'
const PY_ENIGMA_VERSION = '1.0.2'
const ORACLES = ['reference', 'ondoher', 'pyEnigma']

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
const STEPPING = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII']

// Historical model rules (the same as the engine's validateConfig). They only choose configurations;
// every output below comes from an oracle.
const MODELS = {
  I: { rotors: STEPPING.slice(0, 5), greek: [], reflectors: ['A', 'B', 'C'] },
  M3: { rotors: STEPPING, greek: [], reflectors: ['B', 'C'] },
  M4: { rotors: STEPPING, greek: ['Beta', 'Gamma'], reflectors: ['B-thin', 'C-thin'] },
}
const MODEL_NAMES = Object.keys(MODELS)

// Window letters at which each rotor carries its left neighbour. Used only to bias start positions.
const NOTCHES = { I: 'Q', II: 'E', III: 'V', IV: 'J', V: 'Z', VI: 'ZM', VII: 'ZM', VIII: 'ZM' }

// The engine's reflector names -> @ondoher/enigma's inventory names.
const ONDOHER_REFLECTORS = { A: 'A', B: 'B', C: 'C', 'B-thin': 'Thin-B', 'C-thin': 'Thin-C' }

// ---------------------------------------------------------------------------------------------------
// Seeded randomness (mulberry32, as in web/src/engine/__tests__/helpers.ts)
// ---------------------------------------------------------------------------------------------------

export function mulberry32(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const randInt = (rng, n) => Math.floor(rng() * n)
const pick = (rng, items) => items[randInt(rng, items.length)]
const randLetter = (rng) => pick(rng, LETTERS)
const shift = (letter, by) => LETTERS[(LETTERS.indexOf(letter) + by + 26) % 26]

function shuffle(rng, items) {
  const a = [...items]
  for (let i = a.length - 1; i > 0; i--) {
    const j = randInt(rng, i + 1)
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function randomRings(rng, count) {
  const u = rng()
  if (u < 0.1) return Array(count).fill('A')
  if (u < 0.2) return Array(count).fill('Z')
  if (u < 0.35) return Array.from({ length: count }, () => (rng() < 0.5 ? 'A' : 'Z'))
  return Array.from({ length: count }, () => randLetter(rng))
}

function randomPositions(rng, rotors) {
  const positions = rotors.map(() => randLetter(rng))
  const n = rotors.length
  const [middle, right] = [rotors[n - 2], rotors[n - 1]]
  const u = rng()
  if (u < 0.15) {
    // The middle rotor starts on its notch: the very first key press double-steps it.
    positions[n - 2] = pick(rng, NOTCHES[middle])
  } else if (u < 0.3) {
    // The middle rotor starts one before its notch and the right rotor 0–2 presses before a carry,
    // so the carry and then the double step both happen within the first few letters.
    positions[n - 2] = shift(pick(rng, NOTCHES[middle]), -1)
    positions[n - 1] = shift(pick(rng, NOTCHES[right]), -randInt(rng, 3))
  }
  return positions
}

/** The deterministic list of 1,000 cases (configuration + plaintext; no outputs yet). */
export function buildCases(seed = SEED) {
  const rng = mulberry32(seed)
  const cases = []
  for (let i = 0; i < CASE_COUNT; i++) {
    const model = MODEL_NAMES[i % MODEL_NAMES.length]
    const spec = MODELS[model]
    const stepping = shuffle(rng, spec.rotors).slice(0, 3)
    const rotors = spec.greek.length ? [pick(rng, spec.greek), ...stepping] : stepping
    const reflector = pick(rng, spec.reflectors)
    const rings = randomRings(rng, rotors.length)
    const positions = randomPositions(rng, rotors)
    const letters = shuffle(rng, LETTERS)
    const plugboard = Array.from({ length: randInt(rng, 14) }, (_, k) => letters[2 * k] + letters[2 * k + 1])
    const length = i % LONG_EVERY === 0 ? LONG_LENGTH : SHORT_MIN + randInt(rng, SHORT_MAX - SHORT_MIN + 1)
    const plaintext = Array.from({ length }, () => randLetter(rng)).join('')
    cases.push({
      id: `case-${String(i).padStart(4, '0')}`,
      config: { model, reflector, rotors, rings, positions, plugboard },
      plaintext,
    })
  }
  return cases
}

// ---------------------------------------------------------------------------------------------------
// Oracles
// ---------------------------------------------------------------------------------------------------

class OracleMissing extends Error {}

function ondoherVersion() {
  return createRequire(import.meta.url)('@ondoher/enigma/package.json').version
}

/** @ondoher/enigma, in process, through its documented Enigma API (configure, translate). */
function runOndoher(cases) {
  return cases.map(({ id, config, plaintext }) => {
    const reflector = ONDOHER_REFLECTORS[config.reflector]
    if (!inventory.getReflector(reflector)) return { id, unsupported: 'reflector', detail: config.reflector }
    const missing = config.rotors.filter((r) => !inventory.getRotor(r))
    if (missing.length) return { id, unsupported: 'rotor', detail: missing.join(' ') }
    const machine = new Enigma('oracle', { reflector })
    // Rotors and ring letters are given left to right; plugs must be an array (an empty string breaks it).
    machine.configure({ rotors: [...config.rotors], ringSettings: config.rings.join(''), plugs: [...config.plugboard] })
    const ciphertext = machine.translate(config.positions.join(''), plaintext)
    // The library keeps its rotors right to left, each with a core offset and a ring offset; the
    // window shows offset + ring (the same sum its own atTurnover() tests).
    const finalPositions = machine.rotors
      .map((r) => LETTERS[(r.offset + r.ringOffset) % 26])
      .reverse()
      .join('')
    return { id, ciphertext, finalPositions }
  })
}

function chunk(items, size) {
  const out = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

/** Run a Python batch adapter over every case (JSON Lines in, JSON Lines out). */
function runPython(python, script, cases) {
  const input = chunk(cases, BATCH_SIZE)
    .map((batch) => JSON.stringify(batch))
    .join('\n')
  const r = spawnSync(python, [path.join(HERE, script)], {
    input: input + '\n',
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024,
  })
  // Exit 3 means the adapter could not import its library. It exits before reading stdin, so the write
  // may also fail with EPIPE: check the status first to keep the adapter's install instructions.
  if (r.status === 3) throw new OracleMissing(r.stderr.trim())
  if (r.error) throw new OracleMissing(`${script}: cannot run ${python}: ${r.error.message}`)
  if (r.status !== 0) throw new Error(`${script} exited ${r.status}:\n${r.stderr}`)
  const lines = r.stdout.split('\n').filter(Boolean)
  const replies = lines.map((line) => JSON.parse(line))
  return { version: replies[0]?.version, results: replies.flatMap((reply) => reply.results) }
}

function pyEnigmaPython() {
  if (process.env.PY_ENIGMA_PYTHON) return process.env.PY_ENIGMA_PYTHON
  const venv = path.join(HERE, '.venv', 'bin', 'python')
  return existsSync(venv) ? venv : 'python3'
}

// ---------------------------------------------------------------------------------------------------
// Agreement, coverage and rendering
// ---------------------------------------------------------------------------------------------------

function byId(results, oracle, cases) {
  const map = new Map(results.map((r) => [r.id, r]))
  if (map.size !== cases.length || cases.some((c) => !map.has(c.id))) {
    throw new Error(`${oracle} returned ${map.size} results for ${cases.length} cases`)
  }
  return map
}

function firstDifference(a, b) {
  const n = Math.min(a.length, b.length)
  for (let i = 0; i < n; i++) if (a[i] !== b[i]) return i
  return a.length === b.length ? -1 : n
}

/** Compare every oracle with the reference. Returns the finished cases and any disagreements. */
export function agree(cases, results) {
  const disagreements = []
  const finished = cases.map((c) => {
    const ref = results.reference.get(c.id)
    if (ref.unsupported) throw new Error(`the reference cannot compute ${c.id}: ${ref.detail}`)
    const oracles = ['reference']
    for (const oracle of ORACLES.slice(1)) {
      const r = results[oracle].get(c.id)
      if (r.unsupported) continue
      if (r.ciphertext === ref.ciphertext && r.finalPositions === ref.finalPositions) {
        oracles.push(oracle)
      } else {
        disagreements.push({ id: c.id, oracle, config: c.config, reference: ref, other: r })
      }
    }
    return {
      id: c.id,
      config: c.config,
      plaintext: c.plaintext,
      ciphertext: ref.ciphertext,
      finalPositions: ref.finalPositions,
      oracles,
    }
  })
  return { finished, disagreements }
}

function coverageOf(finished, results) {
  const zero = () => Object.fromEntries(ORACLES.map((o) => [o, 0]))
  const byModel = Object.fromEntries(MODEL_NAMES.map((m) => [m, { cases: 0, ...zero() }]))
  const skipped = Object.fromEntries(ORACLES.slice(1).map((o) => [o, {}]))
  const rotors = Object.fromEntries([...STEPPING, 'Beta', 'Gamma'].map((r) => [r, 0]))
  const reflectors = Object.fromEntries(Object.keys(ONDOHER_REFLECTORS).map((r) => [r, 0]))
  const plugCounts = Array(14).fill(0)
  const rings = { allA: 0, allZ: 0, onlyAandZ: 0, anyA: 0, anyZ: 0 }
  let long = 0
  let short = 0
  let letters = 0
  let doubleStepCases = 0
  let doubleSteps = 0
  for (const c of finished) {
    const { model, reflector, plugboard } = c.config
    byModel[model].cases++
    for (const o of c.oracles) byModel[model][o]++
    for (const o of ORACLES.slice(1)) {
      const r = results[o].get(c.id)
      if (r.unsupported) skipped[o][r.unsupported] = (skipped[o][r.unsupported] ?? 0) + 1
    }
    for (const r of c.config.rotors) rotors[r]++
    reflectors[reflector]++
    plugCounts[plugboard.length]++
    const ringSet = new Set(c.config.rings)
    if (ringSet.size === 1 && ringSet.has('A')) rings.allA++
    if (ringSet.size === 1 && ringSet.has('Z')) rings.allZ++
    if ([...ringSet].every((r) => r === 'A' || r === 'Z')) rings.onlyAandZ++
    if (ringSet.has('A')) rings.anyA++
    if (ringSet.has('Z')) rings.anyZ++
    if (c.plaintext.length === LONG_LENGTH) long++
    else short++
    letters += c.plaintext.length
    const ds = results.reference.get(c.id).doubleSteps
    if (ds > 0) doubleStepCases++
    doubleSteps += ds
  }
  return {
    cases: finished.length,
    letters,
    texts: { long, longLetters: LONG_LENGTH, short, shortLetters: [SHORT_MIN, SHORT_MAX] },
    byModel,
    skipped,
    rotors,
    reflectors,
    rings,
    plugCounts,
    doubleSteps: { cases: doubleStepCases, total: doubleSteps },
  }
}

/** Coverage requirements from the build plan; a failure means the generator itself is wrong. */
function coverageProblems(finished, coverage) {
  const problems = []
  const need = (ok, message) => ok || problems.push(message)
  need(finished.length === CASE_COUNT, `expected ${CASE_COUNT} cases, got ${finished.length}`)
  need(coverage.texts.long === CASE_COUNT / LONG_EVERY, `expected 200 long texts, got ${coverage.texts.long}`)
  need(
    finished.every((c) => c.plaintext.length === LONG_LENGTH || (c.plaintext.length >= SHORT_MIN && c.plaintext.length <= SHORT_MAX)),
    'a text length is out of range',
  )
  for (const m of MODEL_NAMES) {
    need(coverage.byModel[m].cases > 0, `no ${m} cases`)
    for (const o of ORACLES) need(coverage.byModel[m][o] > 0, `${o} computed no ${m} case`)
  }
  for (const [r, n] of Object.entries(coverage.rotors)) need(n > 0, `rotor ${r} never used`)
  for (const [r, n] of Object.entries(coverage.reflectors)) need(n > 0, `reflector ${r} never used`)
  coverage.plugCounts.forEach((n, k) => need(n > 0, `no case with ${k} plugboard pairs`))
  need(coverage.rings.allA > 0 && coverage.rings.allZ > 0, 'rings never pinned to all-A and all-Z')
  need(coverage.doubleSteps.cases > 0, 'no case reaches a double step')
  for (const c of finished) {
    need(c.oracles[0] === 'reference' && c.oracles.length >= 2, `${c.id} has oracles ${c.oracles.join(',')}`)
  }
  return problems
}

/** Stable text: header pretty-printed, one case per line (keys in insertion order). */
export function render(doc) {
  const { cases, ...header } = doc
  const head = JSON.stringify(header, null, 2).replace(
    /\[\s+((?:"[^"\n]*"|-?\d+)(?:,\s+(?:"[^"\n]*"|-?\d+))*)\s+\]/g,
    (_, inner) => '[' + inner.split(/,\s+/).join(', ') + ']',
  )
  const body = cases.map((c) => '    ' + JSON.stringify(c)).join(',\n')
  return head.slice(0, -2) + ',\n  "cases": [\n' + body + '\n  ]\n}\n'
}

function printCoverage(cov, results) {
  const pad = (s, n) => String(s).padStart(n)
  const lines = []
  lines.push('Oracle coverage: cases each oracle computed and agreed on (reference = tools/reference_enigma.py)')
  lines.push(`  ${'model'.padEnd(6)}${pad('cases', 7)}${ORACLES.map((o) => pad(o, 11)).join('')}`)
  const total = { cases: 0, ...Object.fromEntries(ORACLES.map((o) => [o, 0])) }
  for (const [m, row] of Object.entries(cov.byModel)) {
    lines.push(`  ${m.padEnd(6)}${pad(row.cases, 7)}${ORACLES.map((o) => pad(row[o], 11)).join('')}`)
    total.cases += row.cases
    for (const o of ORACLES) total[o] += row[o]
  }
  lines.push(`  ${'all'.padEnd(6)}${pad(total.cases, 7)}${ORACLES.map((o) => pad(total[o], 11)).join('')}`)
  for (const [o, reasons] of Object.entries(cov.skipped)) {
    const example = (code) => [...results[o].values()].find((r) => r.unsupported === code)?.detail
    const list = Object.entries(reasons).map(([code, n]) => `${code} ${n} (e.g. ${example(code)})`)
    lines.push(`  ${o} not applicable: ${list.length ? list.join('; ') : 'none'}`)
  }
  lines.push(
    `  texts: ${cov.texts.long} × ${cov.texts.longLetters} letters, ${cov.texts.short} × ` +
      `${cov.texts.shortLetters[0]}–${cov.texts.shortLetters[1]}; ${cov.letters} letters in all`,
  )
  lines.push(`  rotors: ${Object.entries(cov.rotors).map(([r, n]) => `${r} ${n}`).join(', ')}`)
  lines.push(`  reflectors: ${Object.entries(cov.reflectors).map(([r, n]) => `${r} ${n}`).join(', ')}`)
  lines.push(
    `  rings: all-A ${cov.rings.allA}, all-Z ${cov.rings.allZ}, only A/Z ${cov.rings.onlyAandZ}, ` +
      `any A ${cov.rings.anyA}, any Z ${cov.rings.anyZ}`,
  )
  lines.push(`  plug pairs 0–13: ${cov.plugCounts.join(' ')}`)
  lines.push(`  double steps: ${cov.doubleSteps.total} in ${cov.doubleSteps.cases} cases`)
  console.log(lines.join('\n'))
}

function printDisagreements(disagreements) {
  console.error(`DISAGREEMENT: ${disagreements.length} case(s) where an oracle differs from the reference`)
  for (const d of disagreements.slice(0, 20)) {
    const at = firstDifference(d.reference.ciphertext, d.other.ciphertext)
    console.error(
      `  ${d.id} ${d.oracle}: ${JSON.stringify(d.config)}\n` +
        `    first ciphertext difference at letter ${at}; final windows reference ${d.reference.finalPositions}, ` +
        `${d.oracle} ${d.other.finalPositions}\n` +
        `    reference ${d.reference.ciphertext.slice(Math.max(0, at - 5), at + 15)}\n` +
        `    ${d.oracle.padEnd(9)} ${d.other.ciphertext.slice(Math.max(0, at - 5), at + 15)}`,
    )
  }
}

// ---------------------------------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------------------------------

function parseArgs(argv) {
  const args = { check: false, fixture: DEFAULT_FIXTURE }
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--check') args.check = true
    else if (argv[i] === '--fixture') args.fixture = path.resolve(argv[++i] ?? '')
    else if (argv[i].startsWith('--fixture=')) args.fixture = path.resolve(argv[i].slice('--fixture='.length))
    else throw new Error(`unknown argument ${argv[i]} (usage: node generate.mjs [--check] [--fixture <path>])`)
  }
  return args
}

function main(argv) {
  const args = parseArgs(argv)
  const started = performance.now()
  const cases = buildCases()

  const ondoher = ondoherVersion()
  if (ondoher !== ONDOHER_VERSION) {
    throw new OracleMissing(`@ondoher/enigma ${ondoher} is installed; ${ONDOHER_VERSION} is pinned: run npm ci`)
  }
  const reference = runPython(process.env.PYTHON ?? 'python3', 'ref_batch.py', cases)
  const py = runPython(pyEnigmaPython(), 'py_batch.py', cases)
  if (py.version !== PY_ENIGMA_VERSION) {
    throw new OracleMissing(`py-enigma ${py.version} answered; ${PY_ENIGMA_VERSION} is pinned: run npm run setup:py`)
  }
  const results = {
    reference: byId(reference.results, 'reference', cases),
    ondoher: byId(runOndoher(cases), 'ondoher', cases),
    pyEnigma: byId(py.results, 'pyEnigma', cases),
  }

  const { finished, disagreements } = agree(cases, results)
  const coverage = coverageOf(finished, results)
  printCoverage(coverage, results)
  if (disagreements.length) {
    printDisagreements(disagreements)
    return 2
  }
  const problems = coverageProblems(finished, coverage)
  if (problems.length) {
    console.error('COVERAGE: ' + problems.join('; '))
    return 2
  }

  const doc = {
    description:
      'Engine agreement vectors: each case was computed by every oracle listed in its `oracles` field, and they all ' +
      'agreed on the ciphertext and the final window letters. Generated by tools/oracles/generate.mjs; never edit by hand.',
    generator: 'tools/oracles/generate.mjs',
    seed: SEED,
    oracles: {
      reference: 'tools/reference_enigma.py (in this repository)',
      ondoher: `@ondoher/enigma ${ONDOHER_VERSION} (npm, MIT)`,
      pyEnigma: `py-enigma ${PY_ENIGMA_VERSION} (PyPI, MIT)`,
    },
    coverage,
    cases: finished,
  }
  const text = render(doc)
  const bytes = Buffer.byteLength(text)
  if (bytes > MAX_BYTES) {
    console.error(`SIZE: ${bytes} bytes > ${MAX_BYTES}`)
    return 2
  }
  const seconds = ((performance.now() - started) / 1000).toFixed(1)
  const rel = path.relative(process.cwd(), args.fixture) || args.fixture

  if (args.check) {
    const current = existsSync(args.fixture) ? readFileSync(args.fixture, 'utf8') : ''
    if (current !== text) {
      const a = current.split('\n')
      const b = text.split('\n')
      let line = 0
      while (line < Math.max(a.length, b.length) && a[line] === b[line]) line++
      console.error(`STALE ${rel}: line ${line + 1} differs; run node tools/oracles/generate.mjs`)
      console.error(`  committed:   ${(a[line] ?? '<missing>').slice(0, 160)}`)
      console.error(`  regenerated: ${(b[line] ?? '<missing>').slice(0, 160)}`)
      return 1
    }
    console.log(`OK ${rel} is up to date (${finished.length} cases, ${bytes} bytes, ${seconds} s)`)
    return 0
  }
  mkdirSync(path.dirname(args.fixture), { recursive: true })
  writeFileSync(args.fixture, text)
  console.log(`wrote ${finished.length} cases (${bytes} bytes) to ${rel} in ${seconds} s`)
  return 0
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    process.exitCode = main(process.argv.slice(2))
  } catch (err) {
    console.error(err instanceof OracleMissing ? `ORACLE MISSING: ${err.message}` : err)
    process.exitCode = err instanceof OracleMissing ? 3 : 2
  }
}
