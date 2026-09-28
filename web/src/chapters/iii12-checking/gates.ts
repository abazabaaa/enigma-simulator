/**
 * Chapter iii12-checking · gate `checking` (PLAN §4.4). PURE (L4): engine, lib/rng, contracts, lesson/kinds and crypto.
 *  - stop-verdict  custom inPage · 2/3 · one bombe stop (drum positions, test letter, the register's partner) and the
 *                  crib over its cipher letters. The learner works the checking machine (an Enigma without its
 *                  plugboard, drums at the stop): at a crib column where one letter's partner is known, pressing that
 *                  partner lights the other letter's partner. The answer is {verdict, letter, log}: the log of
 *                  deductions is replayed against the scramblers (checkStop semantics), so any valid order counts;
 *                  a contradiction names the letter forced to take two partners, a consistent stop must be checked
 *                  through every column and names the test letter's partner. A false stop on odd attempts, the true
 *                  stop on even ones (both kinds in every window); the truth is never stored in the instance.
 *  - set-key       set-machine · once · trial preview · a day with 10 cables and rings 01 01 01, its true stop and the
 *                  cables the checking machine found; the learner sets rotors, start windows (the crib starts `offset`
 *                  letters in) and every cable, and the whole message must decrypt. At least one cable is missing from
 *                  the check and the crib never starts the message, so neither shortcut passes.
 *  - fallback      stop-verdict.
 * Scene data: a KEINEBESONDEREN day whose wheel order gives 6 stops with the diagonal board (stops, checking-machine).
 */

import type { Letter, MachineConfig, ReflectorName, RotorName } from '../../contracts/core'
import type { ChapterGates, CheckResult, GenCtx, ItemLogic } from '../../contracts/lesson'
import type { MachineLocks } from '../../contracts/machine'
import type { PartId } from '../../contracts/stage'
import { runBombe, scramblerAt, testLetterOf, trueBombePosition, type Stop } from '../../crypto/bombe'
import { cribbedMessage, dayKey } from '../../crypto/generators'
import { menuFromCrib, turnoverWithin } from '../../crypto/menu'
import { positionString } from '../../crypto/tables'
import { LETTERS, createMachine, encipher, fromPairs, normalizeConfig, positionsToString, step } from '../../engine'
import { createRng, int, pick, seedFor, shuffle, type Rng } from '../../lib/rng'
import { setMachineItem, verdict } from '../../lesson/kinds'

const WINDOW = { kind: 'window' } as const
const ONCE = { kind: 'once' } as const
const L = (i: number): Letter => LETTERS[((i % 26) + 26) % 26]!
const idx = (l: string): number => LETTERS.indexOf(l.toUpperCase() as Letter)
const sameJson = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

/** Every control locked, the keyboard included, and the lamps hidden. */
export const READ_ONLY: MachineLocks = {
  model: true,
  rotors: true,
  reflector: true,
  rings: true,
  positions: true,
  plugboard: true,
  keyboard: true,
  lampsHidden: true,
}

/** The checking machine's locks: only the windows turn (to a crib column) and the keys press; the drums hold. */
export const CHECKING_LOCKS: MachineLocks = {
  model: true,
  rotors: true,
  reflector: true,
  rings: true,
  positions: false,
  plugboard: true,
  keyboard: false,
  hold: true,
}

/** The machine the gate scene leaves in place (plugless, never pressed). */
export const PARKED: MachineConfig = normalizeConfig({
  model: 'I',
  reflector: 'B',
  rotors: ['V', 'II', 'III'],
  rings: 'AAA',
  positions: 'AAA',
  plugboard: [],
})

// ---------------------------------------------------------------------------
// The checking machine: deductions along the crib from a stop's hypothesis
// ---------------------------------------------------------------------------

/** What the checking machine needs: the wheel order, the stop's drum positions and the crib over its cipher letters. */
export interface CheckData {
  readonly rotors: readonly RotorName[]
  readonly reflector: ReflectorName
  readonly crib: string
  /** The cipher letters under the crib, column by column. */
  readonly under: string
  readonly stop: { readonly positions: string; readonly testLetter: Letter; readonly stecker: Letter; readonly live: number }
}

/** One deduction: at crib column `pos`, pressing `press` (the other letter's known partner) lit `partner` for `letter`. */
export interface CheckStep {
  readonly pos: number
  readonly press: string
  readonly letter: string
  readonly partner: string
}

