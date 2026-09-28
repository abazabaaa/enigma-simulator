import { useState, type JSX } from 'react'
import { INPUT, SubmitButton } from '../../ui/controls'
import type { WidgetProps } from './types'

function parseList(s: string): number[] | null {
  const parts = s.split(/[\s,;]+/).filter(Boolean)
  const nums = parts.map(Number)
  return nums.every((x) => Number.isFinite(x)) ? nums : null
}

/** `count` number fields, or a free list ('any'). */
export function NumbersAnswer({
  instance,
  disabled,
  submit,
}: WidgetProps<{ count: number | 'any' }, number[]>): JSX.Element {
  const count = instance.count
  const [fields, setFields] = useState<string[]>(() =>
    count === 'any' ? [''] : Array.from({ length: count }, () => ''),
  )
  const values = count === 'any' ? parseList(fields[0] ?? '') : fields.map((f) => (f.trim() === '' ? NaN : Number(f)))
  const valid = values !== null && values.every((x) => Number.isFinite(x)) && (count !== 'any' || true)
  const go = () => {
    if (valid && values && !disabled) submit(values)
  }
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault()
        go()
      }}
    >
      {count === 'any' ? (
        <label className="flex flex-col gap-1 text-sm text-stone-300">
          Numbers, separated by spaces or commas (leave empty for none)
          <input
            data-testid="answer-numbers"
            className={`${INPUT} w-full max-w-sm`}
            value={fields[0]}
            disabled={disabled}
            inputMode="numeric"
            autoComplete="off"
            onChange={(e) => setFields([e.target.value])}
          />
        </label>
      ) : (
        <div className="flex flex-wrap gap-2">
          {fields.map((f, k) => (
            <input
              key={k}
              data-testid={`answer-number-${k}`}
              aria-label={`Number ${k + 1} of ${count}`}
              className={`${INPUT} w-20`}
              value={f}
              disabled={disabled}
              inputMode="decimal"
              autoComplete="off"
              onChange={(e) => setFields((all) => all.map((x, j) => (j === k ? e.target.value : x)))}
            />
          ))}
        </div>
      )}
      <div>
        <SubmitButton disabled={disabled || !valid} onClick={go} />
      </div>
    </form>
  )
}
