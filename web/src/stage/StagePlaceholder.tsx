import type { JSX } from 'react'
import { dimmedParts, type StageDirective } from '../contracts/stage'
import { useMachine } from '../state/activeMachine'

/** Shown while the 2D view is still the 02 stub: prints the directive as text. */
export function StagePlaceholder({ directive }: { directive: StageDirective }): JSX.Element {
  const model = useMachine((s) => s.machine.config.model)
  const dimmed = dimmedParts(directive.focus, model)
  const rows: [string, string][] = [
    ['source', directive.source],
    ['shot', directive.shot],
    ['focus', directive.focus],
    ['lid', directive.lid],
    ['trace', directive.trace],
    ['labels', directive.labels],
    ['ring layer', String(directive.ringLayer)],
    ['plugboard', String(directive.plugboard)],
    ['interactive', String(directive.interactive)],
  ]
  return (
    <div
      data-testid="stage-placeholder"
      className="rounded-lg border border-dashed border-stone-700 p-4 font-mono text-xs text-stone-400"
    >
      <p className="mb-2 text-stone-300">Stage placeholder: the machine view is on its way.</p>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-0.5">
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-stone-500">{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
        <dt className="text-stone-500">dimmed</dt>
        <dd className="break-words">{dimmed.length ? dimmed.join(', ') : 'nothing'}</dd>
      </dl>
    </div>
  )
}
