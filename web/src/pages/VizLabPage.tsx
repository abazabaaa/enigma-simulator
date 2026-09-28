/**
 * #/lab/viz (PLAN §2.3; owner 08): every crypto view fed with fixture data, for chapter builders and reviewers.
 *  - CycleDiagram and CycleAlign: Rejewski's AD from REJEWSKI_65 (vector 13), and the toy hexagon;
 *  - CatalogueHistogram: the UKW-A catalogue built in a worker on demand (timed; data-ms on catalogue-build);
 *  - LightTable: engine-computed female sheets;
 *  - CribStrip and MenuGraph: vector 14 (ATTACKATDAWN under WSNPNLKLSTCS) and a generated cribbed message;
 *  - WireGrid and TestRegister: the toy bombe (8 wires) and a 26-wire bombe at its true and a false position, with a
 *    whole-wheel-order run in the worker, board off and on.
 */

import { useMemo, useState, type JSX, type ReactNode } from 'react'
import { compose, fromCycles, fromPairs, type Letter } from '../engine'
import { createRng } from '../lib/rng'
import { menuScramblers, propagate, testLetterOf, toyBombe, trueBombePosition, type Stop } from '../crypto/bombe'
import { runBombeAsync } from '../crypto/bombeClient'
import { catalogueStats, type Catalogue } from '../crypto/catalogue'
import { getCatalogue } from '../crypto/catalogueClient'
import { cribbedMessage, dayKey } from '../crypto/generators'
import { closures, loops, menuFromCrib, menuFromEdges } from '../crypto/menu'
import { REJEWSKI_65, characteristic, pairedCycles, products } from '../crypto/rejewski'
import { femaleSheet } from '../crypto/sheets'
import { positionIndex, positionString } from '../crypto/tables'
import {
  CatalogueHistogram,
  CribStrip,
  CycleAlign,
  CycleDiagram,
  LightTable,
  MenuGraph,
  TestRegister,
  WireGrid,
} from '../viz'

// ---------------------------------------------------------------------------------------------------------------
// Fixtures (pure, computed once)
// ---------------------------------------------------------------------------------------------------------------

const P65 = products(REJEWSKI_65)
const AD = P65.AD as number[]
const BE = P65.BE as number[]
const CF = P65.CF as number[]
const DAY_65 = characteristic(AD, BE, CF)
const HEXAGON = [...compose(fromCycles('(ab)(cd)(ef)', 6), fromCycles('(bc)(de)(fa)', 6))]
const [TEN_A, TEN_B] = pairedCycles(AD)[0]! as [number[], number[]]

const V14 = { cipher: 'WSNPNLKLSTCS', crib: 'ATTACKATDAWN' }
const V14_MENU = menuFromCrib(V14.cipher, V14.crib, 0)

const STRIP = cribbedMessage(createRng(14), { day: dayKey(createRng(1940), { era: '1940' }), crib: V14.crib, length: 30 })

const SHEETS = (['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'] as const).map((left) =>
  femaleSheet({ rotors: ['I', 'II', 'III'], reflector: 'B', left }),
)

const TOY = toyBombe(createRng(8), { n: 8, scramblers: 4 })

/** A 1940 day with a cribbed message whose menu has ≥ 3 closures (seeded search, deterministic). */
const BOMBE26 = (() => {
  const crib = 'WETTERVORHERSAGEBISKAYA'
  for (let seed = 1; ; seed++) {
    const r = createRng(seed)
    const day = dayKey(r, { era: '1940' })
    const m = cribbedMessage(r, { day, crib, length: 40 })
    const menu = menuFromCrib(m.cipher, crib, m.offset)
    if (closures(menu) < 3) continue
    const test = testLetterOf(menu)
    return { day, crib, menu, test, truth: trueBombePosition(day, m.start, m.offset), offset: m.offset }
  }
})()

const LETTERS8 = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'] as const

// ---------------------------------------------------------------------------------------------------------------

function Section(p: { id: string; title: string; note: ReactNode; children: ReactNode }): JSX.Element {
  return (
    <section className="flex flex-col gap-3 border-t border-stone-800 pt-6" aria-labelledby={`${p.id}-title`}
      data-testid={`lab-${p.id}`}>
      <h2 id={`${p.id}-title`} className="text-xl font-semibold text-stone-100">{p.title}</h2>
      <p className="max-w-3xl text-sm text-stone-400">{p.note}</p>
      {p.children}
    </section>
  )
}

const stopsText = (k: number) => `${k} stop${k === 1 ? '' : 's'}`

