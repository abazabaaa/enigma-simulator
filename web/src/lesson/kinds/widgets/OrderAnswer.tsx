import { useRef, useState, type JSX, type KeyboardEvent } from 'react'
import type { Choice } from '../../../contracts/core'
import { QUIET_BUTTON, SubmitButton } from '../../ui/controls'
import type { WidgetProps } from './types'

/**
 * A Parsons list with plain list semantics (review M2): each block has a grab button (answer-order-grab-<id>;
 * Alt+↑ / Alt+↓ moves it, ↑ / ↓ move between blocks) and ↑ / ↓ buttons; blocks can also be dragged. Every move
 * is announced in a polite live region, and focus follows the moved block.
 */
export function OrderAnswer({
  instance,
  disabled,
  submit,
}: WidgetProps<{ blocks: readonly Choice[] }, string[]>): JSX.Element {
  const [order, setOrder] = useState<string[]>(() => instance.blocks.map((b) => b.id))
  const [said, setSaid] = useState('')
  const drag = useRef<number | null>(null)
  const grabs = useRef<Record<string, HTMLButtonElement | null>>({})
  const label = (id: string) => instance.blocks.find((b) => b.id === id)?.label ?? id
  const focus = (id: string | undefined) => {
    if (id) queueMicrotask(() => grabs.current[id]?.focus())
  }
  const move = (from: number, to: number) => {
    if (disabled || to < 0 || to >= order.length || from === to) return
    const next = [...order]
    const [id] = next.splice(from, 1)
    next.splice(to, 0, id!)
    setOrder(next)
    setSaid(`${label(id!)} moved to position ${to + 1} of ${next.length}.`)
    focus(id)
  }
  const onKey = (k: number) => (e: KeyboardEvent) => {
    if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
      e.preventDefault()
      move(k, e.key === 'ArrowUp' ? k - 1 : k + 1)
    } else if (!e.altKey && e.key === 'ArrowUp') {
      e.preventDefault()
      focus(order[Math.max(0, k - 1)])
    } else if (!e.altKey && e.key === 'ArrowDown') {
      e.preventDefault()
      focus(order[Math.min(order.length - 1, k + 1)])
    }
  }
  return (
    <div className="flex flex-col gap-3">
      <p id="order-help" className="text-xs text-stone-400">
        Put the blocks in order: focus a block and press Alt+↑ or Alt+↓, use the arrow buttons, or drag.
      </p>
      <ol aria-label="Blocks to put in order" data-testid="answer-order" className="flex flex-col gap-1">
        {order.map((id, k) => (
          <li
            key={id}
            data-testid={`answer-order-${id}`}
            data-index={k}
            draggable={!disabled}
            onDragStart={() => (drag.current = k)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault()
              if (drag.current !== null) move(drag.current, k)
              drag.current = null
            }}
            className="flex items-center gap-2 rounded-md border border-stone-700 p-2 text-sm"
          >
            <span className="w-5 font-mono text-stone-400" aria-hidden="true">
              {k + 1}.
            </span>
            <button
              type="button"
              ref={(el) => {
                grabs.current[id] = el
              }}
              data-testid={`answer-order-grab-${id}`}
              aria-label={`${label(id)}, position ${k + 1} of ${order.length}`}
              aria-describedby="order-help"
              disabled={disabled}
              onKeyDown={onKey(k)}
              className="flex-1 cursor-grab rounded px-1 text-left text-stone-200 focus:outline focus:outline-2 focus:outline-amber-400"
            >
              {label(id)}
            </button>
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
      <div role="status" aria-live="polite" className="sr-only" data-testid="answer-order-status">
        {said}
      </div>
      <div>
        <SubmitButton disabled={disabled} onClick={() => submit(order)} />
      </div>
    </div>
  )
}
