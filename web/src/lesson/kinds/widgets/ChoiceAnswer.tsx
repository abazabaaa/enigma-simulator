import { useId, useState, type JSX } from 'react'
import type { Choice } from '../../../contracts/core'
import { SubmitButton } from '../../ui/controls'
import type { WidgetProps } from './types'

/** A radio group over `instance.options`. */
export function ChoiceAnswer({
  instance,
  disabled,
  submit,
}: WidgetProps<{ options: readonly Choice[] }, string>): JSX.Element {
  const [v, setV] = useState<string | null>(null)
  const name = useId()
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault()
        if (v && !disabled) submit(v)
      }}
    >
      <fieldset className="flex flex-col gap-2" disabled={disabled}>
        <legend className="sr-only">Choose one answer</legend>
        {instance.options.map((o) => (
          <label
            key={o.id}
            className="flex cursor-pointer items-start gap-2 rounded-md border border-stone-700 p-2 text-sm hover:border-stone-500"
          >
            <input
              type="radio"
              name={name}
              data-testid={`answer-choice-${o.id}`}
              className="mt-1"
              checked={v === o.id}
              onChange={() => setV(o.id)}
            />
            <span>{o.label}</span>
          </label>
        ))}
      </fieldset>
      <div>
        <SubmitButton form disabled={disabled || !v} />
      </div>
    </form>
  )
}
