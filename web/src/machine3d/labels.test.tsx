// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { STAGE_PRESETS, dimmedParts, type PartId } from '../contracts/stage'
import { createMachine, pressKey, type MachineConfigInput } from '../engine'
import { labelPlan, placeLabels, type Rect } from './labels'
import { presentParts } from './Scene'
import { machineView } from './view'

const I: MachineConfigInput = { model: 'I', reflector: 'B', rotors: ['I', 'II', 'III'], rings: 'AAA', positions: 'ADU' }

const overlap = (a: Rect, b: Rect) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h

describe('placeLabels', () => {
  it('moves crowded labels apart, off the keep-out boxes and inside the viewport', () => {
    // six labels on almost the same spot, two keep-out points among them, one near each edge
    const labels = [
      ...Array.from({ length: 6 }, (_, k) => ({ x: 200 + k * 3, y: 120 + k * 2, w: 70, h: 24 })),
      { x: 5, y: 5, w: 90, h: 24 },
      { x: 395, y: 295, w: 90, h: 24 },
    ]
    const keepOut: Rect[] = [
      { x: 191, y: 111, w: 18, h: 18 },
      { x: 230, y: 150, w: 18, h: 18 },
    ]
    const rects = placeLabels(labels, keepOut, { w: 400, h: 300 })
    expect(rects).toHaveLength(labels.length)
    rects.forEach((r, i) => {
      expect(r.x, `label ${i} inside`).toBeGreaterThanOrEqual(0)
      expect(r.y).toBeGreaterThanOrEqual(0)
      expect(r.x + r.w).toBeLessThanOrEqual(400)
      expect(r.y + r.h).toBeLessThanOrEqual(300)
      for (const k of keepOut) expect(overlap(r, k), `label ${i} on a keep-out box`).toBe(false)
      rects.forEach((o, j) => {
        if (j !== i) expect(overlap(r, o), `labels ${i} and ${j}`).toBe(false)
      })
    })
  })

  it('leaves a label that fits where it is', () => {
    const [r] = placeLabels([{ x: 100, y: 50, w: 40, h: 20 }], [], { w: 400, h: 300 })
    expect(r).toEqual({ x: 80, y: 40, w: 40, h: 20 })
  })
})

describe('labelPlan', () => {
  const plan = (preset: keyof typeof STAGE_PRESETS, config = I, presses = '') => {
    let machine = createMachine(config)
    let last = null
    for (const k of presses) {
      last = pressKey(machine, k)
      machine = last.state
    }
    const view = machineView({ machine, last, lampsHidden: false }, { t: 99, hops: 11 })
    const directive = STAGE_PRESETS[preset]
    const dimmed = new Set<PartId>(dimmedParts(directive.focus, 'I'))
    return labelPlan(view, directive, presentParts('I', directive, view), dimmed)
  }

  it('pawls: pawls are placed first, and every pawl–notch contact is kept clear', () => {
    for (const presses of ['A', 'AA', 'AAA']) {
      const { entries, keepOut } = plan('pawls', I, presses)
      expect(entries.map((e) => e.key)).toEqual([
        'pawl-left',
        'pawl-middle',
        'pawl-right',
        'notch-left',
        'notch-middle',
        'notch-right',
      ])
      expect(keepOut).toHaveLength(6)
    }
  })

  it('rotor-layers names the ring setting of the ring in focus and keeps its number clear', () => {
    const { entries, keepOut } = plan('rotor-layers', { ...I, rings: 'AAE' })
    expect(entries.map((e) => e.text)).toEqual(['ring 05', 'Alphabet ring'])
    expect(keepOut).toHaveLength(1)
  })

  it('keyboard and lampboard labels sit beside their rows, not on the keys or lamps', () => {
    const { entries } = plan('wire')
    const at = (key: string) => entries.find((e) => e.key === key)!.anchor
    expect(Math.abs(at('keyboard').x)).toBeGreaterThan(13.5)
    expect(Math.abs(at('lampboard').x)).toBeGreaterThan(13.5)
  })
})
