import { useRef, useState, type JSX } from 'react'
import type { Choice } from '../../../contracts/core'
import { QUIET_BUTTON, SubmitButton } from '../../ui/controls'
import type { WidgetProps } from './types'

/** A Parsons list: reorder with Alt+↑/↓ on the focused block, the arrow buttons, or drag and drop. */
export function OrderAnswer({
  instance,
  disabled,
  submit,
}: WidgetProps<{ blocks: readonly Choice[] }, string[]>): JSX.Element {
  const [order, setOrder] = useState<string[]>(() => instance.blocks.map((b) => b.id))
  const [focus, setFocus] = useState(0)
  const drag = useRef<number | null>(null)
  const refs = useRef<(HTMLLIElement | null)[]>([])
  const label = (id: string) => instance.blocks.find((b) => b.id === id)?.label ?? id
  const move = (from: number, to: number) => {
    if (to < 0 || to >= order.length || from === to) return
    setOrder((o) => {
      const next = [...o]
      const [x] = next.splice(from, 1)
      next.splice(to, 0, x!)
      return next
    })
    setFocus(to)
    queueMicrotask(() => refs.current[to]?.focus())
  }
  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-stone-400">
        Put the blocks in order: focus one and press Alt+↑ or Alt+↓, use the arrows, or drag.
      </p>
      <ol
        role="listbox"
        aria-label="Blocks to put in order"
        data-testid="answer-order"
        className="flex flex-col gap-1"
        aria-activedescendant={`order-${order[focus]}`}
      >
        {order.map((id, k) => (
          <li
            key={id}
            id={`order-${id}`}
            ref={(el) => {
              refs.current[k] = el
            }}
            role="option"
            aria-selected={k === focus}
            tabIndex={k === focus ? 0 : -1}
            data-testid={`answer-order-${id}`}
            data-index={k}
            draggable={!disabled}
            onFocus={() => setFocus(k)}
            onDragStart={() => (drag.current = k)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault()
              if (drag.current !== null) move(drag.current, k)
              drag.current = null
            }}
            onKeyDown={(e) => {
              if (disabled) return
              if (e.altKey && e.key === 'ArrowUp') {
                e.preventDefault()
                move(k, k - 1)
              } else if (e.altKey && e.key === 'ArrowDown') {
                e.preventDefault()
                move(k, k + 1)
              } else if (e.key === 'ArrowUp') {
                e.preventDefault()
                refs.current[Math.max(0, k - 1)]?.focus()
              } else if (e.key === 'ArrowDown') {
                e.preventDefault()
                refs.current[Math.min(order.length - 1, k + 1)]?.focus()
              }
            }}
            className={`flex items-center gap-2 rounded-md border p-2 text-sm ${k === focus ? 'border-amber-400/70' : 'border-stone-700'}`}
          >
            <span className="w-5 font-mono text-stone-400">{k + 1}.</span>
            <span className="flex-1">{label(id)}</span>
            <button
              type="button"
              className={QUIET_BUTTON}
              aria-label={`Move ${label(id)} up`}
              disabled={disabled || k === 0}
              onClick={() => move(k, k - 1)}
            >
              ↑
            </button>
            <button
              type="button"
              className={QUIET_BUTTON}
              aria-label={`Move ${label(id)} down`}
              disabled={disabled || k === order.length - 1}
              onClick={() => move(k, k + 1)}
            >
              ↓
            </button>
          </li>
        ))}
      </ol>
      <div>
        <SubmitButton disabled={disabled} onClick={() => submit(order)} />
      </div>
    </div>
  )
}