/** A plugless machine at the stop, windows turned to crib column `pos` (the right drum `pos` places on). */
export function columnWindows(d: Pick<CheckData, 'stop'>, pos: number): string {
  const p = d.stop.positions
  return p.slice(0, 2) + L(idx(p[2]!) + pos)
}

/** The checking machine's configuration at the stop (rings 01 01 01, no cables). */
export function checkingMachine(d: Pick<CheckData, 'rotors' | 'reflector' | 'stop'>): MachineConfig {
  return normalizeConfig({ model: 'I', reflector: d.reflector, rotors: [...d.rotors], rings: 'AAA', positions: d.stop.positions, plugboard: [] })
}

/** The scrambler of column pos (1-based): what the checking machine lights for each key at that column. */
export const columnScrambler = (d: CheckData, pos: number): number[] => scramblerAt(d.rotors, d.reflector, d.stop.positions, pos)

export interface Notes {
  /** partner[x] = y (both ways), or undefined. */
  readonly partner: Readonly<Record<string, string>>
}

export interface Replay {
  /** The partners in the notes after the replay (up to and including a conflict's first partner). */
  readonly partner: Readonly<Record<string, string>>
  /** The first step that breaks the procedure (a wrong key, a wrong lamp, a letter not in the column), if any. */
  readonly invalid?: { readonly at: number; readonly message: string }
  /** The first contradiction: the letter(s) forced to take a second partner. */
  readonly conflict?: { readonly at: number; readonly letters: readonly string[]; readonly partners: readonly string[] }
}

const columnOf = (d: CheckData, pos: number): [string, string] => [d.crib[pos - 1]!.toUpperCase(), d.under[pos - 1]!.toUpperCase()]

/** The starting notes: the stop's hypothesis, test letter ↔ its register partner. */
export function startNotes(d: CheckData): Record<string, string> {
  return { [d.stop.testLetter]: d.stop.stecker, [d.stop.stecker]: d.stop.testLetter }
}

/** Replay a log of deductions from the stop's hypothesis, checking each step against the checking machine. */
export function replay(d: CheckData, log: readonly CheckStep[]): Replay {
  const partner: Record<string, string> = startNotes(d)
  for (let k = 0; k < log.length; k++) {
    const s = log[k]!
    const pos = Number(s?.pos)
    if (!Number.isInteger(pos) || pos < 1 || pos > d.crib.length) return { partner, invalid: { at: k, message: `Step ${k + 1} names no crib column.` } }
    const [a, b] = columnOf(d, pos)
    const letter = String(s.letter ?? '').toUpperCase()
    const press = String(s.press ?? '').toUpperCase()
    const lamp = String(s.partner ?? '').toUpperCase()
    if (letter !== a && letter !== b) {
      return { partner, invalid: { at: k, message: `Column ${pos} holds ${a} over ${b}; ${letter || 'that'} is not one of them.` } }
    }
    const other = letter === a ? b : a
    if (partner[other] !== press) {
      const known = partner[other]
      return {
        partner,
        invalid: {
          at: k,
          message: known
            ? `At column ${pos} the key to press is ${known}, the partner of ${other} in the notes, not ${press}.`
            : `At column ${pos} the notes give no partner for ${other} yet, so pressing ${press} proves nothing.`,
        },
      }
    }
    const lit = L(columnScrambler(d, pos)[idx(press)]!)
    if (lit !== lamp) {
      return { partner, invalid: { at: k, message: `At column ${pos}, pressing ${press} lights ${lit}, not ${lamp}.` } }
    }
    const letters: string[] = []
    const partners: string[] = []
    if (partner[letter] !== undefined && partner[letter] !== lamp) {
      letters.push(letter)
      partners.push(partner[letter]!, lamp)
    }
    if (partner[lamp] !== undefined && partner[lamp] !== letter) {
      letters.push(lamp)
      partners.push(partner[lamp]!, letter)
    }
    if (letters.length) return { partner, conflict: { at: k, letters, partners } }
    partner[letter] = lamp
    partner[lamp] = letter
  }
  return { partner }
}

/** The state of each crib column under some notes: 'open' (one letter's partner known), 'check' (both), 'idle' (none). */
export function columnStates(d: CheckData, partner: Readonly<Record<string, string>>): ('open' | 'check' | 'idle')[] {
  return Array.from({ length: d.crib.length }, (_, j) => {
    const [a, b] = columnOf(d, j + 1)
    const ka = partner[a] !== undefined
    const kb = partner[b] !== undefined
    return ka && kb ? 'check' : ka || kb ? 'open' : 'idle'
  })
}

