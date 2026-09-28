/**
 * The paper tape's memory: where the current tape began. A tape is enciphered from the windows the
 * rotors showed before its first letter; reading the ciphertext back from those windows returns the
 * plaintext, and the share link encodes them. The store keeps only the configured start
 * (config.positions), which differs once the windows have been turned by hand, so each store's
 * first press after an empty tape is recorded here.
 *
 * One tape, one setting: while a PaperTape is shown, changing the setting by hand (turning a
 * rotor, setting a ring, a rotor, the reflector, the model or a cable) with letters on the tape
 * starts a new, empty tape at the new setting. Otherwise the tape would mix two settings and
 * neither the share link nor a rewind could read it back.
 */

import type { MachineStoreHook } from '../contracts/machine'
import { isLetter, positionsToString, type Letter, type MachineConfig } from '../engine'
import { useMachineStore } from '../state/machineStore'

const starts = new WeakMap<MachineStoreHook, string>()
const tracked = new WeakSet<MachineStoreHook>()
/** Mounted PaperTapes per store. */
const shown = new WeakMap<MachineStoreHook, number>()

/** Start recording where `api`'s tapes begin (idempotent). */
export function trackTape(api: MachineStoreHook): void {
  if (tracked.has(api)) return
  tracked.add(api)
  api.subscribe((s, prev) => {
    if (s.input === '') starts.delete(api)
    else if (prev.input === '' && s.last) starts.set(api, positionsToString(s.last.stepping.before))
    else if (s.machine !== prev.machine && s.seq === prev.seq && (shown.get(api) ?? 0) > 0) newTapeSoon(api, s.seq)
  })
}

/** A PaperTape for `api` is on screen (hand changes then start a new tape); returns the release. */
export function showTape(api: MachineStoreHook): () => void {
  trackTape(api)
  shown.set(api, (shown.get(api) ?? 0) + 1)
  return () => shown.set(api, Math.max(0, (shown.get(api) ?? 1) - 1))
}

/**
 * Clear the tape, keeping the setting and the current windows (the setup path, so no lock is
 * touched: the setting itself does not change). Deferred to a microtask so the store is never
 * written from inside its own change notification.
 */
function newTapeSoon(api: MachineStoreHook, seq: number): void {
  queueMicrotask(() => {
    const s = api.getState()
    if (s.seq !== seq || s.input === '') return
    s.setConfig({ ...s.machine.config, positions: positionsToString(s.machine) })
  })
}

// The default store is tracked from the moment the machine UI loads.
trackTape(useMachineStore)

/** The windows where the current tape began; the current windows when the tape is empty. */
export function tapeStart(api: MachineStoreHook): string {
  const s = api.getState()
  if (s.input === '') return positionsToString(s.machine)
  return starts.get(api) ?? s.machine.config.positions.join('')
}

/** The current setting with the windows where the tape began (what a recipient needs to read it). */
export function tapeStartConfig(api: MachineStoreHook): MachineConfig {
  const { config } = api.getState().machine
  return { ...config, positions: tapeStart(api).split('') as Letter[] }
}

/**
 * Clear the tape and turn the rotors back to where it began. When the windows are locked (or the
 * tape began at the configured start) this is the store's reset().
 */
export function rewindTape(api: MachineStoreHook): void {
  const s = api.getState()
  const start = tapeStart(api)
  if (!s.locks.positions && start !== s.machine.config.positions.join('')) {
    s.setConfig({ ...s.machine.config, positions: start })
  } else {
    s.reset()
  }
}

/** Type `text` key by key (letters only; everything else is skipped). Returns the number of keys pressed. */
export function typeText(api: MachineStoreHook, text: string): number {
  let typed = 0
  for (const ch of text.toUpperCase()) {
    if (!isLetter(ch)) continue
    const s = api.getState()
    if (s.locks.keyboard) break
    s.pressKey(ch)
    typed++
  }
  return typed
}
