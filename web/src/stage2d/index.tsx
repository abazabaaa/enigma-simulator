/**
 * Stage2D (PLAN §2.6): the machine as an SVG "flattened circuit", the default renderer without
 * WebGL, under ?stage=2d and in the 2D e2e runs. Default export ComponentType<StageViewProps>.
 *
 * It reads the stage store (directive via props, highlights, ghost), the machine store (or the toy
 * store for source 'toy') and the playback clock, and draws:
 *  - one column of n contacts per part (see layout.ts), each part a <g data-part> dimmed per
 *    dimmedParts(focus, model) — the only definition of dimming, so 2D and 3D report the same list;
 *  - each rotor's wiring at its current offset, its window letter, its ring setting (01–26), the
 *    alphabet-ring band, the core's contact-A marker (offset from the band's A by the ring setting),
 *    the notch mark(s) and the pawl;
 *  - the signal path up to t (trace 'animate'), whole ('static') or not at all ('off'), concealed
 *    under lampsHidden;
 *  - highlights as outlines that pulse, or stay static under reduced motion;
 *  - a ghost path dashed in --sym-ghost against the reference in --sym-reference.
 * After every change of what is shown it calls onReport with renderer 'svg'.
 */

import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState, type JSX, type ReactNode, type RefObject } from 'react'
import { useShallow } from 'zustand/react/shallow'
import type { MachineStoreHook, ToySpec } from '../contracts/machine'
import {
  dimmedParts,
  type Ghost,
  type Highlight,
  type PartId,
  type PathHop,
  type StageReport,
  type StageViewProps,
} from '../contracts/stage'
import {
  LETTERS,
  REFLECTOR_PERMS,
  ROTORS,
  ROTOR_PERMS,
  encodeLetter,
  fromPairs,
  letterToIndex,
  mod,
  slotNames,
  type Letter,
  type MachineConfig,
  type MachineState,
  type RotorSlot,
} from '../engine'
import { SYM_FOR_PART, type Sym } from '../lib/symbols'
import { toyPress, toySlots } from '../lib/toy'
import { usePressView } from '../machine-ui/hooks'
import { useMachine, useMachineApi } from '../state/activeMachine'
import { useMachineStore } from '../state/machineStore'
import { useStageStore } from '../state/stageStore'
import { useToyStore } from '../state/toyStore'
import {
  drawnPoints,
  hopPoints,
  makeCircuitLayout,
  pathPointCount,
  polyline,
  rowY,
  signalPath,
  type CircuitLayout,
  type Column,
  type Point,
} from './layout'

// ---------------------------------------------------------------------------
// What to draw (pure)
// ---------------------------------------------------------------------------

interface RotorDraw {
  readonly slot: RotorSlot
  readonly name: string
  /** Window shown, as an index. */
  readonly window: number
  /** Ring setting index (A/01 = 0); null for a toy (no ring). */
  readonly ring: number | null
  /** Core offset (window − ring). */
  readonly offset: number
  /** Fixed-frame forward map at the current offset: contact k on the right face → map[k] on the left. */
  readonly map: readonly number[]
  /** Rows of the notch mark(s) on the ring band. */
  readonly notchRows: readonly number[]
  /** Row of the stepping pawl; null for the Greek rotor, which never steps. */
  readonly pawlRow: number | null
}

export interface CircuitScene {
  readonly n: number
  readonly slots: readonly RotorSlot[]
  readonly etw: boolean
  readonly toy: boolean
  readonly reflectorName: string
  readonly rotors: readonly RotorDraw[]
  readonly reflector: readonly number[]
  readonly plugs: readonly number[]
}

/** The pawl reads the notch 8 letters from the window (engine/wiring.ts: notch = turnover + 8). */
const PAWL_ROW = 8