const buttonClass = 'rounded border border-stone-600 px-2 py-1 text-sm text-stone-100 hover:bg-stone-800'

function CyclesDemo(): JSX.Element {
  const [picked, setPicked] = useState<number | null>(null)
  const [relabel, setRelabel] = useState(false)
  const highlight = useMemo(() => {
    if (picked === null) return undefined
    const cyc = [picked]
    for (let x = AD[picked]!; x !== picked; x = AD[x]!) cyc.push(x)
    return cyc
  }, [picked])
  const cable = useMemo(() => [...fromPairs('AB DE')], [])
  return (
    <>
      <CycleDiagram perm={AD} highlightCycle={highlight} onPickLetter={setPicked} relabelBy={relabel ? cable : undefined} />
      <label className="flex items-center gap-2 text-sm text-stone-300">
        <input type="checkbox" checked={relabel} onChange={(e) => setRelabel(e.target.checked)}
          data-testid="lab-relabel" />
        Relabel through the cables A–B and D–E (the lengths stay)
      </label>
      <p className="text-sm text-stone-400">The toy hexagon (ab)(cd)(ef) · (bc)(de)(fa):</p>
      <CycleDiagram perm={HEXAGON} testId="cycle-diagram-hexagon" />
    </>
  )
}

function AlignDemo(): JSX.Element {
  const [offset, setOffset] = useState(0)
  const [reversed, setReversed] = useState(true)
  return (
    <CycleAlign a={TEN_A} b={TEN_B} offset={offset} reversed={reversed}
      onChange={(o, r) => {
        setOffset(o)
        setReversed(r)
      }} />
  )
}

function CatalogueDemo(): JSX.Element {
  const [state, setState] = useState<'idle' | 'building' | 'done' | 'error'>('idle')
  const [progress, setProgress] = useState(0)
  const [ms, setMs] = useState<number | null>(null)
  const [catalogue, setCatalogue] = useState<Catalogue | null>(null)
  const build = () => {
    setState('building')
    const t = performance.now()
    getCatalogue('A', (d, total) => setProgress(d / total)).then(
      (c) => {
        setMs(Math.round(performance.now() - t))
        setCatalogue(c)
        setState('done')
      },
      () => setState('error'),
    )
  }
  const stats = useMemo(() => (catalogue ? catalogueStats(catalogue) : null), [catalogue])
  const candidates = catalogue?.get(DAY_65)?.length ?? 0
  return (
    <>
      <div className="flex flex-wrap items-center gap-3" data-testid="catalogue-build" data-state={state}
        data-ms={ms ?? undefined} data-candidates={catalogue ? candidates : undefined}>
        <button type="button" className={buttonClass} onClick={build} disabled={state === 'building'}
          data-testid="catalogue-build-button">
          Build the catalogue (UKW-A)
        </button>
        <progress max={1} value={progress} aria-label="Catalogue build progress" className="w-48 accent-amber-400" />
        <span className="font-mono text-sm text-stone-300" aria-live="polite">
          {state === 'done' ? `built in ${ms} ms` : state === 'building' ? `${Math.round(progress * 100)}%` : state}
        </span>
      </div>
      {stats && (
        <>
          <p className="text-sm text-stone-300">
            Rejewski’s day, <span className="font-mono">{DAY_65}</span>, has{' '}
            <span data-testid="catalogue-candidates">{candidates}</span> candidate settings in this catalogue.
          </p>
          <CatalogueHistogram stats={stats} highlight={String(candidates)} />
        </>
      )}
    </>
  )
}

function CribDemo(): JSX.Element {
  const [offset, setOffset] = useState(0)
  return (
    <>
      <CribStrip cipher={STRIP.cipher} crib={V14.crib} offset={offset} onOffset={setOffset} />
      <p className="text-sm text-stone-400">Vector 14, read-only:</p>
      <CribStrip cipher={V14.cipher} crib={V14.crib} offset={0} readOnly testId="crib-strip-v14" />
    </>
  )
}