/** Whether notes are closed and agree everywhere: no open column, and every column with both partners known agrees. */
export function closure(d: CheckData, partner: Readonly<Record<string, string>>): { closed: true } | { closed: false; pos: number; why: 'open' | 'disagrees' } {
  const states = columnStates(d, partner)
  for (let j = 0; j < states.length; j++) {
    const pos = j + 1
    if (states[j] === 'open') return { closed: false, pos, why: 'open' }
    if (states[j] === 'check') {
      const [a, b] = columnOf(d, pos)
      if (L(columnScrambler(d, pos)[idx(partner[a]!)]!) !== partner[b]) return { closed: false, pos, why: 'disagrees' }
    }
  }
  return { closed: true }
}

/**
 * The checking machine's own order (checkStop's): passes along the crib from the left, each column both ways, until a
 * pass finds nothing new; a deduction that gives a letter a second partner ends it.
 */
export function canonicalLog(d: CheckData): { log: CheckStep[]; conflict: Replay['conflict'] | null } {
  const partner: Record<string, string> = startNotes(d)
  const log: CheckStep[] = []
  for (let changed = true; changed; ) {
    changed = false
    for (let pos = 1; pos <= d.crib.length; pos++) {
      const [a, b] = columnOf(d, pos)
      for (const [from, to] of [
        [a, b],
        [b, a],
      ] as const) {
        const p = partner[from]
        if (p === undefined) continue
        const want = L(columnScrambler(d, pos)[idx(p)]!)
        if (partner[to] === want) continue
        log.push({ pos, press: p, letter: to, partner: want })
        const r = replay(d, log)
        if (r.conflict) return { log, conflict: r.conflict }
        partner[to] = want
        partner[want] = to
        changed = true
      }
    }
  }
  return { log, conflict: null }
}

/** The cables the notes hold (pairs of different letters, 'AB' with A < B, sorted) and the letters found uncabled. */
export function notesCables(partner: Readonly<Record<string, string>>): { cables: string[]; plain: string[] } {
  const cables = new Set<string>()
  const plain: string[] = []
  for (const [x, y] of Object.entries(partner)) {
    if (x === y) plain.push(x)
    else cables.add([x, y].sort().join(''))
  }
  return { cables: [...cables].sort(), plain: plain.sort() }
}

// ---------------------------------------------------------------------------
// Scene data: the stop list (stops) and the checking machine (checking-machine)
// ---------------------------------------------------------------------------

export const STOPS_CRIB = 'KEINEBESONDEREN'

/** A 1940 day, rings 01 01 01, 10 cables; wheel order V II III; the crib at offset 13 of a 35-letter message. */
export const STOPS_DAY = (() => {
  const r = createRng(seedFor('iii12-stops', STOPS_CRIB, 52))
  const day = dayKey(r, { era: '1940', rings: 'AAA' })
  const m = cribbedMessage(r, { day, crib: STOPS_CRIB, length: STOPS_CRIB.length + 20 })
  const menu = menuFromCrib(m.cipher, STOPS_CRIB, m.offset)
  return {
    day,
    cipher: m.cipher,
    offset: m.offset,
    menu,
    test: testLetterOf(menu),
    truth: trueBombePosition(day, m.start, m.offset),
    under: m.cipher.slice(m.offset, m.offset + STOPS_CRIB.length),
  }
})()

/** The wheel order's stops with the diagonal board (runBombe, unit-tested): [positions, register partner, live wires]. */
export const STOP_LIST: readonly (readonly [string, Letter, number])[] = [
  ['DLE', 'X', 25],
  ['HRJ', 'M', 25],
  ['QAX', 'F', 25],
  ['RZW', 'E', 25],
  ['WAB', 'S', 25],
  ['ZGH', 'O', 25],
]

/** The stops-scene bet's truth for a run: all stops true, none, or (one true among several) most false. */
export function trueStopsTruth(stops: readonly Pick<Stop, 'positions'>[], truth: string): 'all' | 'most-false' | 'none' {
  const t = stops.filter((s) => s.positions === truth).length
  return t === 0 ? 'none' : t === stops.length ? 'all' : 'most-false'
}

/** A stop of the scene's list as checking data. */
export function sceneCheckData(positions: string): CheckData {
  const s = STOP_LIST.find((x) => x[0] === positions) ?? STOP_LIST[0]!
  return {
    rotors: STOPS_DAY.day.rotors,
    reflector: STOPS_DAY.day.reflector,
    crib: STOPS_CRIB,
    under: STOPS_DAY.under,
    stop: { positions: s[0], testLetter: STOPS_DAY.test, stecker: s[1], live: s[2] },
  }
}

