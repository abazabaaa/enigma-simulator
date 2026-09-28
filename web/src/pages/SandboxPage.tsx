/**
 * #/machine?k=<codec> (PLAN §2.3): the whole machine to play with. No bets and no locks.
 *  - StageHost('wire') and a MachinePanel with every panel: rotors and rings, model, reflector,
 *    lamps, keys, plugboard, playback, trace and the paper tape;
 *  - share-link copies a URL whose k= is encodeConfig of the setting where the tape began, so the
 *    recipient can read the tape back (share-url shows the same link);
 *  - k is loaded on entry; an invalid k loads the default machine and says so;
 *  - next-press: the whole machine's substitution for the next key press (after its step) as a
 *    PermTable, collapsed by default.
 */

import { useId, useLayoutEffect, useMemo, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import type { SceneDef } from '../contracts/lesson'
import { DEFAULT_CONFIG, machinePermutation, positionsToString, step } from '../engine'
import { MachinePanel, PermTable, decodeConfig, encodeConfig } from '../machine-ui'
import { tapeStartConfig } from '../machine-ui/tape'
import { hrefFor, useRoute } from '../router'
import { StageHost } from '../stage/StageHost'
import { useMachine, useMachineApi } from '../state/activeMachine'
import { useMachineStore } from '../state/machineStore'
import { usePlaybackStore } from '../state/playbackStore'
import { setPendingBet } from '../state/sync'

const EVERY_PANEL: NonNullable<SceneDef['panels']> = {
  keyboard: true,
  lamps: true,
  rotors: true,
  rings: true,
  plugboard: true,
  model: true,
  trace: true,
  playback: true,
  tape: true,
}

/** The absolute URL of the sandbox with this machine setting. */
export function shareUrl(k: string): string {
  return `${location.origin}${location.pathname}${hrefFor('/machine', { k })}`
}

function ShareLink() {
  const api = useMachineApi()
  // Re-render when the setting or the tape changes.
  useMachine(useShallow((s) => [s.machine, s.input]))
  const url = shareUrl(encodeConfig(tapeStartConfig(api)))
  const [status, setStatus] = useState('')
  const id = useId()

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setStatus('Link copied. It opens this machine set as it was where the tape began.')
    } catch {
      setStatus('Copying was blocked: copy the link from the box.')
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          data-testid="share-link"
          data-url={url}
          onClick={() => void copy()}
          className="rounded border border-amber-400/70 px-3 py-1 text-sm text-amber-200 hover:bg-stone-800"
        >
          Copy share link
        </button>
        <label htmlFor={id} className="sr-only">
          Share link
        </label>
        <input
          id={id}
          data-testid="share-url"
          readOnly
          value={url}
          onFocus={(e) => e.currentTarget.select()}
          className="min-w-0 flex-1 rounded border border-stone-700 bg-stone-900 px-2 py-1 font-mono text-xs text-stone-300"
        />
      </div>
      <p role="status" className="min-h-4 text-xs text-stone-300">
        {status}
      </p>
    </div>
  )
}

/** The next key press as a table: the rotors step first, then every key lights the letter below it. */
function NextPress() {
  const machine = useMachine((s) => s.machine)
  const next = useMemo(() => step(machine).state, [machine])
  const perm = useMemo(() => machinePermutation(next), [next])
  return (
    <details data-testid="next-press" className="rounded-xl border border-stone-800 bg-stone-900/40 p-3">
      <summary className="cursor-pointer text-sm text-stone-200">The next key press as a table</summary>
      <p className="mt-2 mb-2 text-sm text-stone-300">
        The rotors step to {positionsToString(next).split('').join(' ')} first; then each key lights the letter below it.
        Every pair swaps both ways, and no letter ever lights itself.
      </p>
      <PermTable perm={perm} label="Key → lamp" testId="next-perm" />
    </details>
  )
}

export function SandboxPage() {
  const { query } = useRoute()
  const k = query.k
  const [notice, setNotice] = useState<string | null>(null)

  // Before the first paint: no bet, no locks, and the machine from k (or the default).
  useLayoutEffect(() => {
    setPendingBet(false)
    usePlaybackStore.getState().setGated(false)
    const store = useMachineStore.getState()
    store.setLocks({})
    const config = k === undefined ? null : decodeConfig(k)
    store.setConfig(config ?? DEFAULT_CONFIG)
    const shown = k !== undefined && k.length > 48 ? `${k.slice(0, 48)}…` : k
    setNotice(
      k !== undefined && config === null
        ? `The link's machine setting "${shown}" is not valid, so the default machine is loaded (I II III, rings 01 01 01, windows AAA, no plugs).`
        : null,
    )
  }, [k])

  return (
    <main data-testid="sandbox" className="mx-auto flex w-full max-w-6xl min-w-0 flex-col gap-5 px-4 py-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-stone-100">The machine</h1>
        <p className="max-w-3xl text-sm leading-relaxed text-stone-300">
          Type on your keyboard or click the keys. Turn the rotors, set the rings, plug cables and switch between the
          Enigma I, M3 and M4. The trace follows the current through every part, and the tape keeps what you typed.
        </p>
        <ShareLink />
        {notice ? (
          <p
            role="alert"
            data-testid="sandbox-notice"
            className="rounded border border-amber-500/60 bg-amber-950/40 px-3 py-2 text-sm wrap-anywhere text-amber-100"
          >
            {notice}
          </p>
        ) : null}
      </header>
      <StageHost stage="wire" className="min-w-0 rounded-xl border border-stone-800 bg-stone-950 p-2" />
      <MachinePanel show={EVERY_PANEL} />
      <NextPress />
    </main>
  )
}
