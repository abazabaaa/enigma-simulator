// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { ModelName } from '../../contracts/core'
import {
  ALL_PARTS,
  STAGE_PRESET_IDS,
  dimmedParts,
  resolveStage,
  type PartId,
  type StageDirective,
  type StageReport,
} from '../../contracts/stage'
import { createMachine, encodeLetter, positionsToString, type MachineConfigInput } from '../../engine'
import { createRng } from '../../lib/rng'
import { randomToy } from '../../lib/toy'
import { allByTestId, byTestId, cleanup, mount, resetStores, run } from '../../machine-ui/__tests__/dom'
import { useMachineStore } from '../../state/machineStore'
import { usePlaybackStore } from '../../state/playbackStore'
import { useStageStore } from '../../state/stageStore'
import { useToyStore } from '../../state/toyStore'
import Stage2D, { focusCenter } from '../index'
import { MIN_TEXT_PX, drawnPoints, makeCircuitLayout, pathPointCount, signalPath } from '../layout'

const CONFIGS: Readonly<Record<ModelName, MachineConfigInput>> = {
  I: { model: 'I', reflector: 'B', rotors: ['I', 'II', 'III'], rings: 'AAA', positions: 'ADU', plugboard: 'AV BS CG' },
  M3: { model: 'M3', reflector: 'B', rotors: ['III', 'VI', 'VIII'], rings: 'AHM', positions: 'UZV', plugboard: 'AN EZ HK' },
  M4: { model: 'M4', reflector: 'B-thin', rotors: ['Beta', 'II', 'IV', 'I'], rings: 'AAAV', positions: 'VJNA', plugboard: 'AT BL DF' },
}

function render(directive: StageDirective, reducedMotion = true) {
  const reports: StageReport[] = []
  const view = (d: StageDirective, rm: boolean) => (
    <Stage2D directive={d} reducedMotion={rm} onReport={(r) => reports.push(r)} onError={(e) => reports.push(e as StageReport)} />
  )
  const m = mount(view(directive, reducedMotion))
  return { reports, last: () => reports[reports.length - 1]!, rerender: (d: StageDirective, rm = reducedMotion) => m.rerender(view(d, rm)) }
}

const store = () => useMachineStore.getState()

beforeEach(() => resetStores(CONFIGS.I))
afterEach(() => cleanup())