// ---------------------------------------------------------------------------
// stop-verdict · custom inPage · 2/3 (rollback: machine)
// ---------------------------------------------------------------------------

export type StopInstance = CheckData

export interface StopAnswer {
  readonly verdict: 'consistent' | 'contradiction'
  readonly letter: string
  readonly log: readonly CheckStep[]
}

/** Cribs of 10–12 letters from the kit's vocabulary. */
export const STOP_CRIBS: readonly string[] = [
  'ANDIEGRUPPE',
  'WETTERVORHER',
  'MELDUNGXNORD',
  'FEINDBEIDORF',
  'KEINEMUNITION',
  'LAGERUHIGX',
  'ABMARSCHXOST',
  'BRUECKEXNORD',
]

/**
 * The true stop on every third attempt, false stops otherwise: any three attempts in a row hold two false stops, so
 * "every stop is the key" can never pass, even after a full check.
 */
export const falseStopAttempt = (attempt: number): boolean => attempt % 3 !== 0

export function stopInstance(r: Rng, ctx: Pick<GenCtx, 'attempt'>): StopInstance {
  const wantFalse = falseStopAttempt(ctx.attempt)
  for (;;) {
    const day = dayKey(r, { era: '1940', rings: 'AAA' })
    const crib = pick(r, STOP_CRIBS).slice(0, 12)
    const m = cribbedMessage(r, { day, crib, length: crib.length + 8 })
    const menu = menuFromCrib(m.cipher, crib, m.offset)
    const truth = trueBombePosition(day, m.start, m.offset)
    const base = { rotors: day.rotors, reflector: day.reflector, crib, under: m.cipher.slice(m.offset, m.offset + crib.length) }
    const o = { menu, rotors: day.rotors, reflector: day.reflector, diagonal: false }
    let found: Stop | undefined
    if (wantFalse) {
      found = runBombe({ ...o, from: positionString(int(r, 17576)), limit: 60 }).find((s) => s.positions !== truth)
    } else {
      found = runBombe({ ...o, from: truth, limit: 1 })[0]
      const S = fromPairs(day.plugboard)
      if (found && found.stecker !== L(S[idx(found.testLetter)]!)) found = undefined
    }
    if (!found) continue
    const d: StopInstance = { ...base, stop: { positions: found.positions, testLetter: found.testLetter, stecker: found.stecker, live: found.live } }
    const c = canonicalLog(d)
    // A false stop must fail along the crib (after at least one deduction); a true one must teach a few cables.
    if (wantFalse ? !c.conflict || c.log.length < 2 : c.conflict || c.log.length < 3 || c.log.length > 14) continue
    return d
  }
}

export function stopSolution(i: StopInstance): StopAnswer {
  const c = canonicalLog(i)
  if (c.conflict) return { verdict: 'contradiction', letter: c.conflict.letters[0]!, log: c.log }
  return { verdict: 'consistent', letter: i.stop.stecker, log: c.log }
}

const machineFail = (message: string, highlight: readonly PartId[] = ['rotor-right']): CheckResult =>
  verdict(false, { kind: 'machine', field: 'positions', message, highlight }, message)

export function stopCheck(i: StopInstance, a: unknown): CheckResult {
  const ans = (a ?? {}) as Partial<StopAnswer>
  const log = Array.isArray(ans.log) ? ans.log : []
  const letter = String(ans.letter ?? '').toUpperCase()
  const r = replay(i, log)
  if (r.invalid) return machineFail(r.invalid.message)
  if (ans.verdict === 'contradiction') {
    if (!r.conflict) {
      const c = closure(i, r.partner)
      return machineFail(
        c.closed
          ? 'Your deductions never gave a letter two partners, and every column agrees: this stop survives the check.'
          : `No letter has two partners in your notes yet; column ${c.pos} ${c.why === 'open' ? 'still gives a deduction' : 'disagrees with your notes: press there to see it'}.`,
      )
    }
    if (!r.conflict.letters.includes(letter)) {
      return machineFail(
        `The contradiction in your notes is on ${r.conflict.letters.join(' and ')}: it would need the partners ${r.conflict.partners.slice(0, 2).join(' and ')}.`,
      )
    }
    return verdict(true)
  }
  if (ans.verdict === 'consistent') {
    if (r.conflict) {
      return machineFail(
        `Your own notes give ${r.conflict.letters[0]} two partners, ${r.conflict.partners.slice(0, 2).join(' and ')}: this stop is false.`,
      )
    }
    const c = closure(i, r.partner)
    if (!c.closed) {
      return machineFail(
        c.why === 'open'
          ? `The check is not finished: column ${c.pos} still gives a deduction.`
          : `Column ${c.pos} disagrees with your notes: pressing there gives a letter a second partner.`,
      )
    }
    if (letter !== i.stop.stecker) return machineFail(`The stop survives; ${i.stop.testLetter}'s partner is ${i.stop.stecker}, from the register.`)
    return verdict(true)
  }
  return machineFail('Say whether the stop survives the check or fails it.')
}

