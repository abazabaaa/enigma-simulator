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

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const moves: Record<string, number> = { ArrowUp: value + 1, ArrowDown: value - 1, PageUp: value + 5, PageDown: value - 5 }
    let next: number | null = null
    if (e.key in moves) next = moves[e.key]!
    else if (e.key === 'Home') next = min
    else if (e.key === 'End') next = max
    if (next !== null) {
      e.preventDefault()
      change(next)
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
      <button type="button" tabIndex={-1} aria-label={`${p.label}: up`} disabled={disabled} onClick={() => change(value + 1)} className={arrow}>
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
      <button type="button" tabIndex={-1} aria-label={`${p.label}: down`} disabled={disabled} onClick={() => change(value - 1)} className={arrow}>
        ▼
      </button>
      {p.caption}
    </div>
  )
}
