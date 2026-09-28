/**
 * The live announcer (PLAN §2.5, §3.10): role=status, aria-live=polite, data-testid=announcer.
 * Once the lamp of the last press is lit it reads exactly "Q lights E. Rotors now A E W."; with
 * locks.lampsHidden, "Q pressed. Rotors now A E W.". It is empty while a press is still animating,
 * so each press is spoken once, when its lamp lights.
 */

import type { JSX } from 'react'
import type { MachineStoreHook } from '../contracts/machine'
import { usePlaybackStore } from '../state/playbackStore'
import { useApi, usePressView, type PressView } from './hooks'

export function announcement(view: PressView): string {
  if (!view.hasPress || !view.lit || !view.key) return ''
  const rotors = `Rotors now ${view.after.split('').join(' ')}.`
  if (view.lampsHidden || !view.lamp) return `${view.key} pressed. ${rotors}`
  return `${view.key} lights ${view.lamp}. ${rotors}`
}

export function AnnouncerFor({ store, className }: { store?: MachineStoreHook; className?: string }): JSX.Element {
  const api = useApi(store)
  // Speak the most recent press: the toy's when the clock last played the toy.
  const toy = usePlaybackStore((s) => s.source === 'toy')
  const view = usePressView(toy ? 'toy' : 'machine', api)
  return (
    <p role="status" aria-live="polite" data-testid="announcer" className={className ?? 'min-h-5 text-center text-sm text-stone-300'}>
      {announcement(view)}
    </p>
  )
}

export function Announcer(): JSX.Element {
  return <AnnouncerFor />
}