export function machineScene(config: MachineConfig, windows: string): CircuitScene {
  const slots = slotNames(config.rotors.length)
  const rotors = config.rotors.map((name, i): RotorDraw => {
    const window = letterToIndex(windows[i] ?? config.positions[i]!)
    const ring = letterToIndex(config.rings[i]!)
    const offset = mod(window - ring)
    const w = ROTOR_PERMS[name].forward
    const greek = slots[i] === 'greek'
    return {
      slot: slots[i]!,
      name,
      window,
      ring,
      offset,
      map: LETTERS.map((_, k) => mod(w[mod(k + offset)]! - offset)),
      notchRows: greek ? [] : ROTORS[name].notches.split('').map((l) => mod(letterToIndex(l) - window)),
      pawlRow: greek ? null : PAWL_ROW,
    }
  })
  return {
    n: 26,
    slots,
    etw: true,
    toy: false,
    reflectorName: `UKW-${config.reflector}`,
    rotors,
    reflector: REFLECTOR_PERMS[config.reflector],
    plugs: fromPairs(config.plugboard),
  }
}

export function toyScene(spec: ToySpec, windows: string): CircuitScene {
  const { n } = spec
  const slots = toySlots(spec.rotors.length)
  const rotors = spec.rotors.map((w, i): RotorDraw => {
    const shown = windows.charCodeAt(i) - 65
    const window = shown >= 0 && shown < n ? shown : spec.positions[i]!
    return {
      slot: slots[i]!,
      name: `Rotor ${i + 1}`,
      window,
      ring: null,
      offset: window,
      map: Array.from({ length: n }, (_, k) => mod(w[mod(k + window, n)]! - window, n)),
      notchRows: [mod(spec.notches[i]! - window, n)],
      pawlRow: 0,
    }
  })
  return { n, slots, etw: false, toy: true, reflectorName: 'Reflector', rotors, reflector: spec.reflector, plugs: spec.plugs }
}

