import { beforeEach, describe, expect, it } from 'vitest'
import { useMachineStore } from '../../state/machineStore'
import { usePlaybackStore } from '../../state/playbackStore'
import { installSync } from '../../state/sync'
import { useToyStore } from '../../state/toyStore'
import { applyGating, releaseGating } from '../ui/gating'

describe('bet gating (G10)', () => {
  beforeEach(() => {
    installSync()
    releaseGating()
    useMachineStore.getState().setLocks({})
    useMachineStore
      .getState()
      .setConfig({ model: 'I', reflector: 'B', rotors: ['I', 'II', 'III'], rings: 'AAA', positions: 'ADU' })
    usePlaybackStore.getState().setSpeed('instant')
  })

  it('a newly gated playback shows the current windows, not the last press’s "before" (review round 2)', () => {
    useMachineStore.getState().pressKey('A')
    expect(useMachineStore.getState().last?.stepping.before).toEqual([0, 3, 20])
    useMachineStore.getState().setLocks({ positions: true, rotors: true })
    applyGating({ lock: true, gate: true })
    const m = useMachineStore.getState()
    expect(m.last).toBeNull()
    expect(m.machine.positions).toEqual([0, 3, 21]) // ADV: the windows now
    expect(m.input).toBe('A') // the tape is kept
    expect(m.locks).toMatchObject({ keyboard: true, positions: true, rotors: true })
    expect(usePlaybackStore.getState()).toMatchObject({ gated: true, t: 0 })
    releaseGating()
    expect(useMachineStore.getState().locks).toMatchObject({ keyboard: false, positions: true })
    expect(usePlaybackStore.getState().gated).toBe(false)
  })

  it('clears the toy’s last press too, and leaves a machine without a press alone', () => {
    useToyStore.getState().press('A')
    applyGating({ lock: true, gate: true })
    expect(useToyStore.getState().last).toBeNull()
    expect(useMachineStore.getState().machine.positions).toEqual([0, 3, 20])
    releaseGating()
  })

  it('a keyboard-only lock (between reveals) keeps the last press on show', () => {
    useMachineStore.getState().pressKey('A')
    applyGating({ lock: true, gate: false })
    expect(useMachineStore.getState().last).not.toBeNull()
    expect(useMachineStore.getState().locks.keyboard).toBe(true)
    expect(usePlaybackStore.getState().gated).toBe(false)
    releaseGating()
    expect(useMachineStore.getState().locks.keyboard).toBe(false)
  })
})