export function stopVerdictItem(id: string): ItemLogic<StopInstance, StopAnswer> {
  return {
    id,
    kind: 'custom',
    rule: WINDOW,
    compute: true,
    inPage: true,
    lintSeeds: 150,
    generate: (r, ctx) => stopInstance(r, ctx),
    same: (a, b) => sameJson(a, b),
    solve: stopSolution,
    check: stopCheck,
    sampleAnswer: (_i, r) => ({ verdict: pick(r, ['consistent', 'contradiction'] as const), letter: L(int(r, 26)), log: [] }),
    mutate: (_i, a) => ({ ...a, verdict: a?.verdict === 'consistent' ? 'contradiction' : 'consistent' }),
    setup: (i) => ({ machine: checkingMachine(i), locks: CHECKING_LOCKS, stage: 'checking' }),
    highlight: () => [],
  }
}

export const stopVerdict = stopVerdictItem('stop-verdict')

// ---------------------------------------------------------------------------
// set-key · set-machine · once · trial preview (rollback: machine)
// ---------------------------------------------------------------------------

/** Cribs of 13–16 letters (longer cribs find more cables). */
export const KEY_CRIBS: readonly string[] = [
  'KEINEBESONDEREN',
  'WETTERVORHERSAGE',
  'ANDIEGRUPPEXNORD',
  'MELDUNGXNULLEINS',
  'STELLUNGXNORDOST',
  'ANKUNFTXREGIMENT',
  'FEINDBEIBRUECKE',
]

export interface KeyScenario {
  readonly day: MachineConfig
  readonly plain: string
  readonly cipher: string
  readonly crib: string
  readonly offset: number
  readonly start: string
  readonly stop: CheckData['stop']
  /** The cables and uncabled letters the checking machine finds at the true stop. */
  readonly cables: readonly string[]
  readonly plainLetters: readonly string[]
}

const scenarioCache = new Map<number, KeyScenario | null>()

/**
 * The day behind a set-key seed, or null when it does not make a good exercise: the crib starts 1–10 letters into
 * the message with no middle-rotor step before it (so the start windows are the stop's with the right rotor turned
 * back `offset` places), and the checking machine's cables leave 1–2 cables that change the decrypt.
 */
export function keyScenario(seed: number): KeyScenario | null {
  if (scenarioCache.has(seed)) return scenarioCache.get(seed)!
  const r = createRng(seed)
  const day = dayKey(r, { era: '1940', rings: 'AAA' })
  const crib = pick(r, KEY_CRIBS)
  const m = cribbedMessage(r, { day, crib, length: crib.length + 18 + int(r, 10) })
  let out: KeyScenario | null = null
  if (m.offset >= 1 && m.offset <= 10 && turnoverWithin(day.rotors, m.start, 1, m.offset) === null) {
    const menu = menuFromCrib(m.cipher, crib, m.offset)
    const test = testLetterOf(menu)
    const S = fromPairs(day.plugboard)
    const stop = { positions: trueBombePosition(day, m.start, m.offset), testLetter: test, stecker: L(S[idx(test)]!), live: 25 }
    const d: CheckData = { rotors: day.rotors, reflector: day.reflector, crib, under: m.cipher.slice(m.offset, m.offset + crib.length), stop }
    const c = canonicalLog(d)
    if (!c.conflict) {
      const notes = replay(d, c.log).partner
      const { cables, plain: plainLetters } = notesCables(notes)
      const decrypt = (plugs: readonly string[]) =>
        encipher(createMachine({ ...day, positions: m.start, plugboard: [...plugs] }), m.cipher).output
      const missing = day.plugboard.filter((p) => !cables.includes([...p].sort().join('')))
      const needed = missing.filter((p) => decrypt(day.plugboard.filter((q) => q !== p)) !== m.plain)
      if (decrypt(cables) !== m.plain && needed.length >= 1 && needed.length <= 2) {
        out = { day, plain: m.plain, cipher: m.cipher, crib, offset: m.offset, start: m.start, stop, cables, plainLetters }
      }
    }
  }
  if (scenarioCache.size > 400) scenarioCache.delete(scenarioCache.keys().next().value!)
  scenarioCache.set(seed, out)
  return out
}

