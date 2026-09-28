/**
 * The paper tape (PLAN §3.10): what was typed (tape-input) and what lit (tape-output), in 5-letter
 * groups. tape-copy copies the output; tape-paste reads the clipboard and types it key by key, so
 * copying a ciphertext, rewinding to where the tape began (tape-rewind) and pasting it back gives
 * the plaintext. When the clipboard cannot be read, a text box takes the paste instead.
 */

import { useEffect, useId, useState, type FormEvent, type JSX } from 'react'
import { useStore } from 'zustand'
import { useShallow } from 'zustand/react/shallow'
import type { MachineStoreHook } from '../contracts/machine'
import { groups5, useApi, useMachinePress } from './hooks'
import { rewindTape, showTape, trackTape, typeText } from './tape'

export function PaperTape({ store }: { store?: MachineStoreHook }): JSX.Element {
  const api = useApi(store)
  trackTape(api)
  useEffect(() => showTape(api), [api])
  const { input, output, keyboardLocked, lampsHidden } = useStore(
    api,
    useShallow((s) => ({
      input: s.input,
      output: s.output,
      keyboardLocked: !!s.locks.keyboard,
      lampsHidden: !!s.locks.lampsHidden,
    })),
  )
  // The tape follows the playback clock like every other view: the last press's lamp letter is
  // printed once that lamp lights (PLAN §2.5), and scrubbing back takes it off again.
  const { hasPress, lit } = useMachinePress(api)
  const printed = hasPress && !lit ? output.slice(0, -1) : output
  const [status, setStatus] = useState('')
  const [manual, setManual] = useState(false)
  const [pasted, setPasted] = useState('')
  const headingId = useId()
  const pasteId = useId()

  const type = (text: string) => {
    try {
      const n = typeText(api, text)
      setStatus(n ? `Typed ${n} letter${n === 1 ? '' : 's'}.` : 'Nothing to type: the text has no letters A–Z.')
    } catch (e) {
      setStatus(e instanceof Error ? e.message : String(e))
    }
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(groups5(printed))
      setStatus('Copied the output tape.')
    } catch {
      setStatus('Copying was blocked: select the output tape and copy it by hand.')
    }
  }

  const paste = async () => {
    try {
      const text = await navigator.clipboard.readText()
      setManual(false)
      type(text)
    } catch {
      setManual(true)
      setStatus('Reading the clipboard was blocked: paste the text into the box instead.')
    }
  }

  const submitManual = (e: FormEvent) => {
    e.preventDefault()
    type(pasted)
    setPasted('')
    setManual(false)
  }

  const button =
    'rounded border border-stone-600 px-3 py-1 text-sm text-stone-100 hover:bg-stone-800 disabled:opacity-50'
  const shownOutput = lampsHidden ? printed.replace(/[A-Z]/g, '?') : printed

  return (
    <section aria-labelledby={headingId} data-testid="paper-tape" className="flex flex-col gap-2">
      <h2 id={headingId} className="text-sm font-medium text-stone-200">
        Paper tape
      </h2>
      <div className="grid grid-cols-[3rem_minmax(0,1fr)] gap-x-2 gap-y-1 rounded border border-stone-800 bg-stone-900/60 p-2 font-mono text-sm">
        <span className="text-stone-300">in</span>
        <output data-testid="tape-input" className="min-h-5 break-words text-stone-100">
          {groups5(input)}
        </output>
        <span className="text-stone-300">out</span>
        <output data-testid="tape-output" className="min-h-5 break-words text-amber-200">
          {groups5(shownOutput)}
        </output>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" data-testid="tape-copy" disabled={!printed || lampsHidden} onClick={() => void copy()} className={button}>
          Copy output
        </button>
        <button type="button" data-testid="tape-paste" disabled={keyboardLocked} onClick={() => void paste()} className={button}>
          Paste and type
        </button>
        <button type="button" data-testid="tape-rewind" onClick={() => rewindTape(api)} className={button}>
          Clear and rewind
        </button>
      </div>
      {manual ? (
        <form onSubmit={submitManual} className="flex flex-wrap items-end gap-2">
          <label htmlFor={pasteId} className="text-sm text-stone-300">
            Text to type
          </label>
          <textarea
            id={pasteId}
            data-testid="tape-paste-text"
            value={pasted}
            onChange={(e) => setPasted(e.target.value)}
            rows={2}
            className="min-w-0 flex-1 rounded border border-stone-600 bg-stone-900 p-1 font-mono text-sm text-stone-100"
          />
          <button type="submit" data-testid="tape-type" disabled={keyboardLocked} className={button}>
            Type it
          </button>
        </form>
      ) : null}
      <p role="status" data-testid="tape-status" className="min-h-5 text-xs text-stone-300">
        {status}
      </p>
    </section>
  )
}
