import { beforeEach, describe, expect, it } from 'vitest'
import { HOP_MS, STEP_MS, advance, usePlaybackStore } from './playbackStore'
import { useUiStore } from './uiStore'

const pb = () => usePlaybackStore.getState()

beforeEach(() => {
  useUiStore.getState().setPrefs({ motion: 'full' })
  usePlaybackStore.setState({ source: 'machine', seq: 0, hops: 0, t: 0, playing: false, speed: 1, gated: false })
})

describe('advance', () => {
  it('takes STEP_MS for the stepping phase and HOP_MS per hop, divided by speed', () => {
    expect(advance(0, 11, STEP_MS, 1)).toBe(1)
    expect(advance(0, 11, STEP_MS / 2, 1)).toBe(0.5)
    expect(advance(0, 11, STEP_MS + HOP_MS, 1)).toBe(2)
    expect(advance(0, 11, STEP_MS + 11 * HOP_MS, 1)).toBe(12)
    expect(advance(0, 11, 1e9, 1)).toBe(12)
    expect(advance(0, 11, STEP_MS / 4, 4)).toBe(1)
    expect(advance(0.5, 11, 200 + 75, 1)).toBe(1.5)
  })
})

describe('playback store', () => {
  it('plays from t = 0 and ticks to the lamp', () => {
    pb().play('machine', 1, 11)
    expect(pb()).toMatchObject({ t: 0, playing: true, seq: 1, hops: 11, source: 'machine' })
    pb().tick(STEP_MS)
    expect(pb().t).toBe(1)
    pb().tick(HOP_MS)
    expect(pb().t).toBe(2)
    pb().tick(10_000)
    expect(pb()).toMatchObject({ t: 12, playing: false })
    pb().tick(100)
    expect(pb().t).toBe(12)
  })

  it('jumps to the end at speed instant', () => {
    pb().setSpeed('instant')
    pb().play('toy', 3, 7)
    expect(pb()).toMatchObject({ t: 8, playing: false, source: 'toy', seq: 3, hops: 7 })
  })

  it('finishes a running animation when switched to instant', () => {
    pb().play('machine', 1, 11)
    pb().setSpeed('instant')
    expect(pb()).toMatchObject({ t: 12, playing: false })
  })

  it('jumps to the end under reduced motion', () => {
    useUiStore.getState().setPrefs({ motion: 'reduce' })
    pb().play('machine', 1, 11)
    expect(pb()).toMatchObject({ t: 12, playing: false })
  })

  it('gated pins t at 0 and ignores play, scrub and finish', () => {
    pb().play('machine', 1, 11)
    pb().tick(STEP_MS)
    pb().setGated(true)
    expect(pb()).toMatchObject({ t: 0, playing: false, gated: true })
    pb().play('machine', 2, 11)
    pb().scrub(5)
    pb().finish()
    pb().tick(1000)
    expect(pb()).toMatchObject({ t: 0, seq: 1, gated: true })
    pb().setGated(false)
    pb().play('machine', 2, 11)
    expect(pb()).toMatchObject({ seq: 2, playing: true })
  })

  it('scrub clamps and pauses; finish ends', () => {
    pb().play('machine', 1, 11)
    pb().scrub(5.5)
    expect(pb()).toMatchObject({ t: 5.5, playing: false })
    pb().scrub(99)
    expect(pb().t).toBe(12)
    pb().scrub(-1)
    expect(pb().t).toBe(0)
    pb().finish()
    expect(pb().t).toBe(12)
  })

  it('takes the speed from the UI preferences', () => {
    useUiStore.getState().setPrefs({ speed: 2 })
    expect(pb().speed).toBe(2)
    pb().play('machine', 1, 11)
    pb().tick(STEP_MS / 2)
    expect(pb().t).toBe(1)
  })
})
