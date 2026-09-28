import { useRef, useState, type JSX } from 'react'
import { INPUT, SubmitButton } from '../../ui/controls'
import type { WidgetProps } from './types'

/** `instance.length` letters in segmented boxes; typing moves on, pasting fills every box. */
export function LettersAnswer({
  instance,
  disabled,
  submit,
}: WidgetProps<{ length: number; alphabet?: number }, string>): JSX.Element {
  const length = instance.length
  const n = instance.alphabet ?? 26
  const last = String.fromCharCode(64 + n)
  const [cells, setCells] = useState<string[]>(() => Array.from({ length }, () => ''))
  const refs = useRef<(HTMLInputElement | null)[]>([])
  const valid = cells.every((c) => c.length === 1 && c <= last)
  const clean = (s: string) => s.toUpperCase().replace(/[^A-Z]/g, '')
  const put = (k: number, text: string) => {
    const letters = clean(text)
    if (!letters) {
      setCells((c) => c.map((x, j) => (j === k ? '' : x)))
      return
    }
    setCells((c) => {
      const next = [...c]
      for (let j = 0; j < letters.length && k + j < length; j++) next[k + j] = letters[j]!
      return next
    })
    refs.current[Math.min(length - 1, k + letters.length)]?.focus()
  }
  // Groups of 3 (window triples) never break inside at narrow widths; only whole groups wrap.
  const size = length % 3 === 0 && length > 3 ? 3 : length
  const groups = Array.from({ length: Math.ceil(length / size) }, (_, g) => g * size)
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault()
        if (valid && !disabled) submit(cells.join(''))
      }}
    >
      <fieldset
        className="flex flex-wrap gap-x-3 gap-y-2"
        aria-label={`Answer: ${length} letters A to ${last}`}
        disabled={disabled}
      >
        {groups.map((start) => (
          <div key={start} className="flex shrink-0 flex-nowrap gap-1" data-testid="answer-letters-group">
            {cells.slice(start, start + size).map((c, j) => {
              const k = start + j
              return (
                <input
                  key={k}
                  ref={(el) => {
                    refs.current[k] = el
                  }}
                  data-testid={`answer-letters-${k}`}
                  aria-label={`Letter ${k + 1} of ${length}`}
                  className={`${INPUT} w-9 text-center uppercase`}
                  value={c}
                  autoComplete="off"
                  onChange={(e) => put(k, e.target.value.slice(c ? 1 : 0) || e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Backspace' && !c && k > 0) refs.current[k - 1]?.focus()
                  }}
                  onPaste={(e) => {
                    e.preventDefault()
                    put(k, e.clipboardData.getData('text'))
                  }}
                />
              )
            })}
          </div>
        ))}
      </fieldset>
      <div>
        <SubmitButton form disabled={disabled || !valid} />
      </div>
    </form>
  )
}
