import { describe, expect, it } from 'vitest'
import type { PathHop } from '../../contracts/stage'
import {
  REFLECTOR_PERMS,
  createMachine,
  encodeLetter,
  pressKey,
  slotNames,
  type MachineConfigInput,
  type MachineState,
} from '../../engine'
import { ghostFromOutputs } from '../../lesson/kinds/helpers'
import { createRng, int, randomConfig } from '../../lib/rng'
import { randomToy, toyPress, toySlots } from '../../lib/toy'
import { demoGhost, DEMO_CONFIGS } from '../../pages/StageLabPage'
import { referenceHops as referenceHops2d } from '../../stage2d'
import { pathPointCount as pathPointCount2d } from '../../stage2d/layout'
import {
  AXIS_Y,
  AXIS_Z,
  contactPoint,
  makeLayout,
  pathPoints,
  reflectorWidth,
  reflectorX,
  socketPosition,
  type Layout,
  type Vec3,
} from '../layout'
import { buildCurve, buildTube, dashTube, drawSegments, segmentsFor } from './curve'
import { divergeAnchor, ghostHops, referenceHops } from './ghost'
import { cablePath, dist, harnessPath, reflectorArc, reflectorOuterX, signalRoute, wirePairs } from './route'
import { HEAD_MIN_PX, HEAD_RADIUS, pxPerUnit } from './Head'
import { headTag } from './tag'
import { drawnFraction, headVisible, hopsDrawn, pathPointCount, type TraceClock } from './timing'

const close = (a: Vec3, b: Vec3, eps = 1e-9) => expect(dist(a, b)).toBeLessThan(eps)
const layoutFor = (state: MachineState): Layout =>
  makeLayout({ n: 26, slots: slotNames(state.positions.length), toy: false })

const I: MachineConfigInput = DEMO_CONFIGS.I
const M4: MachineConfigInput = DEMO_CONFIGS.M4

/** Presses on a machine: [layout, hops] for each. */
function machinePresses(config: MachineConfigInput, count: number, seed: number): [Layout, readonly PathHop[]][] {
  const r = createRng(seed)
  let state = createMachine(config)
  const l = layoutFor(state)
  const out: [Layout, readonly PathHop[]][] = []
  for (let i = 0; i < count; i++) {
    const press = pressKey(state, String.fromCharCode(65 + int(r, 26)))
    state = press.state
    out.push([l, press.trace])
  }
  return out
}

function toyPresses(n: 6 | 8, rotors: 1 | 2 | 3, count: number, seed: number): [Layout, readonly PathHop[]][] {
  const r = createRng(seed)
  let spec = randomToy(r, n, rotors, { plugs: 1 })
  const l = makeLayout({ n, slots: toySlots(rotors), toy: true })
  const out: [Layout, readonly PathHop[]][] = []
  for (let i = 0; i < count; i++) {
    const press = toyPress(spec, String.fromCharCode(65 + int(r, n)) as 'A')
    spec = press.spec
    out.push([l, press.hops])
  }
  return out
}

const CASES: [string, number, [Layout, readonly PathHop[]][]][] = [
  ['Enigma I (11 hops)', 11, machinePresses(I, 40, 1)],
  ['random M3 (11 hops)', 11, machinePresses(randomConfig(createRng(2), { model: 'M3' }), 40, 2)],
  ['M4 (13 hops)', 13, machinePresses(M4, 40, 3)],
  ['toy n = 6, 2 rotors (7 hops)', 7, toyPresses(6, 2, 20, 4)],
  ['toy n = 8, 3 rotors (9 hops)', 9, toyPresses(8, 3, 20, 5)],
  ['toy n = 6, 1 rotor (5 hops)', 5, toyPresses(6, 1, 20, 6)],
]

