import { useState, type JSX } from 'react'
import { metaOf } from '..'
import { INPUT, SubmitButton } from '../../ui/controls'
import type { WidgetProps } from './types'

/** A single letter (A–Z, or A–F / A–H for toy items). */
export function LetterAnswer({ logic, disabled, submit }: WidgetProps<unknown, string>): JSX.Element {
  const n = metaOf(logic).alphabet ?? 26
  const last = String.fromCharCode(64 + n)
  const [v, setV] = useState('')
  const valid = v.length === 1 && v >= 'A' && v <= last
  return (
    <form
      className="flex flex-wrap items-center gap-3"
      onSubmit={(e) => {
        e.preventDefault()
        if (valid && !disabled) submit(v)
      }}
    >
      <label className="flex items-center gap-2 text-sm text-stone-300">
        Lamp (A–{last})
        <input
          data-testid="answer-letter"
          aria-label={`Answer: one letter A to ${last}`}
          className={`${INPUT} w-12 text-center text-lg uppercase`}
          value={v}
          maxLength={1}
          disabled={disabled}
          autoComplete="off"
          onChange={(e) => setV(e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(-1))}
        />
      </label>
      <SubmitButton disabled={disabled || !valid} onClick={() => valid && submit(v)} />
    </form>
  )
}