export interface KeyInstance {
  readonly setup: { readonly machine: MachineConfig; readonly stage: 'wire' }
  readonly unlocked: readonly ('rotors' | 'positions' | 'plugboard')[]
  readonly trial: 'preview'
  /** The ciphertext (the live preview decrypts it with the learner's settings). */
  readonly message: string
  /** The generator seed: the check rebuilds the day from it (the key is never stored). */
  readonly seed: number
}

/** The machine the learner starts from: rotors I II III at AAA, rings 01 01 01, no cables. */
export const KEY_START: MachineConfig = normalizeConfig({ model: 'I', reflector: 'B', rotors: ['I', 'II', 'III'], rings: 'AAA', positions: 'AAA', plugboard: [] })

export function keyInstance(r: Rng): KeyInstance {
  for (;;) {
    const seed = int(r, 2 ** 31)
    const sc = keyScenario(seed)
    if (!sc) continue
    return { setup: { machine: KEY_START, stage: 'wire' }, unlocked: ['rotors', 'positions', 'plugboard'], trial: 'preview', message: sc.cipher, seed }
  }
}

/** The windows the machine stands at after `n` presses from `start` (engine stepping). */
export function windowsAfter(config: MachineConfig, start: string, n: number): string {
  let s = createMachine({ ...config, positions: start })
  for (let k = 0; k < n; k++) s = step(s).state
  return positionsToString(s)
}

export const setKey = setMachineItem<KeyInstance>({
  id: 'set-key',
  rule: ONCE,
  generate: (r) => keyInstance(r),
  same: (a, b) => a.seed === b.seed,
  predicate(i, cfg) {
    const sc = keyScenario(i.seed)!
    const out = encipher(createMachine(cfg), i.message).output
    if (out === sc.plain) return true
    if (cfg.rotors.join(' ') !== sc.day.rotors.join(' ')) {
      return {
        field: 'rotors',
        message: `The stop was found on wheel order ${sc.day.rotors.join(' ')}; your machine has ${cfg.rotors.join(' ')}.`,
        highlight: ['rotor-left', 'rotor-middle', 'rotor-right'],
      }
    }
    const windows = cfg.positions.join('')
    if (windows !== sc.start) {
      const atCrib = windowsAfter(cfg, windows, sc.offset)
      return {
        field: 'positions',
        message:
          `From windows ${windows} the machine stands at ${atCrib} when the crib begins (after ${sc.offset} letters), ` +
          `but the stop puts the crib’s first letter at drum positions ${sc.stop.positions}.`,
        highlight: ['rotor-right'],
      }
    }
    const k = [...out].findIndex((c, j) => c !== sc.plain[j])
    return {
      field: 'plugboard',
      message: `Rotors and windows are right, but the decrypt goes wrong at letter ${k + 1}: a cable is missing or wrong. Look for letters swapped in pairs.`,
      highlight: ['plugboard'],
    }
  },
  solve: (i) => {
    const sc = keyScenario(i.seed)!
    return normalizeConfig({ ...i.setup.machine, rotors: [...sc.day.rotors], positions: sc.start, plugboard: [...sc.day.plugboard] })
  },
  sampleAnswer: (i, r) => {
    const rotors = shuffle(r, ['I', 'II', 'III', 'IV', 'V'] as RotorName[]).slice(0, 3)
    const letters = shuffle(r, [...LETTERS])
    const plugboard = Array.from({ length: 10 }, (_, k) => letters[2 * k]! + letters[2 * k + 1]!)
    return normalizeConfig({ ...i.setup.machine, rotors, positions: [L(int(r, 26)), L(int(r, 26)), L(int(r, 26))], plugboard })
  },
  highlight: () => [],
})

// ---------------------------------------------------------------------------

export const GATES: ChapterGates = {
  checking: {
    items: [stopVerdict, setKey] as ItemLogic[],
    fallback: stopVerdict as ItemLogic,
  },
}
