/**
 * A keyboard-operable ARIA spinbutton over the integers min…max (wrapping, like a rotor):
 * ArrowUp/ArrowDown ±1, PageUp/PageDown ±5, Home/End, plus `onType` for typed characters.
 * The small ▲/▼ buttons are for pointers only (tabIndex −1), so each spinbutton is one tab stop.
 */

import type { JSX, KeyboardEvent, ReactNode } from 'react'

export interface SpinbuttonProps {
  readonly testId: string
  readonly label: string
  readonly value: number
  readonly min: number
  readonly max: number
  /** aria-valuetext and the visible text. */
  readonly text: string
  readonly disabled?: boolean
  readonly onChange: (value: number) => void
  /**
   * Arrows, PageUp/PageDown and ▲/▼ step by `delta`. With onStep the owner applies the step to the
   * stored value (the shown value may lag behind it, e.g. a window showing stepping.before);
   * without it the step is applied to `value`.
   */
  readonly onStep?: (delta: number) => void
  /** A printable key typed on the spinbutton; return true when it was used. */
  readonly onType?: (key: string) => boolean
  readonly size?: 'lg' | 'sm'
  readonly caption?: ReactNode
}

export function wrap(value: number, min: number, max: number): number {
  const span = max - min + 1
  return ((((value - min) % span) + span) % span) + min
}

export function Spinbutton(p: SpinbuttonProps): JSX.Element {
  const { min, max, value, disabled } = p
  const change = (next: number) => {
    if (!disabled) p.onChange(wrap(next, min, max))
  }
  const step = (delta: number) => {
    if (disabled) return
    if (p.onStep) p.onStep(delta)
    else change(value + delta)
  }

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const steps: Record<string, number> = { ArrowUp: 1, ArrowDown: -1, PageUp: 5, PageDown: -5 }
    if (e.key in steps) {
      e.preventDefault()
      step(steps[e.key]!)
      return
    }
    if (e.key === 'Home' || e.key === 'End') {
      e.preventDefault()
      change(e.key === 'Home' ? min : max)
      return
    }
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      // Typed characters never reach the physical-keyboard listener from here.
      e.preventDefault()
      if (!disabled) p.onType?.(e.key)
    }
  }

  const big = p.size !== 'sm'
  const arrow = `flex w-full items-center justify-center rounded text-xs text-stone-300 hover:bg-stone-700 disabled:opacity-40 ${big ? 'h-6' : 'h-5'}`

  return (
    <div className="flex flex-col items-center gap-0.5">
      <button type="button" tabIndex={-1} aria-label={`${p.label}: up`} disabled={disabled} onClick={() => step(1)} className={arrow}>
        ▲
      </button>
      <div
        role="spinbutton"
        tabIndex={0}
        aria-label={p.label}
        aria-valuenow={value}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuetext={p.text}
        aria-disabled={disabled ? 'true' : undefined}
        data-testid={p.testId}
        onKeyDown={onKeyDown}
        className={`flex items-center justify-center rounded border font-mono select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300 ${
          big ? 'h-10 w-10 text-2xl' : 'h-7 w-10 text-sm'
        } ${disabled ? 'border-stone-700 bg-stone-900 text-stone-400' : 'border-stone-400 bg-stone-100 text-stone-950'}`}
      >
        {p.text}
      </div>
      <button type="button" tabIndex={-1} aria-label={`${p.label}: down`} disabled={disabled} onClick={() => step(-1)} className={arrow}>
        ▼
      </button>
      {p.caption}
    </div>
  )
}