/** The path the ghost's key takes at the current positions, without stepping (the reference). */
export function referenceHops(
  ghost: Ghost | null,
  o: { toy: boolean; machine: MachineState; spec: ToySpec },
): readonly PathHop[] | null {
  const key = ghost?.hops[0]?.input
  if (!key) return null
  try {
    return o.toy ? toyPress({ ...o.spec, stepping: false }, key).hops : encodeLetter(o.machine, key).trace
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// Drawing
// ---------------------------------------------------------------------------

const DIM_OPACITY = 0.18
const TONE: Readonly<Record<Highlight['tone'], string>> = {
  hint: 'var(--sym-signal)',
  error: 'var(--sym-ghost)',
  ok: 'var(--sym-S)',
}

interface Box {
  readonly x: number
  readonly y: number
  readonly w: number
  readonly h: number
}

function Part(p: { part: PartId; dimmed: boolean; reducedMotion: boolean; children: ReactNode }): JSX.Element {
  return (
    <g
      data-part={p.part}
      data-dimmed={p.dimmed ? 'true' : 'false'}
      opacity={p.dimmed ? DIM_OPACITY : 1}
      style={p.reducedMotion ? undefined : { transition: 'opacity 250ms ease' }}
    >
      {p.children}
    </g>
  )
}

const symColor = (part: PartId): string => {
  const s: Sym | undefined = SYM_FOR_PART[part]
  return s ? `var(--sym-${s})` : 'currentColor'
}

/**
 * The alphabet-ring band runs down the LEFT side of each rotor (outside it when the layers are
 * exploded), with its notch mark(s) on the band's left edge. Pawl X sits in the gap to the RIGHT of
 * rotor X, against rotor X's ratchet and the notch ring of its right-hand neighbour: the middle pawl
 * drops into the right rotor's notch, the left pawl into the middle rotor's (the double step), and
 * the right pawl, with no ring to its right, always engages.
 */
const bandXOf = (l: CircuitLayout, c: Column): number => (l.ringLayer ? c.x0 - 14 : c.x0 + 12)
const pawlXOf = (c: Column): number => c.x1 + 4

interface PartsProps {
  readonly layout: CircuitLayout
  readonly scene: CircuitScene
  readonly labels: 'names' | 'symbols' | 'off'
  readonly lid: 'closed' | 'open' | 'cutaway'
  readonly showPlugboard: boolean
  /** Dimmed part ids joined with ',' (a string keeps the memo cheap). */
  readonly dimmedKey: string
  readonly reducedMotion: boolean
  readonly keyIndex: number
  readonly lampIndex: number
  readonly interactive: boolean
  readonly onKey: (letter: Letter) => void
  /**
   * 'back': every part the signal passes through, drawn under the path; 'front': the keys and lamps,
   * drawn over the path's ends so the path never strikes through their letters.
   */
  readonly layer: 'back' | 'front'
}

/** Every part (one layer of them); re-renders only when the machine or the directive changes. */
const Parts = memo(function Parts(p: PartsProps): JSX.Element {
  const { layout: l, scene } = p
  const dimmed = new Set(p.dimmedKey ? p.dimmedKey.split(',') : [])
  const rows = Array.from({ length: l.n }, (_, i) => i)
  const bottom = rowY(l, l.n - 1) + l.pitch / 2
  const small = l.n > 8
  const font = l.fonts.letter
  const part = (id: PartId, children: ReactNode) => (
    <Part key={id} part={id} dimmed={dimmed.has(id)} reducedMotion={p.reducedMotion}>
      {children}
    </Part>
  )
  const label = (c: Column, name: string, sym: Sym | null) =>
    p.labels === 'off' ? null : (
      <text
        x={(c.x0 + c.x1) / 2}
        y={14}
        textAnchor="middle"
        fontSize={p.labels === 'symbols' && sym ? l.fonts.symbol : l.fonts.label}
        fontWeight={p.labels === 'symbols' && sym ? 700 : 400}
        fill={p.labels === 'symbols' && sym ? `var(--sym-${sym})` : 'currentColor'}
      >
        {p.labels === 'symbols' && sym ? sym : name}
      </text>
    )
  const contacts = (x: number, color: string) =>
    rows.map((i) => <circle key={i} cx={x} cy={rowY(l, i)} r={small ? 1.6 : 3} fill={color} />)
  const frame = (c: Column, color: string) => (
    <rect x={c.x0} y={l.top} width={c.x1 - c.x0} height={bottom - l.top} rx={4} fill="none" stroke={color} strokeWidth={1.2} />
  )

  const reflector = l.columns.reflector!
  const ukw = part(
    'reflector',
    <>
      {label(reflector, scene.reflectorName, 'U')}
      {frame(reflector, symColor('reflector'))}
      {rows
        .filter((a) => scene.reflector[a]! > a)
        .map((a) => {
          const b = scene.reflector[a]!
          const pts = hopPoints(l, {
            kind: 'reflector',
            stage: 'reflector',
            input: LETTERS[a]!,
            output: LETTERS[b]!,
            inputIndex: a,
            outputIndex: b,
          })
          return pts ? (
            <polyline key={a} points={polyline(pts)} fill="none" stroke={symColor('reflector')} strokeOpacity={0.35} strokeWidth={1} />
          ) : null
        })}
      {contacts(reflector.x1, symColor('reflector'))}
    </>,
  )

  const rotors = scene.rotors.map((r) => {
    const c = l.columns[r.slot]!
    const color = symColor(`rotor-${r.slot}`)
    const cx = (c.x0 + c.x1) / 2
    const bandX = bandXOf(l, c)
    const pawlX = pawlXOf(c)
    const coreY = rowY(l, mod(-r.offset, l.n))
    return (
      <g key={r.slot} data-slot={r.slot}>
        {part(
          `rotor-${r.slot}`,
          <>
            {label(c, r.name, SYM_FOR_PART[`rotor-${r.slot}`] ?? null)}
            {frame(c, color)}
          </>,
        )}
        {part(
          `core-${r.slot}`,
          <>
            {rows.map((k) => (
              <line
                key={k}
                x1={c.x1}
                y1={rowY(l, k)}
                x2={c.x0}
                y2={rowY(l, r.map[k]!)}
                stroke={color}
                strokeOpacity={small ? 0.22 : 0.4}
                strokeWidth={1}
              />
            ))}
            {contacts(c.x0, color)}
            {contacts(c.x1, color)}
            <path d={`M ${c.x1 - 3} ${coreY - 4} L ${c.x1 - 10} ${coreY} L ${c.x1 - 3} ${coreY + 4} Z`} fill={color}>
              <title>core contact A</title>
            </path>
          </>,
        )}
        {part(
          `ring-${r.slot}`,
          <>
            {/* The window shows the alphabet ring's letter. */}
            <rect x={cx - 13} y={22} width={26} height={26} rx={3} fill="#f5f5f4" stroke={color} strokeWidth={1.5} />
            <text x={cx} y={41} textAnchor="middle" fontSize={l.fonts.window} fontWeight={700} fill="#0c0a09">
              {LETTERS[r.window]}
            </text>
            {r.ring !== null ? (
              <text x={cx} y={66} textAnchor="middle" fontSize={l.fonts.ring} fill="currentColor">
                ring {String(r.ring + 1).padStart(2, '0')}
              </text>
            ) : null}
            <rect x={bandX - 6} y={l.top} width={12} height={bottom - l.top} rx={2} fill="#1c1917" stroke={color} strokeOpacity={0.6} />
            {rows.map((k) => (
              <text
                key={k}
                x={bandX}
                y={rowY(l, k) + font / 3}
                textAnchor="middle"
                fontSize={font}
                data-band={r.slot}
                fill={k === 0 ? '#fafaf9' : 'currentColor'}
                fontWeight={k === 0 ? 700 : 400}
              >
                {LETTERS[mod(k + r.window, l.n)]}
              </text>
            ))}
          </>,
        )}
        {r.pawlRow !== null
          ? part(
              `notch-${r.slot}`,
              r.notchRows.map((row) => (
                <rect
                  key={row}
                  x={bandX - 10}
                  y={rowY(l, row) - l.pitch * 0.35}
                  width={5}
                  height={l.pitch * 0.7}
                  fill="var(--sym-signal)"
                />
              )),
            )
          : null}
        {r.pawlRow !== null
          ? part(
              `pawl-${r.slot}`,
              <path
                d={`M ${pawlX} ${rowY(l, r.pawlRow) - 5} L ${pawlX + 11} ${rowY(l, r.pawlRow)} L ${pawlX} ${rowY(l, r.pawlRow) + 5} Z`}
                fill={color}
                stroke="#fafaf9"
                strokeWidth={0.6}
              >
                <title>pawl</title>
              </path>,
            )
          : null}
      </g>
    )
  })

  const etwColumn = l.columns.etw
  const etw = etwColumn
    ? part(
        'etw',
        <>
          {label(etwColumn, 'ETW', 'H')}
          {frame(etwColumn, symColor('etw'))}
          {rows.map((k) => (
            <line
              key={k}
              x1={etwColumn.x0}
              y1={rowY(l, k)}
              x2={etwColumn.x1}
              y2={rowY(l, k)}
              stroke={symColor('etw')}
              strokeOpacity={0.35}
            />
          ))}
          {contacts(etwColumn.x0, symColor('etw'))}
          {contacts(etwColumn.x1, symColor('etw'))}
        </>,
      )
    : null

  const plug = l.columns.plugboard!
  const plugboard = part(
    'plugboard',
    p.showPlugboard ? (
      <>
        {label(plug, scene.toy ? 'Plugs' : 'Plugboard', 'S')}
        {frame(plug, symColor('plugboard'))}
        {rows.map((k) => {
          const to = scene.plugs[k] ?? k
          return (
            <line
              key={k}
              x1={plug.x1}
              y1={rowY(l, k)}
              x2={plug.x0}
              y2={rowY(l, to)}
              stroke={symColor('plugboard')}
              strokeOpacity={to === k ? 0.25 : 0.9}
              strokeWidth={to === k ? 1 : 1.6}
            />
          )
        })}
        {contacts(plug.x0, symColor('plugboard'))}
        {contacts(plug.x1, symColor('plugboard'))}
      </>
    ) : null,
  )

  const keys = l.columns.keyboard!
  const lamps = l.columns.lampboard!
  const size = small ? 15 : 24
  const keyboard = part(
    'keyboard',
    <>
      {label(keys, 'Keys', null)}
      {rows.map((k) => {
        const pressed = k === p.keyIndex
        const x = (keys.x0 + keys.x1) / 2
        return (
          <g
            key={k}
            data-key={LETTERS[k]}
            onClick={p.interactive ? () => p.onKey(LETTERS[k]!) : undefined}
            style={p.interactive ? { cursor: 'pointer' } : undefined}
          >
            <rect
              x={x - size / 2}
              y={rowY(l, k) - size / 2}
              width={size}
              height={size}
              rx={2}
              fill="#292524"
              stroke={pressed ? 'var(--sym-signal)' : '#57534e'}
              strokeWidth={pressed ? 2 : 1}
            />
            <text x={x} y={rowY(l, k) + font / 3} textAnchor="middle" fontSize={font} fill="currentColor">
              {LETTERS[k]}
            </text>
          </g>
        )
      })}
    </>,
  )
  const lampboard = part(
    'lampboard',
    <>
      {label(lamps, 'Lamps', null)}
      {rows.map((k) => {
        const lit = k === p.lampIndex
        const x = (lamps.x0 + lamps.x1) / 2
        return (
          <g key={k} data-lamp={LETTERS[k]} data-lit={lit ? 'true' : 'false'}>
            <circle
              cx={x}
              cy={rowY(l, k)}
              r={size / 2}
              fill={lit ? 'var(--sym-signal)' : '#1c1917'}
              stroke={lit ? '#fef3c7' : '#57534e'}
            />
            <text
              x={x}
              y={rowY(l, k) + font / 3}
              textAnchor="middle"
              fontSize={font}
              fill={lit ? '#0c0a09' : 'currentColor'}
              fontWeight={lit ? 700 : 400}
            >
              {LETTERS[k]}
            </text>
          </g>
        )
      })}
    </>,
  )

  const battery = part(
    'battery',
    <>
      <rect x={keys.x0} y={24} width={lamps.x1 - keys.x0} height={18} rx={3} fill="none" stroke="currentColor" />
      <text x={(keys.x0 + lamps.x1) / 2} y={37} textAnchor="middle" fontSize={l.fonts.label} fill="currentColor">
        + −
      </text>
    </>,
  )

  const first = l.columns[l.slots[0]!]!
  const last = l.columns[l.slots[l.slots.length - 1]!]!
  const lid = part(
    'lid',
    <line
      x1={first.x0 - 6}
      y1={3}
      x2={last.x1 + 6}
      y2={3}
      stroke="currentColor"
      strokeWidth={3}
      strokeDasharray={p.lid === 'closed' ? undefined : p.lid === 'open' ? '10 6' : '2 6'}
    >
      <title>lid ({p.lid})</title>
    </line>,
  )

  return p.layer === 'front' ? (
    <g data-layer="front">
      {keyboard}
      {lampboard}
    </g>
  ) : (
    <g data-layer="back">
      {lid}
      {ukw}
      {rotors}
      {etw}
      {plugboard}
      {battery}
    </g>
  )
})

/** Outline boxes of each part, for highlights. */
function partBoxes(l: CircuitLayout, scene: CircuitScene): Partial<Record<PartId, Box>> {
  const bottom = rowY(l, l.n - 1) + l.pitch / 2
  const column = (c: Column | undefined): Box | undefined =>
    c ? { x: c.x0 - 5, y: l.top - 5, w: c.x1 - c.x0 + 10, h: bottom - l.top + 10 } : undefined
  const boxes: Partial<Record<PartId, Box>> = {
    reflector: column(l.columns.reflector),
    etw: column(l.columns.etw),
    plugboard: column(l.columns.plugboard),
    keyboard: column(l.columns.keyboard),
    lampboard: column(l.columns.lampboard),
  }
  const keys = l.columns.keyboard!
  const lamps = l.columns.lampboard!
  boxes.battery = { x: keys.x0 - 4, y: 20, w: lamps.x1 - keys.x0 + 8, h: 26 }
  const first = l.columns[l.slots[0]!]!
  const last = l.columns[l.slots[l.slots.length - 1]!]!
  boxes.lid = { x: first.x0 - 10, y: 0, w: last.x1 - first.x0 + 20, h: 7 }
  for (const r of scene.rotors) {
    const c = l.columns[r.slot]!
    const bandX = bandXOf(l, c)
    const pawlX = pawlXOf(c)
    boxes[`rotor-${r.slot}`] = { x: c.x0 - 5, y: 18, w: c.x1 - c.x0 + 10, h: bottom - 13 }
    boxes[`ring-${r.slot}`] = { x: bandX - 9, y: l.top - 4, w: 18, h: bottom - l.top + 8 }
    boxes[`core-${r.slot}`] = { x: c.x0 + 17, y: l.top - 4, w: c.x1 - c.x0 - 14, h: bottom - l.top + 8 }
    if (r.pawlRow !== null && r.notchRows.length) {
      const ys = r.notchRows.map((row) => rowY(l, row))
      const top = Math.min(...ys)
      boxes[`notch-${r.slot}`] = { x: bandX - 13, y: top - l.pitch / 2 - 2, w: 11, h: Math.max(...ys) - top + l.pitch + 4 }
      boxes[`pawl-${r.slot}`] = { x: pawlX - 3, y: rowY(l, r.pawlRow) - 8, w: 17, h: 16 }
    }
  }
  return boxes
}

/** A static polyline through a whole hop list (with the key and lamp leads when they can be placed). */
function wholePath(l: CircuitLayout, hops: readonly PathHop[]): Point[] | null {
  const whole = signalPath(l, hops)
  if (whole) return drawnPoints(whole, Infinity, true)
  const pts = hops.flatMap((h) => hopPoints(l, h) ?? [])
  return pts.length > 1 ? pts : null
}

// ---------------------------------------------------------------------------
// The view
// ---------------------------------------------------------------------------

function pressOn(api: MachineStoreHook, toy: boolean, letter: Letter): void {
  // The toy has no locks of its own: it respects the default store's keyboard lock.
  if (toy) {
    if (useMachineStore.getState().locks.keyboard) return
    const { spec, press } = useToyStore.getState()
    if (letterToIndex(letter) < spec.n) press(letter)
    return
  }
  const s = api.getState()
  if (!s.locks.keyboard) s.pressKey(letter)
}

export default function Stage2D({ directive, reducedMotion, onReport }: StageViewProps): JSX.Element {
  const api = useMachineApi()
  const toy = directive.source === 'toy'
  const view = usePressView(directive.source, api, 'continuous')
  const machine = useMachine((s) => s.machine)
  const spec = useToyStore((s) => s.spec)
  const { highlight, ghost } = useStageStore(useShallow((s) => ({ highlight: s.highlight, ghost: s.ghost })))
  const model = machine.config.model

  const scene = useMemo(
    () => (toy ? toyScene(spec, view.windows) : machineScene(machine.config, view.windows)),
    [toy, spec, machine.config, view.windows],
  )
  const slotKey = scene.slots.join()
  const layout = useMemo(
    () => makeCircuitLayout({ n: scene.n, slots: slotKey.split(',') as RotorSlot[], etw: scene.etw, ringLayer: directive.ringLayer }),
    [scene.n, slotKey, scene.etw, directive.ringLayer],
  )
  // dimmedParts(focus, model) takes a ModelName, and a toy has none: every view (2D, 3D, the stub)
  // reports the machine model's list, even for source 'toy', so 2D and 3D always agree (PLAN §3.3).
  const dimmed = useMemo(() => dimmedParts(directive.focus, model), [directive.focus, model])
  const boxes = useMemo(() => partBoxes(layout, scene), [layout, scene])

  // The signal path up to t.
  const path = useMemo(() => signalPath(layout, view.hops), [layout, view.hops])
  const conceal = view.lampsHidden
  const traceOn = directive.trace !== 'off' && !conceal && view.hasPress
  // 'static' draws the whole path at once, but only after the stepping phase: while the windows
  // still show stepping.before, the new press's path would not match the drawn wiring.
  const staticTrace = directive.trace === 'static'
  const hopsDrawn = !traceOn ? 0 : staticTrace ? (view.t >= 1 ? view.hops.length : 0) : Math.max(0, view.hop + 1)
  const points = traceOn && path && (!staticTrace || view.t >= 1) ? drawnPoints(path, view.t, staticTrace) : []
  const litLamp = view.lit && !conceal ? view.lamp : null

  // The ghost (the learner's path) against the reference path.
  const reference = useMemo(() => referenceHops(ghost, { toy, machine, spec }), [ghost, toy, machine, spec])
  const ghostPath = useMemo(() => (ghost ? wholePath(layout, ghost.hops) : null), [layout, ghost])
  const referencePath = useMemo(() => (reference ? wholePath(layout, reference) : null), [layout, reference])
  const divergeHop = ghost ? (ghost.hops[ghost.divergeAt] ?? null) : null
  const divergeAt = divergeHop ? (hopPoints(layout, divergeHop)?.[0] ?? null) : null

  const report: StageReport = {
    renderer: 'svg',
    focus: directive.focus,
    dimmed,
    highlighted: highlight.map((h) => h.part),
    litLamp,
    windows: view.windows,
    hop: view.hop,
    pathPoints: pathPointCount(hopsDrawn),
    ghost: ghost !== null,
  }
  const reportKey = JSON.stringify(report)
  useEffect(() => {
    onReport(JSON.parse(reportKey) as StageReport)
  }, [reportKey, onReport])

  const onKey = useMemo(() => (letter: Letter) => pressOn(api, toy, letter), [api, toy])
  const keyIndex = view.key ? letterToIndex(view.key) : -1
  const head = directive.trace === 'animate' && points.length > 1 && !view.lit ? points[points.length - 1]! : null
  const parts: Omit<PartsProps, 'layer'> = {
    layout,
    scene,
    labels: directive.labels,
    lid: directive.lid,
    showPlugboard: directive.plugboard,
    dimmedKey: dimmed.join(','),
    reducedMotion,
    keyIndex: keyIndex < scene.n ? keyIndex : -1,
    lampIndex: litLamp ? letterToIndex(litLamp) : -1,
    interactive: directive.interactive,
    onKey,
  }

  // Narrow containers scroll the drawing sideways rather than shrink its text below MIN_TEXT_PX.
  const scroller = useRef<HTMLDivElement>(null)
  const scrollable = useScrollable(scroller)
  const focusKey = `${directive.focus}|${layout.width}|${scrollable}`
  useLayoutEffect(() => {
    const el = scroller.current
    if (!el || !scrollable) return
    const center = focusCenter(boxes, new Set(dimmed))
    if (center === null) return
    const scale = el.scrollWidth / layout.width
    el.scrollLeft = Math.max(0, center * scale - el.clientWidth / 2)
    // Only when the focus or the layout changes (focusKey), never on a press.
  }, [focusKey])

  // A rollback's divergence marker, else the highlighted parts, must be seen: when they change, bring
  // them into view (smoothly unless motion is reduced). Declared after the focus scroll, so on a
  // fresh scene it wins.
  const attention = attentionRange(boxes, highlight.map((h) => h.part), divergeAt)
  const attentionKey = attention ? `${attention.lo}|${attention.hi}|${layout.width}|${scrollable}` : ''
  useLayoutEffect(() => {
    const el = scroller.current
    if (!el || !scrollable || !attention) return
    const scale = el.scrollWidth / layout.width
    const left = scrollToShow(attention.lo * scale, attention.hi * scale, el.scrollLeft, el.clientWidth)
    if (left === null) return
    if (typeof el.scrollTo === 'function') el.scrollTo({ left, behavior: reducedMotion ? 'auto' : 'smooth' })
    else el.scrollLeft = left
    // Only when what needs attention changes (attentionKey), never on a press.
  }, [attentionKey])

  return (
    <div
      ref={scroller}
      data-testid="stage2d-scroll"
      data-scrollable={scrollable ? 'true' : 'false'}
      className="w-full overflow-x-auto overscroll-x-contain"
      tabIndex={scrollable ? 0 : undefined}
      role={scrollable ? 'region' : undefined}
      aria-label={scrollable ? 'Machine diagram (scrolls sideways)' : undefined}
    >
      <svg
        data-testid="stage2d"
        data-source={directive.source}
        viewBox={`0 0 ${layout.width} ${layout.height}`}
        preserveAspectRatio="xMidYMid meet"
        aria-hidden="true"
        style={{ minWidth: layout.minWidth, maxWidth: stageMaxWidth(layout) }}
        className="mx-auto block h-auto w-full font-mono text-stone-300 select-none"
      >
        <Parts {...parts} layer="back" />
        {referencePath ? (
          <polyline
            data-testid="stage2d-reference"
            points={polyline(referencePath)}
            fill="none"
            stroke="var(--sym-reference)"
            strokeWidth={2.5}
            strokeLinejoin="round"
            opacity={0.9}
          />
        ) : null}
        {ghostPath ? (
          <polyline
            data-testid="stage2d-ghost"
            points={polyline(ghostPath)}
            fill="none"
            stroke="var(--sym-ghost)"
            strokeWidth={2.5}
            strokeDasharray="7 5"
            strokeLinejoin="round"
          />
        ) : null}
        {divergeAt ? (
          <circle
            data-testid="stage2d-diverge"
            cx={divergeAt.x}
            cy={divergeAt.y}
            r={7}
            fill="none"
            stroke="var(--sym-ghost)"
            strokeWidth={2}
          />
        ) : null}
        {points.length > 1 ? (
          <polyline
            data-testid="stage2d-path"
            data-points={pathPointCount(hopsDrawn)}
            points={polyline(points)}
            fill="none"
            stroke="var(--sym-signal)"
            strokeWidth={2.8}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ) : null}
        {head ? <circle data-testid="stage2d-head" cx={head.x} cy={head.y} r={4.5} fill="var(--sym-signal)" /> : null}
        <Parts {...parts} layer="front" />
        {highlight.map((h, i) => {
          const b = boxes[h.part]
          return b ? (
            <rect
              key={`${h.part}-${i}`}
              data-highlight={h.part}
              data-tone={h.tone}
              x={b.x}
              y={b.y}
              width={b.w}
              height={b.h}
              rx={5}
              fill="none"
              stroke={TONE[h.tone]}
              strokeWidth={2.5}
              className={reducedMotion ? undefined : 'animate-pulse'}
            />
          ) : null
        })}
      </svg>
    </div>
  )
}

/** The share of the viewport height the drawing may take, so the whole stage stays in view. */
export const STAGE_MAX_VH = 70

/**
 * The drawing's width cap: at most 1.25× its natural size, and no taller than STAGE_MAX_VH of the
 * viewport (width = height × aspect). The minimum width (smallest text ≥ MIN_TEXT_PX) still wins
 * over this cap in CSS, so a short window scrolls the page rather than shrink the text.
 */
export function stageMaxWidth(l: CircuitLayout): string {
  const aspect = (l.width / l.height).toFixed(4)
  return `min(${Math.round(l.width * 1.25)}px, calc(${STAGE_MAX_VH}vh * ${aspect}))`
}

/** Whether the element scrolls sideways (its content is wider than its box). */
function useScrollable(ref: RefObject<HTMLElement | null>): boolean {
  const [scrollable, setScrollable] = useState(false)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => setScrollable(el.scrollWidth > el.clientWidth + 1)
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [ref])
  return scrollable
}

/**
 * The x range (viewBox units) that needs attention: the ghost's divergence marker when there is one,
 * else the union of the highlighted parts' boxes; null when there is neither.
 */
export function attentionRange(
  boxes: Partial<Record<PartId, Box>>,
  highlighted: readonly PartId[],
  marker: Point | null,
): { lo: number; hi: number } | null {
  if (marker) return { lo: marker.x - 12, hi: marker.x + 12 }
  let lo = Infinity
  let hi = -Infinity
  for (const part of highlighted) {
    const b = boxes[part]
    if (!b) continue
    lo = Math.min(lo, b.x)
    hi = Math.max(hi, b.x + b.w)
  }
  return lo === Infinity ? null : { lo, hi }
}

/**
 * The scrollLeft that shows [lo, hi] (CSS px in the scroller's content), or null when it is
 * already fully in view. A range is centred; one wider than the view is centred too.
 */
export function scrollToShow(lo: number, hi: number, scrollLeft: number, clientWidth: number): number | null {
  if (lo >= scrollLeft && hi <= scrollLeft + clientWidth) return null
  return Math.max(0, (lo + hi) / 2 - clientWidth / 2)
}

/** The x centre of the focused (undimmed) parts' outline boxes, or null when nothing is focused. */
export function focusCenter(boxes: Partial<Record<PartId, Box>>, dimmed: ReadonlySet<PartId>): number | null {
  let lo = Infinity
  let hi = -Infinity
  for (const [part, box] of Object.entries(boxes) as [PartId, Box | undefined][]) {
    if (!box || dimmed.has(part)) continue
    lo = Math.min(lo, box.x)
    hi = Math.max(hi, box.x + box.w)
  }
  return lo === Infinity ? null : (lo + hi) / 2
}
