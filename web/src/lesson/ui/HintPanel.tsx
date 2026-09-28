import type { JSX } from 'react'
import type { HintLevel, ItemUi } from '../../contracts/lesson'
import type { Highlight } from '../../contracts/stage'
import { partList } from '../partNames'
import { BUTTON } from './controls'

/**
 * The hint ladder (rule 4): L1 names the highlighted parts (the stage shows them); L2 adds a worked example
 * on a different instance; L3 shows the current instance's solution, and "Got it" is the only control.
 */
export function HintPanel(p: {
  level: HintLevel
  ui: ItemUi
  highlights: readonly Highlight[]
  worked: { seed: number; instance: unknown; solution: unknown } | null
  current: unknown
  solution: unknown
  onGotIt(): void
}): JSX.Element | null {
  if (p.level === 0) return null
  const { Worked } = p.ui
  return (
    <section
      data-testid="hint-panel"
      data-hint-level={p.level}
      className="rounded-md border border-sky-700/60 bg-sky-950/30 p-3 text-sm"
    >
      {p.level < 3 ? (
        <p className="text-sky-200">
          Hint:{' '}
          {p.highlights.length
            ? `look at the highlighted ${partList(p.highlights.map((h) => h.part))}.`
            : 'take it one step at a time.'}
        </p>
      ) : null}
      {p.level === 2 && p.worked ? (
        <div
          data-testid="worked-example"
          data-seed={p.worked.seed}
          className="mt-2 rounded border border-stone-700 p-2"
        >
          <p className="mb-1 text-xs text-stone-400">A worked example on a different instance:</p>
          <Worked instance={p.worked.instance} solution={p.worked.solution} />
        </div>
      ) : null}
      {p.level === 3 ? (
        <div className="flex flex-col gap-2">
          <p className="text-sky-200">Here is how this one works out. Read it, then try a fresh instance.</p>
          <div data-testid="worked-example" data-seed="current" className="rounded border border-stone-700 p-2">
            <Worked instance={p.current} solution={p.solution} />
          </div>
          <div>
            <button type="button" data-testid="gate-continue" className={BUTTON} onClick={p.onGotIt}>
              Got it: next instance
            </button>
          </div>
        </div>
      ) : null}
    </section>
  )
}
