import type { JSX, KeyboardEvent } from 'react'
import type { LightTableProps } from './types'

const CELL = 8

/** Apertures open on every one of the first `shown` sheets (all open when none is stacked). */
export function stackedApertures(sheets: readonly (readonly boolean[])[], size: number, shown: number): boolean[] {
  const out = new Array<boolean>(size * size).fill(true)
  for (let s = 0; s < Math.min(shown, sheets.length); s++) {
    const sheet = sheets[s]!
    for (let i = 0; i < out.length; i++) if (!sheet[i]) out[i] = false
  }
  return out
}

/**
 * Zygalski's light table: sheets stacked from the first; light passes only where every stacked sheet has a hole.
 * Buttons or the arrow keys (on the table) add and remove sheets. data-shown and data-apertures (lit cells of the
 * size × size table) describe the state.
 */
export function LightTable(p: LightTableProps): JSX.Element {
  const { size, sheets } = p
  const testId = p.testId ?? 'light-table'
  const shown = Math.max(0, Math.min(p.shown, sheets.length))
  const open = stackedApertures(sheets, size, shown)
  const count = open.filter(Boolean).length
  let d = ''
  open.forEach((on, i) => {
    if (on) d += `M${(i % size) * CELL + 1} ${Math.floor(i / size) * CELL + 1}h${CELL - 2}v${CELL - 2}h${2 - CELL}z`
  })
  const set = (n: number) => p.onShown(Math.max(0, Math.min(sheets.length, n)))
  const onKey = (e: KeyboardEvent) => {
    const keys: Record<string, number> = { ArrowUp: shown + 1, ArrowRight: shown + 1, ArrowDown: shown - 1,
      ArrowLeft: shown - 1, Home: 0, End: sheets.length }
    if (e.key in keys) {
      e.preventDefault()
      set(keys[e.key]!)
    }
  }
  const side = size * CELL
  const label = `Light table: ${shown} of ${sheets.length} sheets stacked, ${count} apertures let light through.`
  return (
    <figure className="m-0 flex min-w-0 flex-col gap-2" data-testid={testId} data-shown={shown} data-apertures={count}>
      <div role="group" tabIndex={0} onKeyDown={onKey} data-testid={`${testId}-table`}
        aria-label={`${label} Arrow keys add or remove sheets.`}
        className="w-full max-w-md rounded outline-none focus-visible:ring-2 focus-visible:ring-amber-400">
        <svg viewBox={`0 0 ${side} ${side}`} className="block w-full" aria-hidden="true">
          <rect width={side} height={side} className="fill-stone-800" />
          <path d={d} fill="var(--sym-signal)" />
        </svg>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <button type="button" onClick={() => set(shown - 1)} disabled={shown === 0} data-testid={`${testId}-remove`}
          className="rounded border border-stone-600 px-2 py-1 text-stone-100 hover:bg-stone-800 disabled:opacity-60">
          Remove a sheet
        </button>
        <button type="button" onClick={() => set(shown + 1)} disabled={shown === sheets.length}
          data-testid={`${testId}-add`}
          className="rounded border border-stone-600 px-2 py-1 text-stone-100 hover:bg-stone-800 disabled:opacity-60">
          Add a sheet
        </button>
        <span className="font-mono text-stone-300" data-testid={`${testId}-status`}>
          {shown} of {sheets.length} sheets · {count.toLocaleString('en-US')} apertures lit
        </span>
      </div>
    </figure>
  )
}
