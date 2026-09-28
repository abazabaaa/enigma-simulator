// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { STAGE_PRESETS, dimmedParts, type PartId } from '../contracts/stage'
import { createMachine, pressKey, type MachineConfigInput } from '../engine'
import { LABEL_FONT_RATIO, MIN_LABEL_FONT_PX } from './debugApi'
import { labelPlan, minLabelPx, placeLabels, type Rect } from './labels'
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

  it('prefers a spot off the soft keep-outs (the rings), and takes one only when nothing else is free', () => {
    const ring: Rect = { x: 100, y: 100, w: 200, h: 100 }
    const [r] = placeLabels([{ x: 200, y: 150, w: 60, h: 20 }], [], { w: 400, h: 300 }, [ring])
    expect(overlap(r!, ring)).toBe(false)
    // a viewport filled by the ring: the label still gets a place
    const [s] = placeLabels([{ x: 50, y: 50, w: 60, h: 20 }], [], { w: 100, h: 100 }, [{ x: 0, y: 0, w: 100, h: 100 }])
    expect(s).toBeDefined()
  })

  it('never shrinks label type below the minimum', () => {
    expect(minLabelPx(false) * LABEL_FONT_RATIO.name).toBeCloseTo(MIN_LABEL_FONT_PX, 9)
    expect(minLabelPx(true) * LABEL_FONT_RATIO.symbol).toBeGreaterThanOrEqual(MIN_LABEL_FONT_PX)
    expect(MIN_LABEL_FONT_PX).toBeGreaterThanOrEqual(9)
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

  it('pawls: pawls are placed first, every label has a leader target, contacts are kept clear, rings avoided', () => {
    for (const presses of ['A', 'AA', 'AAA']) {
      const { entries, keepOut, soft } = plan('pawls', I, presses)
      expect(entries.every((e) => e.target)).toBe(true)
      expect(soft).toHaveLength(3)
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
