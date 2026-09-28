import { beforeEach, describe, expect, it } from 'vitest'
import { MachineLockedError, useMachineStore } from './machineStore'
import { usePlaybackStore } from './playbackStore'
import { installSync, isBetPending, setPendingBet } from './sync'
import { toyLetters } from '../lib/toy'
import { useToyStore } from './toyStore'
import { useUiStore } from './uiStore'

installSync()

beforeEach(() => {
  setPendingBet(false)
  useUiStore.getState().setPrefs({ motion: 'full', speed: 1 })
  useMachineStore.getState().setLocks({})
  const config = { model: 'I', reflector: 'B', rotors: ['I', 'II', 'III'], rings: 'AAA', positions: 'AAA' } as const
  useMachineStore.getState().setConfig(config)
  usePlaybackStore.setState({ seq: 0, hops: 0, t: 0, playing: false, gated: false })
})

describe('installSync', () => {
  it('starts playback for every press of the default machine store', () => {
    const seq = useMachineStore.getState().seq
    useMachineStore.getState().pressKey('A')
    const started = { source: 'machine', seq: seq + 1, hops: 11, t: 0, playing: true }
    expect(usePlaybackStore.getState()).toMatchObject(started)
    useMachineStore.getState().setConfig({
      model: 'M4',
      reflector: 'B-thin',
      rotors: ['Beta', 'I', 'II', 'III'],
      rings: 'AAAA',
      positions: 'AAAA',
    })
    useMachineStore.getState().pressKey('A')
    expect(usePlaybackStore.getState()).toMatchObject({ seq: seq + 2, hops: 13 })
  })

  it('does not replay on config changes', () => {
    useMachineStore.getState().pressKey('A')
    usePlaybackStore.getState().finish()
    useMachineStore.getState().setPositions('QEV')
    expect(usePlaybackStore.getState().playing).toBe(false)
  })

  it('starts playback for toy presses', () => {
    const { spec } = useToyStore.getState()
    useToyStore.getState().press(toyLetters(spec.n)[0]!)
    const hops = 2 * spec.rotors.length + 3
    expect(usePlaybackStore.getState()).toMatchObject({ source: 'toy', seq: useToyStore.getState().seq, hops })
  })
})

describe('setPendingBet', () => {
  it('locks the keyboard and gates playback, then restores both', () => {
    setPendingBet(true)
    expect(isBetPending()).toBe(true)
    expect(useMachineStore.getState().locks.keyboard).toBe(true)
    expect(usePlaybackStore.getState()).toMatchObject({ gated: true, t: 0 })
    expect(() => useMachineStore.getState().pressKey('A')).toThrow(MachineLockedError)
    setPendingBet(false)
    expect(isBetPending()).toBe(false)
    expect(useMachineStore.getState().locks.keyboard).toBe(false)
    expect(usePlaybackStore.getState().gated).toBe(false)
    useMachineStore.getState().pressKey('A')
    expect(usePlaybackStore.getState().playing).toBe(true)
  })

  it('restores a keyboard lock that was already set, and tolerates repeats', () => {
    useMachineStore.getState().setLocks({ keyboard: true, positions: true })
    setPendingBet(true)
    setPendingBet(true)
    setPendingBet(false)
    expect(useMachineStore.getState().locks).toEqual({ keyboard: true, positions: true })
    setPendingBet(false)
    expect(useMachineStore.getState().locks).toEqual({ keyboard: true, positions: true })
  })

  it('keeps other locks changed while the bet was pending', () => {
    setPendingBet(true)
    useMachineStore.getState().setLocks({ ...useMachineStore.getState().locks, rings: true })
    setPendingBet(false)
    expect(useMachineStore.getState().locks).toEqual({ keyboard: false, rings: true })
  })
})
