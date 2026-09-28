import { useEffect, useState, type JSX } from 'react'
import type { Ghost, PartId } from '../../../contracts/stage'
import { QUIET_BUTTON, SubmitButton } from '../../ui/controls'
import { partLabel } from '../../partNames'
import type { WidgetProps } from './types'

export { partName } from '../../partNames'

/**
 * Pick the part where the faulty path first goes wrong: the part buttons, or a click on a part in the stage
 * (any element with data-part inside the stage). Nothing is drawn on the stage during the question: a ghost
 * against the reference would show the answer. The ghost appears only in the rollback, after the answer.
 */
export function GhostPickAnswer({
  instance,
  disabled,
  submit,
}: WidgetProps<{ options: readonly PartId[]; ghost: Ghost }, PartId>): JSX.Element {
  const [pick, setPick] = useState<PartId | null>(null)
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const el = (e.target as Element | null)?.closest?.('[data-testid="stage"] [data-part]')
      const part = el?.getAttribute('data-part') as PartId | null
      if (part && instance.options.includes(part) && !disabled) setPick(part)
    }
    document.addEventListener('click', onClick)
    return () => document.removeEventListener('click', onClick)
  }, [instance, disabled])
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Parts on the path">
        {instance.options.map((p) => (
          <button
            key={p}
            type="button"
            data-testid={`ghost-pick-${p}`}
            aria-pressed={pick === p}
            disabled={disabled}
            className={`${QUIET_BUTTON} ${pick === p ? 'border-amber-400 text-amber-200' : ''}`}
            onClick={() => setPick(p)}
          >
            {partLabel(p)}
          </button>
        ))}
      </div>
      <div>
        <SubmitButton disabled={disabled || !pick} onClick={() => pick && submit(pick)} />
      </div>
    </div>
  )
}
