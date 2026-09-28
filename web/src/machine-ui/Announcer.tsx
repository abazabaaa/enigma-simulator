/**
 * The live announcer (PLAN §2.5, §3.10): role=status, aria-live=polite, data-testid=announcer.
 * The rotors step BEFORE the current flows, so the sentence says so in that order. Once the lamp of
 * the last press is lit it reads exactly "Rotors stepped to A E W; Q lit E."; with
 * locks.lampsHidden, "Rotors stepped to A E W; Q pressed."; with the rotors held (locks.hold, no
 * rotor moved), "Rotors held at A D U; Q lit E.". It is empty while a press is still animating, so
 * each press is spoken once, when its lamp lights. The text sits in a node keyed by the press, so a
 * repeated identical sentence is a new node and is spoken again.
 */

import type { JSX } from 'react'
import { useStore } from 'zustand'
import type { MachineStoreHook } from '../contracts/machine'
import { usePlaybackStore } from '../state/playbackStore'
import { useToyStore } from '../state/toyStore'
import { useApi, usePressView, type PressView } from './hooks'

export function announcement(view: PressView): string {
  if (!view.hasPress || !view.lit || !view.key) return ''
  const windows = view.after.split('').join(' ')
  const moved = view.stepping ? Object.values(view.stepping.stepped).some(Boolean) : true
  const rotors = moved ? `Rotors stepped to ${windows}` : `Rotors held at ${windows}`
  if (view.lampsHidden || !view.lamp) return `${rotors}; ${view.key} pressed.`
  return `${rotors}; ${view.key} lit ${view.lamp}.`
}

export function AnnouncerFor({ store, className }: { store?: MachineStoreHook; className?: string }): JSX.Element {
  const api = useApi(store)
  // Speak the most recent press: the toy's when the clock last played the toy.
  const toy = usePlaybackStore((s) => s.source === 'toy')
  const view = usePressView(toy ? 'toy' : 'machine', api)
  const machineSeq = useStore(api, (s) => s.seq)
  const toySeq = useToyStore((s) => s.seq)
  const text = announcement(view)
  const press = `${view.source}-${view.source === 'toy' ? toySeq : machineSeq}`
  return (
    <p
      role="status"
      aria-live="polite"
      data-testid="announcer"
      data-press={text ? press : ''}
      className={className ?? 'min-h-5 text-center text-sm text-stone-300'}
    >
      {text ? <span key={press}>{text}</span> : null}
    </p>
  )
}

export function Announcer(): JSX.Element {
  return <AnnouncerFor />
}