describe('signalRoute', () => {
  it.each(CASES)('%s: 2 + 2·hops anchors, exactly pathPoints(), and a continuous path', (_name, hopCount, presses) => {
    for (const [l, hops] of presses) {
      expect(hops).toHaveLength(hopCount)
      const route = signalRoute(hops, l)
      const expected = pathPoints(hops, l)
      expect(route.anchors).toHaveLength(2 + 2 * hops.length)
      route.anchors.forEach((a, i) => close(route.points[a]!, expected[i]!))
      // anchors in order, waypoints finite, no repeated point
      for (let i = 1; i < route.anchors.length; i++) expect(route.anchors[i]!).toBeGreaterThan(route.anchors[i - 1]!)
      for (const p of route.points) expect([p.x, p.y, p.z].every(Number.isFinite)).toBe(true)
      for (let i = 1; i < route.points.length; i++)
        expect(dist(route.points[i]!, route.points[i - 1]!)).toBeGreaterThan(1e-6)
      // continuity: hop k's exit letter is hop k+1's entry letter, and where both sit on the ring
      // parts they face each other at the same fixed contact (same y, z)
      for (let k = 0; k + 1 < hops.length; k++) {
        const a = hops[k]!
        const b = hops[k + 1]!
        expect(b.inputIndex, `${a.stage} → ${b.stage}`).toBe(a.outputIndex)
        if (a.kind !== 'plugboard' && b.kind !== 'plugboard') {
          const exit = expected[2 + 2 * k]!
          const entry = expected[3 + 2 * k]!
          expect(Math.hypot(exit.y - entry.y, exit.z - entry.z), `${a.stage} → ${b.stage}`).toBeLessThan(1e-9)
        }
      }
    }
  })

  it('runs the plugboard hops along the cable of a plugged pair, and crosses an unplugged socket', () => {
    const l = makeLayout({ n: 26, slots: ['left', 'middle', 'right'], toy: false })
    const state = createMachine(I) // AV BS CG
    const trace = encodeLetter(state, 'A').trace
    const route = signalRoute(trace, l)
    const between = route.points.slice(route.anchors[1]! + 1, route.anchors[2]!)
    const cable = cablePath(l, 0, 21) // A → V
    expect(between.length).toBe(cable.length)
    cable.slice(1, -1).forEach((p) => expect(between.some((q) => dist(p, q) < 1e-9)).toBe(true))
    // an unplugged letter (D) crosses its own socket: nothing between the two holes
    const d = signalRoute(encodeLetter(state, 'D').trace, l)
    expect(d.anchors[2]! - d.anchors[1]!).toBe(1)
  })

  it('runs the reflector hop through the disc and along that pair’s arc on the outer face', () => {
    const [l, hops] = machinePresses(I, 1, 9)[0]!
    const k = hops.findIndex((h) => h.kind === 'reflector')
    const route = signalRoute(hops, l)
    const inside = route.points.slice(route.anchors[1 + 2 * k]! + 1, route.anchors[2 + 2 * k]!)
    const arc = reflectorArc(l, hops[k]!.inputIndex, hops[k]!.outputIndex)
    expect(inside).toEqual(arc)
    expect(arc[0]!.x).toBeCloseTo(reflectorOuterX(l), 12)
    expect(reflectorOuterX(l)).toBeLessThan(reflectorX(l) - reflectorWidth(l) / 2)
  })

  it('is empty without hops', () => {
    expect(signalRoute([], makeLayout({ n: 26, slots: ['left', 'middle', 'right'], toy: false }))).toEqual({
      points: [],
      anchors: [],
    })
  })
})

