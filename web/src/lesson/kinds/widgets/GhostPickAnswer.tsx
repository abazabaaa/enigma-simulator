import { useEffect, useState, type JSX } from 'react'
import type { Ghost, PartId } from '../../../contracts/stage'
import { useStageStore } from '../../../state/stageStore'
import { QUIET_BUTTON, SubmitButton } from '../../ui/controls'
import type { WidgetProps } from './types'

const NAMES: Partial<Record<PartId, string>> = {
  plugboard: 'Plugboard',
  etw: 'Entry wheel',
  'rotor-right': 'Right rotor',
  'rotor-middle': 'Middle rotor',
  'rotor-left': 'Left rotor',
  'rotor-greek': 'Greek rotor',
  reflector: 'Reflector',
}

export function partName(p: PartId): string {
  return NAMES[p] ?? p
}

/**
 * Pick the part where the ghost path first goes wrong: the part buttons, or a click on a part in the stage
 * (any element with data-part inside the stage). The ghost is drawn on the stage while the item is shown.
 */
export function GhostPickAnswer({
  instance,
  disabled,
  submit,
}: WidgetProps<{ options: readonly PartId[]; ghost: Ghost }, PartId>): JSX.Element {
  const [pick, setPick] = useState<PartId | null>(null)
  const setGhost = useStageStore((s) => s.setGhost)
  useEffect(() => {
    setGhost(instance.ghost)
    return () => setGhost(null)
  }, [instance, setGhost])
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
            {partName(p)}
          </button>
        ))}
      </div>
      <div>
        <SubmitButton disabled={disabled || !pick} onClick={() => pick && submit(pick)} />
      </div>
    </div>
  )
}