describe('Stage2D reports', () => {
  it.each(['I', 'M3', 'M4'] as const)('dimmedParts(focus, model) for every preset (%s)', (model) => {
    run(() => store().setConfig(CONFIGS[model]))
    for (const id of STAGE_PRESET_IDS) {
      const directive = resolveStage(id)
      const { last } = render(directive)
      const report = last()
      expect(report.renderer, id).toBe('svg')
      expect(report.focus, id).toBe(directive.focus)
      expect(report.dimmed, id).toEqual(dimmedParts(directive.focus, model))
      // The drawing dims exactly those parts; a machine drawing has every part of the model.
      const groups = [...allByTestId(/^stage2d$/)[0]!.querySelectorAll<SVGGElement>('[data-part]')]
      for (const g of groups) expect(g.dataset.dimmed === 'true', `${id} ${g.dataset.part}`).toBe(report.dimmed.includes(g.dataset.part as PartId))
      if (directive.source === 'machine') expect(groups.map((g) => g.dataset.part).sort(), id).toEqual([...ALL_PARTS(model)].sort())
      cleanup()
    }
  })

  it('reports the machine model for a toy source too', () => {
    run(() => {
      store().setConfig(CONFIGS.M4)
      useToyStore.getState().setSpec(randomToy(createRng(1), 6, 2))
    })
    const { last } = render(resolveStage({ preset: 'toy', with: { source: 'toy' } }))
    expect(last().dimmed).toEqual(dimmedParts('wire', 'M4'))
    expect(last().windows).toMatch(/^[A-F]{2}$/)
    run(() => useToyStore.getState().press('A'))
    expect(last().litLamp).toBe(useToyStore.getState().last!.lamp)
    expect(last().pathPoints).toBe(2 + 2 * useToyStore.getState().last!.hops.length)
  })

  it('reports the lamp, windows, hop and path of a press', () => {
    const { last } = render(resolveStage('wire'))
    expect(last()).toMatchObject({ litLamp: null, windows: 'ADU', hop: -1, pathPoints: 2, ghost: false })
    run(() => store().pressKey('Q'))
    expect(last()).toMatchObject({ litLamp: store().output, windows: 'ADV', hop: 10, pathPoints: 24 })
    expect(byTestId('stage2d-path').dataset.points).toBe('24')
  })

  it('follows t: before-windows and no lamp while stepping, hop k while it is live', () => {
    const { last } = render(resolveStage('wire'))
    run(() => usePlaybackStore.getState().setSpeed(1))
    run(() => store().pressKey('Q'))
    expect(last()).toMatchObject({ litLamp: null, windows: 'ADU', hop: -1, pathPoints: 2 })
    run(() => usePlaybackStore.getState().scrub(3.5))
    expect(last()).toMatchObject({ litLamp: null, windows: 'ADV', hop: 2, pathPoints: 2 + 2 * 3 })
    run(() => usePlaybackStore.getState().finish())
    expect(last()).toMatchObject({ litLamp: store().output, hop: 10, pathPoints: 24 })
  })

  it('draws nothing for trace off, the whole path for static, and conceals it under lampsHidden', () => {
    const r = render(resolveStage('pawls'))
    run(() => store().pressKey('A'))
    expect(r.last()).toMatchObject({ pathPoints: 2, litLamp: store().output })
    r.rerender(resolveStage('rotors'))
    expect(r.last().pathPoints).toBe(24)
    r.rerender(resolveStage('wire'))
    run(() => store().setLocks({ lampsHidden: true }))
    expect(r.last()).toMatchObject({ pathPoints: 2, litLamp: null })
  })

  it('reports highlights, pulsing them unless motion is reduced', () => {
    run(() => useStageStore.getState().setHighlight([{ part: 'notch-right', tone: 'hint' }, { part: 'pawl-middle', tone: 'error' }]))
    const r = render(resolveStage('pawls'), false)
    expect(r.last().highlighted).toEqual(['notch-right', 'pawl-middle'])
    const outline = document.querySelector('[data-highlight="notch-right"]')!
    expect(outline.getAttribute('class')).toMatch(/animate-pulse/)
    r.rerender(resolveStage('pawls'), true)
    expect(document.querySelector('[data-highlight="notch-right"]')!.getAttribute('class') ?? '').not.toMatch(/animate-pulse/)
  })

  it('draws a ghost path against the reference path', () => {
    const reference = encodeLetter(createMachine(CONFIGS.I), 'A').trace
    const hops = reference.map((h, i) => (i < 4 ? h : { ...h, output: 'Z' as const, outputIndex: 25 }))
    run(() => useStageStore.getState().setGhost({ hops, divergeAt: 4 }))
    const r = render(resolveStage('wire'))
    expect(r.last().ghost).toBe(true)
    expect(byTestId('stage2d-ghost').getAttribute('stroke-dasharray')).toBeTruthy()
    expect(byTestId('stage2d-reference')).toBeTruthy()
  })

  it('shows the windows of an M4 left to right with the Greek rotor first', () => {
    run(() => store().setConfig(CONFIGS.M4))
    const { last } = render(resolveStage('rotor-layers'))
    expect(last().windows).toBe('VJNA')
    expect(last().windows).toBe(positionsToString(store().machine))
    expect(document.querySelectorAll('[data-part="pawl-greek"], [data-part="notch-greek"]')).toHaveLength(0)
  })
})