describe('shapes', () => {
  const l = makeLayout({ n: 26, slots: ['left', 'middle', 'right'], toy: false })

  it('reflectorArc joins the two contacts (seen from the outer face) and stays inside the disc', () => {
    const pairs = wirePairs(REFLECTOR_PERMS.B)
    expect(pairs).toHaveLength(13)
    for (const [a, b] of pairs) {
      const arc = reflectorArc(l, a, b)
      const A = contactPoint(l, 'reflector', 'in', a, 0)
      const B = contactPoint(l, 'reflector', 'in', b, 0)
      expect(Math.hypot(arc[0]!.y - A.y, arc[0]!.z - A.z)).toBeLessThan(1e-9)
      expect(Math.hypot(arc.at(-1)!.y - B.y, arc.at(-1)!.z - B.z)).toBeLessThan(1e-9)
      for (const p of arc) expect(Math.hypot(p.y - AXIS_Y, p.z - AXIS_Z)).toBeLessThanOrEqual(2.9 + 1e-9)
    }
  })

  it('cablePath runs from plug a to plug b and hangs below them, in front of the panel', () => {
    const path = cablePath(l, 0, 21)
    const A = socketPosition(l, 0)
    const B = socketPosition(l, 21)
    expect(path[0]!.x).toBeCloseTo(A.x, 12)
    expect(path.at(-1)!.x).toBeCloseTo(B.x, 12)
    for (const p of path) expect(p.z).toBeGreaterThan(A.z)
    expect(Math.min(...path.map((p) => p.y))).toBeLessThan(Math.min(A.y, B.y))
  })

  it('harnessPath ends beside the entry contact, approaching along the axis', () => {
    const hole = contactPoint(l, 'plugboard', 'out', 4, 0)
    const face = contactPoint(l, 'etw', 'in', 4, 0)
    const h = harnessPath(hole, face)
    expect(h.at(-1)!.y).toBeCloseTo(face.y, 12)
    expect(h.at(-1)!.z).toBeCloseTo(face.z, 12)
    expect(h.at(-1)!.x).toBeGreaterThan(face.x)
  })

  it('wirePairs lists the n/2 pairs of an involution', () => {
    expect(wirePairs([1, 0, 3, 2, 5, 4])).toEqual([
      [0, 1],
      [2, 3],
      [4, 5],
    ])
    expect(wirePairs(Array.from({ length: 26 }, (_, i) => i))).toEqual([])
  })
})

describe('curve and tube', () => {
  it.each(CASES)('%s: the curve passes every path point, in order, without a jump', (_name, _hops, presses) => {
    for (const [l, hops] of presses.slice(0, 6)) {
      const c = buildCurve(signalRoute(hops, l))!
      const anchors = pathPoints(hops, l)
      expect(c.u).toHaveLength(anchors.length)
      expect(c.u[0]).toBe(0)
      expect(c.u.at(-1)).toBeCloseTo(1, 12)
      for (let i = 1; i < c.u.length; i++) expect(c.u[i]!).toBeGreaterThan(c.u[i - 1]!)
      anchors.forEach((a, i) => {
        const p = c.curve.getPointAt(c.u[i]!)
        expect(dist({ x: p.x, y: p.y, z: p.z }, a)).toBeLessThan(1e-6)
      })
      const samples = c.curve.getSpacedPoints(2000)
      const step = c.length / 2000
      for (let i = 1; i < samples.length; i++) expect(samples[i]!.distanceTo(samples[i - 1]!)).toBeLessThan(step * 1.5)
    }
  })

  it('draws the tube up to a fraction of its length, segment by segment', () => {
    const [l, hops] = machinePresses(I, 1, 12)[0]!
    const c = buildCurve(signalRoute(hops, l))!
    const tube = buildTube(c, 0.15)
    expect(tube.segments).toBeGreaterThan(100)
    expect(segmentsFor(tube, 0)).toBe(0)
    expect(segmentsFor(tube, 1)).toBe(tube.segments)
    expect(segmentsFor(tube, 0.5)).toBe(Math.ceil(tube.segments / 2))
    drawSegments(tube, 10)
    expect(tube.geometry.drawRange).toEqual({ start: 0, count: 10 * tube.radial * 6 })
    drawSegments(tube, tube.segments)
    expect(tube.geometry.drawRange.count).toBe(tube.geometry.index!.count)
    tube.geometry.dispose()
  })

  it('dashes a tube: every other run of segments', () => {
    const [l, hops] = machinePresses(I, 1, 13)[0]!
    const tube = buildTube(buildCurve(signalRoute(hops, l))!, 0.1, 6)
    const full = tube.geometry.index!.count
    dashTube(tube, 4)
    const kept = tube.geometry.index!.count
    expect(kept).toBeGreaterThan(full * 0.45)
    expect(kept).toBeLessThan(full * 0.55)
    tube.geometry.dispose()
  })
})

