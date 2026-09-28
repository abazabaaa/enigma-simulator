/**
 * The keyboard (PLAN §3.10): 26 <button>s key-A…Z in the German QWERTZ rows, plus the physical-key
 * listener. Both call the store's pressKey, the one write path (§2.5).
 * While locks.keyboard is set the keys are aria-disabled and the whole keyboard is inert, and
 * physical keys are ignored.
 */

import { useLayoutEffect, type JSX } from 'react'
import { useStore } from 'zustand'
import type { MachineStoreHook } from '../contracts/machine'
import { KEYBOARD_ROWS, isLetter, type Letter } from '../engine'
import { useApi } from './hooks'

/** <input> types that take typed characters. Sliders, checkboxes, radios and buttons do not. */
const TEXT_INPUT_TYPES = new Set([
  'text',
  'search',
  'number',
  'email',
  'url',
  'tel',
  'password',
  'date',
  'datetime-local',
  'month',
  'time',
  'week',
])

/**
 * Whether a key event's target is somewhere typing means text entry (or a spinbutton, which takes
 * typed letters itself), not a key press. A focused slider, checkbox, radio, button or select does
 * NOT swallow typing: after touching the speed select or the scrub bar, typing still presses keys
 * (and the press cancels the select's type-ahead).
 */
export function isTextEntry(target: EventTarget | null): boolean {
  if (typeof Element === 'undefined' || !(target instanceof Element)) return false
  const el = target as HTMLElement
  if (el.isContentEditable || el.tagName === 'TEXTAREA') return true
  if (el.tagName === 'INPUT') return TEXT_INPUT_TYPES.has(((el as HTMLInputElement).type || 'text').toLowerCase())
  return el.closest('[contenteditable]:not([contenteditable="false"]),[role="spinbutton"],[role="textbox"]') !== null
}

/** The letter a physical key event types, or null. */
export function letterOf(e: KeyboardEvent): Letter | null {
  const key = e.key?.length === 1 ? e.key.toUpperCase() : ''
  if (isLetter(key)) return key
  // A non-Latin layout: fall back to the key's position.
  const m = /^Key([A-Z])$/.exec(e.code ?? '')
  return e.key?.length === 1 && m ? (m[1] as Letter) : null
}

/**
 * Mounted keyboards, most recent last. A single window listener presses keys on the most recently
 * mounted keyboard's store, so two keyboards on one page never double a press.
 */
const mounted: MachineStoreHook[] = []

function onKeyDown(e: KeyboardEvent): void {
  if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || e.repeat) return
  const letter = letterOf(e)
  if (!letter || isTextEntry(e.target)) return
  const api = mounted[mounted.length - 1]
  if (!api) return
  const s = api.getState()
  if (s.locks.keyboard) return
  e.preventDefault()
  s.pressKey(letter)
}

function mount(api: MachineStoreHook): () => void {
  mounted.push(api)
  if (mounted.length === 1) window.addEventListener('keydown', onKeyDown)
  return () => {
    const i = mounted.lastIndexOf(api)
    if (i !== -1) mounted.splice(i, 1)
    if (mounted.length === 0) window.removeEventListener('keydown', onKeyDown)
  }
}

/** key-A…Z; QWERTZ rows. */
export function Keyboard({ store }: { store?: MachineStoreHook }): JSX.Element {
  const api = useApi(store)
  const locked = useStore(api, (s) => !!s.locks.keyboard)

  // A layout effect, so the listener is attached in the same task as the first commit: once the
  // keyboard is visible, typing is heard.
  useLayoutEffect(() => mount(api), [api])

  const press = (letter: Letter) => {
    const s = api.getState()
    if (!s.locks.keyboard) s.pressKey(letter)
  }

  return (
    <div
      role="group"
      aria-label={locked ? 'Keyboard (locked)' : 'Keyboard'}
      data-testid="keyboard"
      data-locked={locked ? 'true' : 'false'}
      inert={locked}
      className={`flex flex-col items-center gap-1 ${locked ? 'opacity-50' : ''}`}
    >
      {KEYBOARD_ROWS.map((row, r) => (
        <div key={r} className="flex gap-1">
          {row.map((letter) => (
            <button
              key={letter}
              type="button"
              data-testid={`key-${letter}`}
              aria-disabled={locked ? 'true' : undefined}
              onClick={() => press(letter)}
              className="h-9 w-8 rounded-md border border-stone-600 bg-stone-800 font-mono text-sm text-stone-100 shadow-sm hover:bg-stone-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300 active:translate-y-px sm:w-9"
            >
              {letter}
            </button>
          ))}
        </div>
      ))}
    </div>
  )
}