describe('review round 2 regressions', () => {
  it('F1: keeps every text at least MIN_TEXT_PX (9) CSS px at the minimum width, and never shrinks below it', () => {
    const layouts = [
      makeCircuitLayout({ n: 26, slots: ['left', 'middle', 'right'], etw: true }),
      makeCircuitLayout({ n: 26, slots: ['greek', 'left', 'middle', 'right'], etw: true }),
      makeCircuitLayout({ n: 26, slots: ['greek', 'left', 'middle', 'right'], etw: true, ringLayer: true }),
      makeCircuitLayout({ n: 6, slots: ['middle', 'right'], etw: false }),
      makeCircuitLayout({ n: 8, slots: ['left', 'middle', 'right'], etw: false }),
    ]
    for (const l of layouts) {
      for (const f of Object.values(l.fonts)) expect((f * l.minWidth) / l.width).toBeGreaterThanOrEqual(MIN_TEXT_PX)
      // A phone's 390 px screen cannot fit a 26-letter machine at that size: it scrolls instead.
      if (l.n === 26) expect(l.minWidth).toBeGreaterThan(390)
    }
    // The drawing never uses a font below the layout's smallest, and holds its minimum width.
    for (const model of ['I', 'M4'] as const) {
      run(() => store().setConfig(CONFIGS[model]))
      for (const id of ['rotor-layers', 'pawls', 'wire', 'symbols'] as const) {
        render(resolveStage(id))
        const svg = byTestId('stage2d')
        const l = makeCircuitLayout({
          n: 26,
          slots: model === 'M4' ? ['greek', 'left', 'middle', 'right'] : ['left', 'middle', 'right'],
          etw: true,
          ringLayer: resolveStage(id).ringLayer,
        })
        expect(svg.style.minWidth, id).toBe(`${l.minWidth}px`)
        const smallest = Math.min(...Object.values(l.fonts))
        const sizes = [...svg.querySelectorAll('text')].map((t) => Number(t.getAttribute('font-size')))
        expect(Math.min(...sizes), `${model} ${id}`).toBeGreaterThanOrEqual(smallest)
        expect(byTestId('stage2d-scroll').className).toMatch(/overflow-x-auto/)
        cleanup()
      }
    }
  })

  it('F1: centres the scroll on the focused parts', () => {
    const boxes = { 'ring-right': { x: 400, y: 0, w: 20, h: 10 }, battery: { x: 600, y: 0, w: 20, h: 10 } } as const
    expect(focusCenter(boxes, new Set(['battery']))).toBe(410)
    expect(focusCenter(boxes, new Set(['battery', 'ring-right']))).toBeNull()
  })

  it("F5: a 'static' trace waits for the stepping phase and has no moving head", () => {
    const r = render(resolveStage('rotors'))
    run(() => usePlaybackStore.getState().setSpeed(1))
    run(() => store().pressKey('Q'))
    expect(r.last()).toMatchObject({ pathPoints: 2, hop: -1, windows: 'ADU' })
    expect(document.querySelector('[data-testid="stage2d-path"]')).toBeNull()
    run(() => usePlaybackStore.getState().scrub(0.44))
    expect(document.querySelector('[data-testid="stage2d-path"]')).toBeNull()
    run(() => usePlaybackStore.getState().scrub(1))
    expect(r.last()).toMatchObject({ pathPoints: 24, windows: 'ADV' })
    expect(byTestId('stage2d-path')).toBeTruthy()
    expect(document.querySelector('[data-testid="stage2d-head"]')).toBeNull()
    // 'animate' does draw a head while the path grows.
    r.rerender(resolveStage('wire'))
    run(() => usePlaybackStore.getState().scrub(3.5))
    expect(byTestId('stage2d-head')).toBeTruthy()
  })

  it('F8: draws the keys and lamps over the ends of the path', () => {
    render(resolveStage('wire'))
    run(() => store().pressKey('A'))
    const path = byTestId('stage2d-path')
    const front = document.querySelector('[data-testid="stage2d"] [data-layer="front"]')!
    expect(front.querySelector('[data-part="lampboard"]')).not.toBeNull()
    expect(front.querySelector('[data-part="keyboard"]')).not.toBeNull()
    expect(path.compareDocumentPosition(front) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })
})

describe('circuit layout', () => {
  it('has 2 + 2·hops points and draws them up to t', () => {
    const l = makeCircuitLayout({ n: 26, slots: ['left', 'middle', 'right'], etw: true })
    const trace = encodeLetter(createMachine(CONFIGS.I), 'Q').trace
    const path = signalPath(l, trace)!
    expect(path.pieces).toHaveLength(11)
    const full = drawnPoints(path, 12)
    // Key, entry and exit of each hop, lamp (the reflector turn adds two inner corners).
    expect(full).toHaveLength(2 + 2 * 11 + 2)
    expect(pathPointCount(11)).toBe(24)
    expect(pathPointCount(0)).toBe(2) // nothing drawn: PLAN §3.3 still counts the two ends
    expect(drawnPoints(path, 0.5)).toEqual([])
    expect(drawnPoints(path, 1.0)).toHaveLength(1)
    expect(drawnPoints(path, 2.0).length).toBeGreaterThan(2)
    expect(drawnPoints(path, 0, true)).toEqual(full)
  })

  it('fits the toy and the M4 in their widths', () => {
    const toy = makeCircuitLayout({ n: 6, slots: ['middle', 'right'], etw: false })
    const m4 = makeCircuitLayout({ n: 26, slots: ['greek', 'left', 'middle', 'right'], etw: true })
    expect(toy.columns.etw).toBeUndefined()
    expect(m4.width).toBeGreaterThan(makeCircuitLayout({ n: 26, slots: ['left', 'middle', 'right'], etw: true }).width)
    for (const l of [toy, m4]) {
      const xs = Object.values(l.columns).flatMap((c) => [c!.x0, c!.x1])
      expect(Math.max(...xs)).toBeLessThan(l.width)
    }
  })
})