describe('timing (the 2D view’s rule)', () => {
  const clock = (o: Partial<TraceClock>): TraceClock => ({
    trace: 'animate',
    hasPress: true,
    conceal: false,
    t: 0,
    hops: 11,
    ...o,
  })

  it('pathPoints: 2 while nothing is drawn, then 2 + 2·(hops drawn), the live hop included', () => {
    expect(pathPointCount(hopsDrawn(clock({ t: 0 })))).toBe(2)
    expect(pathPointCount(hopsDrawn(clock({ t: 0.99 })))).toBe(2)
    for (let k = 0; k < 11; k++) {
      for (const t of [1 + k, 1 + k + 0.5, 1 + k + 0.999])
        expect(pathPointCount(hopsDrawn(clock({ t })))).toBe(2 + 2 * (k + 1))
    }
    expect(pathPointCount(hopsDrawn(clock({ t: 12 })))).toBe(24)
    expect(pathPointCount(hopsDrawn(clock({ t: 14, hops: 13 })))).toBe(28)
    // the same numbers as stage2d's pathPointCount
    for (let d = 0; d <= 13; d++) expect(pathPointCount(d)).toBe(pathPointCount2d(d))
  })

  it('draws nothing with trace off, without a press, or under lampsHidden; static shows all after stepping', () => {
    for (const o of [{ trace: 'off' as const }, { hasPress: false }, { conceal: true }]) {
      expect(hopsDrawn(clock({ ...o, t: 12 }))).toBe(0)
      expect(drawnFraction([0, 0.5, 1], clock({ ...o, t: 12 }))).toBe(0)
      expect(headVisible(clock({ ...o, t: 5 }))).toBe(false)
    }
    expect(hopsDrawn(clock({ trace: 'static', t: 0.5 }))).toBe(0)
    expect(hopsDrawn(clock({ trace: 'static', t: 1 }))).toBe(11)
    expect(drawnFraction([0, 0.5, 1], clock({ trace: 'static', t: 1 }))).toBe(1)
    expect(headVisible(clock({ trace: 'static', t: 5 }))).toBe(false)
  })

  it('grows piece k from anchor 2k to anchor 2k+2 while hop k is live; the head shows until the lamp', () => {
    const u = Array.from({ length: 24 }, (_, i) => i / 23)
    expect(drawnFraction(u, clock({ t: 0.5 }))).toBe(0)
    let prev = -1
    for (let k = 0; k < 11; k++) {
      expect(drawnFraction(u, clock({ t: 1 + k }))).toBeCloseTo(u[2 * k]!, 12)
      const mid = drawnFraction(u, clock({ t: 1.5 + k }))
      expect(mid).toBeCloseTo((u[2 * k]! + u[2 * k + 2]!) / 2, 12)
      expect(mid).toBeGreaterThan(prev)
      prev = mid
      expect(headVisible(clock({ t: 1.5 + k }))).toBe(true)
    }
    expect(drawnFraction(u, clock({ t: 11.999 }))).toBeLessThan(u[22]! + 1e-9)
    expect(drawnFraction(u, clock({ t: 12 }))).toBe(1)
    expect(headVisible(clock({ t: 12 }))).toBe(false)
    expect(headVisible(clock({ t: 0.5 }))).toBe(false)
  })
})

describe('ghost', () => {
  const l = makeLayout({ n: 26, slots: ['left', 'middle', 'right'], toy: false })

  it('the reference is the stage2d reference: the ghost key at the current positions, unstepped', () => {
    const machine = createMachine(I)
    const spec = randomToy(createRng(1), 6, 2)
    const ghost = demoGhost()
    for (const toy of [false, true]) {
      const toyGhost = { ...ghost, hops: ghost.hops.map((h) => ({ ...h, input: 'B' as const })) }
      const g = toy ? toyGhost : ghost
      expect(referenceHops(g, { toy, machine, spec })).toEqual(referenceHops2d(g, { toy, machine, spec }))
    }
    expect(referenceHops(null, { toy: false, machine, spec })).toBeNull()
    expect(referenceHops(ghost, { toy: false, machine, spec })).toEqual(encodeLetter(machine, 'A').trace)
  })

  it('places the ghost by its own letters: it meets the reference up to hop divergeAt, then leaves it', () => {
    const ghost = demoGhost() // divergeAt 4; its hop 4 happens to end on the right letter, hop 5 does not
    const reference = encodeLetter(createMachine(I), 'A').trace
    const g = pathPoints(ghostHops(ghost), l)
    const r = pathPoints(reference, l)
    const at = divergeAnchor(ghost)!
    expect(at).toBe(1 + 2 * 4)
    for (let i = 0; i <= at; i++) close(g[i]!, r[i]!)
    const leftBwd = 1 + 2 * 6 // entry of rotor-left-bwd: the ghost carries 'E', the reference 'J'
    expect(dist(g[leftBwd]!, r[leftBwd]!)).toBeGreaterThan(0.5)
    // Without re-placing, the core contacts the ghost copied from the reference would put its rotor
    // hops on the reference's wires.
    close(pathPoints(ghost.hops, l)[leftBwd]!, r[leftBwd]!)
  })

  it('works for a lesson ghost (ghostFromOutputs) and has no marker without a divergence', () => {
    const reference = encodeLetter(createMachine(I), 'Q').trace
    const outputs = reference.map((h, k) => (k < 6 ? h.output : 'Z'))
    const ghost = ghostFromOutputs(reference, outputs)
    const at = divergeAnchor(ghost)!
    expect(at).toBe(1 + 2 * 6)
    const g = pathPoints(ghostHops(ghost), l)
    const r = pathPoints(reference, l)
    for (let i = 0; i <= at; i++) close(g[i]!, r[i]!)
    expect(dist(g[at + 1]!, r[at + 1]!)).toBeGreaterThan(0.5)
    expect(
      divergeAnchor(
        ghostFromOutputs(
          reference,
          reference.map((h) => h.output),
        ),
      ),
    ).toBeNull()
  })
})