function MenuDemo(): JSX.Element {
  const [added, setAdded] = useState<readonly number[]>(() => V14_MENU.edges.slice(0, 9).map((e) => e.pos))
  const [loopIndex, setLoopIndex] = useState<number | null>(null)
  const menu = menuFromEdges(V14_MENU.edges.filter((e) => added.includes(e.pos)))
  const found = loops(menu)
  return (
    <>
      <MenuGraph menu={menu} available={V14_MENU.edges}
        onAddEdge={(pos) => setAdded((a) => [...a, pos])}
        onRemoveEdge={(pos) => setAdded((a) => a.filter((x) => x !== pos))}
        highlightLoop={loopIndex !== null ? found[loopIndex] : undefined}
        warnings={[12]} />
      <div className="flex flex-wrap items-center gap-2 text-sm text-stone-300">
        <span>Highlight a loop:</span>
        {found.map((l, i) => (
          <button key={l.join('')} type="button" className={buttonClass} aria-pressed={loopIndex === i}
            onClick={() => setLoopIndex(loopIndex === i ? null : i)}>
            {l.join('')}
          </button>
        ))}
        {found.length === 0 && <span className="text-stone-400">none yet</span>}
        <span className="text-stone-400">(position 12 is flagged as a warning, for the demo)</span>
      </div>
    </>
  )
}

function ToyBombeDemo(): JSX.Element {
  const [wire, setWire] = useState<Letter>(TOY.truth.wire)
  const [diagonal, setDiagonal] = useState(false)
  const ws = useMemo(() => propagate(TOY.menu, TOY.scramblers, { bank: TOY.truth.bank, wire }, { n: 8, diagonal }),
    [wire, diagonal])
  const [step, setStep] = useState<number | null>(null)
  const [clicked, setClicked] = useState<string>('')
  const shown = step === null ? ws.order.length : Math.min(step, ws.order.length)
  const register = Array.from({ length: 8 }, (_, w) =>
    ws.order.slice(0, shown).some((e) => e.bank === TOY.truth.bank.charCodeAt(0) - 65 && e.wire === w))
  return (
    <>
      <p className="font-mono text-sm text-stone-300">
        Loop {TOY.menu.edges.map((e) => `${e.a}–${e.b}@${e.pos}`).join(', ')}; test letter {TOY.truth.bank}
      </p>
      <div className="flex flex-wrap items-center gap-2 text-sm text-stone-300" role="group"
        aria-label="Hypothesis for the test letter">
        <span>Assume {TOY.truth.bank} ↔</span>
        {LETTERS8.map((l) => (
          <button key={l} type="button" className={buttonClass} aria-pressed={wire === l}
            data-testid={`toy-hyp-${l}`} onClick={() => {
              setWire(l)
              setStep(null)
            }}>
            {l.toLowerCase()}
          </button>
        ))}
        <label className="ml-2 flex items-center gap-1">
          <input type="checkbox" checked={diagonal} onChange={(e) => setDiagonal(e.target.checked)} />
          diagonal board
        </label>
      </div>
      <label className="flex items-center gap-2 text-sm text-stone-300">
        Replay
        <input type="range" min={0} max={ws.order.length} value={shown} onChange={(e) => setStep(Number(e.target.value))}
          data-testid="toy-step" aria-valuetext={`${shown} of ${ws.order.length} wires`} />
        <span className="font-mono">{shown} / {ws.order.length}</span>
      </label>
      <div className="grid gap-4 md:grid-cols-2">
        <WireGrid state={ws} step={shown} diagonal={diagonal} testLetter={TOY.truth.bank}
          onToggleWire={(b, w) => setClicked(`${String.fromCharCode(65 + b)}${String.fromCharCode(97 + w)}`)}
          testId="wire-grid-toy" />
        <TestRegister live={register} testLetter={TOY.truth.bank} testId="test-register-toy" />
      </div>
      <p className="text-sm text-stone-400" aria-live="polite">{clicked ? `Last cell pressed: ${clicked}` : ' '}</p>
    </>
  )
}