describe('headTag (count the transformations)', () => {
  it('names the part and its letters, and counts the letter changes; the entry wheel changes nothing', () => {
    // Enigma I demo (AV BS CG): A is plugged, so the way in changes the letter.
    const trace = encodeLetter(createMachine(I), 'A').trace
    const changes = trace.filter((h) => h.input !== h.output).length
    let seen = 0
    trace.forEach((h, k) => {
      const tag = headTag(trace, k)!
      const changed = h.input !== h.output
      if (changed) seen++
      expect(tag.input).toBe(h.input)
      expect(tag.output).toBe(h.output)
      expect(tag.changes).toBe(changes)
      expect(tag.change).toBe(changed ? seen : null)
      expect(tag.detail).toBe(changed ? `change ${seen} of ${changes}` : 'no change')
    })
    const etw = trace.findIndex((h) => h.stage === 'etw-in')
    expect(headTag(trace, etw)).toMatchObject({ sym: 'H', inverse: false, change: null, detail: 'no change' })
    const right = trace.findIndex((h) => h.stage === 'rotor-right-fwd')
    expect(headTag(trace, right)!.title).toBe(`N  ${trace[right]!.input} → ${trace[right]!.output}`)
    const back = trace.findIndex((h) => h.stage === 'rotor-right-bwd')
    expect(headTag(trace, back)).toMatchObject({ sym: 'N', inverse: true })
    expect(headTag(trace, back)!.title.startsWith('N⁻¹  ')).toBe(true)
    const u = trace.findIndex((h) => h.kind === 'reflector')
    expect(headTag(trace, u)).toMatchObject({ sym: 'U', inverse: false })
    expect(headTag(trace, u)!.change).not.toBeNull()
    expect(headTag(trace, 11)).toBeNull()
  })

  it('an unplugged socket changes nothing; a plain path has 7 changes (3 rotors, reflector, 3 rotors)', () => {
    const trace = encodeLetter(createMachine({ ...I, plugboard: '' }), 'Q').trace
    expect(headTag(trace, 0)).toMatchObject({ sym: 'S', change: null, changes: 7 })
    expect(headTag(trace, 10)).toMatchObject({ sym: 'S', inverse: true, change: null })
    expect(headTag(trace, 2)).toMatchObject({ change: 1, detail: 'change 1 of 7' })
    expect(headTag(trace, 8)).toMatchObject({ change: 7, detail: 'change 7 of 7' })
  })

  it('pxPerUnit: a head never smaller than HEAD_MIN_PX on screen', () => {
    // 390 × 844 portrait canvas: the phone, far from the machine
    const ppu = pxPerUnit(35, 380, 110)
    const scale = Math.max(1, HEAD_MIN_PX / 2 / (HEAD_RADIUS * ppu))
    expect(2 * HEAD_RADIUS * scale * ppu).toBeGreaterThanOrEqual(HEAD_MIN_PX - 1e-9)
    // close up, the head keeps its size in the world
    expect(Math.max(1, HEAD_MIN_PX / 2 / (HEAD_RADIUS * pxPerUnit(35, 560, 10)))).toBe(1)
  })
})