function Bombe26Demo(): JSX.Element {
  const [atTruth, setAtTruth] = useState(true)
  const [diagonal, setDiagonal] = useState(true)
  const [wire, setWire] = useState<Letter>('A')
  const [runs, setRuns] = useState<{ off?: Stop[]; on?: Stop[]; busy: boolean }>({ busy: false })
  const positions = atTruth ? BOMBE26.truth : positionString(positionIndex(BOMBE26.truth) + 4321)
  const ws = useMemo(() => {
    const scr = menuScramblers(BOMBE26.menu, BOMBE26.day.rotors, BOMBE26.day.reflector, positions)
    return propagate(BOMBE26.menu, scr, { bank: BOMBE26.test, wire }, { n: 26, diagonal })
  }, [positions, wire, diagonal])
  const run = async () => {
    setRuns({ busy: true })
    const o = { menu: BOMBE26.menu, rotors: BOMBE26.day.rotors, reflector: BOMBE26.day.reflector }
    const off = await runBombeAsync({ ...o, diagonal: false })
    const on = await runBombeAsync({ ...o, diagonal: true })
    setRuns({ off, on, busy: false })
  }
  const test = BOMBE26.test.charCodeAt(0) - 65
  return (
    <>
      <p className="font-mono text-sm break-all text-stone-300">
        {BOMBE26.day.rotors.join(' ')} · crib {BOMBE26.crib} at {BOMBE26.offset} · {closures(BOMBE26.menu)} closures ·
        test letter {BOMBE26.test} · drums {positions} ({atTruth ? 'the true position' : 'a false position'})
      </p>
      <div className="flex flex-wrap items-center gap-3 text-sm text-stone-300">
        <button type="button" className={buttonClass} onClick={() => setAtTruth(!atTruth)} data-testid="bombe26-position">
          {atTruth ? 'Go to a false position' : 'Go to the true position'}
        </button>
        <label className="flex items-center gap-1">
          <input type="checkbox" checked={diagonal} onChange={(e) => setDiagonal(e.target.checked)} />
          diagonal board
        </label>
        <label className="flex items-center gap-1">
          hypothesis {BOMBE26.test} ↔
          <select value={wire} onChange={(e) => setWire(e.target.value as Letter)} className="rounded bg-stone-900 px-1"
            data-testid="bombe26-wire">
            {Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i)).map((l) => (
              <option key={l} value={l}>{l.toLowerCase()}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <WireGrid state={ws} diagonal={diagonal} testLetter={BOMBE26.test} testId="wire-grid-26" />
        <TestRegister live={ws.live[test]!} testLetter={BOMBE26.test} testId="test-register-26" />
      </div>
      <div className="flex flex-wrap items-center gap-3 text-sm text-stone-300" data-testid="bombe-run"
        data-off={runs.off?.length} data-on={runs.on?.length}
        data-true-found={runs.on ? String(runs.on.some((s) => s.positions === BOMBE26.truth)) : undefined}>
        <button type="button" className={buttonClass} onClick={() => void run()} disabled={runs.busy}
          data-testid="bombe-run-button">
          Run the whole wheel order, board off and on
        </button>
        <span aria-live="polite">
          {runs.busy ? 'running…' : runs.on ? `${stopsText(runs.off!.length)} without the board, ${runs.on.length} with it` : ''}
        </span>
      </div>
    </>
  )
}

export function VizLabPage(): JSX.Element {
  const [shown, setShown] = useState(1)
  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-8 px-4 py-10 sm:px-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold text-stone-100">Visualisation lab</h1>
        <p className="max-w-3xl text-stone-400">
          Every crypto view with fixture data: Rejewski’s 65 indicators (vector 13), the ATTACKATDAWN menu (vector 14)
          and the toy bombe. The views are keyboard-operable; their data-* attributes are what the tests read.
        </p>
      </header>
      <Section id="cycles" title="CycleDiagram" note="AD from the 65 indicators. Pick a letter to highlight its cycle.">
        <CyclesDemo />
      </Section>
      <Section id="align" title="CycleAlign" note="AD’s two 10-cycles; written backwards, one of the ten shifts is Rejewski’s A.">
        <AlignDemo />
      </Section>
      <Section id="catalogue" title="CatalogueHistogram"
        note="Six rotor orders × 17,576 positions (rings AAA) filed by characteristic, built in a worker.">
        <CatalogueDemo />
      </Section>
      <Section id="light-table" title="LightTable"
        note="Female sheets computed by the engine (rotors I II III, UKW-B, left rotor at A…H), stacked from the first.">
        <LightTable sheets={SHEETS} size={51} shown={shown} onShown={setShown} />
      </Section>
      <Section id="crib" title="CribStrip" note="Slide the crib with the arrow keys; red columns are crashes.">
        <CribDemo />
      </Section>
      <Section id="menu" title="MenuGraph"
        note="The ATTACKATDAWN menu with its first nine edges; add the rest to close the loops ATLK, TNS and TAWCN.">
        <MenuDemo />
      </Section>
      <Section id="toy-bombe" title="WireGrid and TestRegister: the toy bombe"
        note="Eight wires around a four-scrambler loop. The true hypothesis lights one register wire, a false one seven.">
        <ToyBombeDemo />
      </Section>
      <Section id="bombe-26" title="WireGrid and TestRegister: 26 wires"
        note="At the true position the register shows 1 or 25 live wires; at a false one all 26.">
        <Bombe26Demo />
      </Section>
    </main>
  )
}
