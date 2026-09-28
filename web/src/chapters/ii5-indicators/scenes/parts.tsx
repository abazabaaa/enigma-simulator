/**
 * Small views shared by the chapter's scenes and items: indicators as they were written, one indicator with a
 * pair of letters picked out, and the fill-in table of AD whose outlined cells are the learner's.
 */

import { useEffect, useRef, type JSX, type KeyboardEvent, type ReactNode } from 'react'
import { LETTERS } from '../../../engine'
import { spaced } from '../gates'

/** The three letter pairs of a doubled key: 1 & 4, 2 & 5, 3 & 6. */
export const PAIR_TONE = ['text-amber-200', 'text-sky-200', 'text-emerald-200'] as const
const PAIR_RING = ['border-amber-400/70', 'border-sky-400/70', 'border-emerald-400/70'] as const

/** Indicators in a wrapping grid, 'AUQ AMN', numbered; `current` is outlined. */
export function IndicatorChips(p: {
  indicators: readonly string[]
  current?: number
  label: string
  testId?: string
}): JSX.Element {
  return (
    <ol
      aria-label={p.label}
      data-testid={p.testId}
      className="grid grid-cols-[repeat(auto-fill,minmax(6.5rem,1fr))] gap-1 font-mono text-sm"
    >
      {p.indicators.map((s, k) => (
        <li
          key={k}
          data-testid={p.testId ? `${p.testId}-${k}` : undefined}
          data-current={k === p.current ? 'true' : undefined}
          className={`rounded border px-1.5 py-0.5 ${k === p.current ? 'border-amber-300 bg-amber-400/10 text-amber-100' : 'border-stone-700 text-stone-200'}`}
        >
          <span className="mr-1 text-xs text-stone-400">{k + 1}.</span>
          {spaced(s)}
        </li>
      ))}
    </ol>
  )
}

/** One indicator with letters `pos` and `pos + 3` emphasised (the pair that fills one cell). */
export function IndicatorPair({ indicator, pos }: { indicator: string; pos: 0 | 1 | 2 }): JSX.Element {
  return (
    <span className="font-mono tracking-wider" aria-label={`${spaced(indicator)}: letters ${pos + 1} and ${pos + 4}`}>
      {[...indicator].map((c, k) => (
        <span key={k}>
          {k === 3 ? ' ' : ''}
          <span
            className={
              k === pos || k === pos + 3
                ? `rounded border px-0.5 font-semibold ${PAIR_TONE[pos]} ${PAIR_RING[pos]}`
                : 'text-stone-400'
            }
          >
            {c}
          </span>
        </span>
      ))}
    </span>
  )
}

/**
 * AD as a two-row table: the letters A–Z on top; below, the outlined target cells are one-letter inputs and every
 * other cell shows `known` (or '·'). Below 640 px it wraps into two rows of 13 (A–M, N–Z), so every cell stays on
 * screen and large enough to tap. Typing a letter moves on to the next target; Backspace clears; arrows move.
 */
export function FillTable(p: {
  targets: readonly number[]
  values: readonly string[]
  onChange(k: number, v: string): void
  known?: readonly (string | null)[]
  wrong?: readonly number[]
  disabled?: boolean
  testId: string
  label: string
}): JSX.Element {
  const inputs = useRef<(HTMLInputElement | null)[]>([])
  const focus = (k: number) => inputs.current[Math.max(0, Math.min(p.targets.length - 1, k))]?.focus()
  const wrong = new Set(p.wrong ?? [])
  const onKey = (k: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault()
      focus(k + (e.key === 'ArrowLeft' ? -1 : 1))
    } else if (e.key === 'Backspace' || e.key === 'Delete') {
      e.preventDefault()
      p.onChange(k, '')
    } else if (/^[a-zA-Z]$/.test(e.key)) {
      e.preventDefault()
      p.onChange(k, e.key.toUpperCase())
      focus(k + 1)
    }
  }
  const box = 'h-8 border-r border-b border-stone-700 text-center font-mono text-sm'
  return (
    <div
      role="group"
      aria-label={p.label}
      data-testid={p.testId}
      className="grid w-full max-w-[46rem] grid-cols-[repeat(13,minmax(1.35rem,1fr))] border-t border-l border-stone-700 sm:grid-cols-[repeat(26,minmax(1.5rem,1fr))]"
    >
      {LETTERS.map((l, x) => {
        const k = p.targets.indexOf(x)
        const head = (
          <div aria-hidden="true" className={`${box} bg-stone-900 leading-8 text-stone-300`}>
            {l}
          </div>
        )
        if (k === -1) {
          const v = p.known?.[x] ?? null
          return (
            <div key={l} className="flex flex-col" aria-hidden="true">
              {head}
              <div data-testid={`${p.testId}-cell-${x}`} data-value={v ?? ''} className={`${box} leading-8 text-stone-400`}>
                {v ?? '·'}
              </div>
            </div>
          )
        }
        const v = p.values[k] ?? ''
        return (
          <div key={l} className="flex flex-col">
            {head}
            <div
              data-testid={`${p.testId}-cell-${x}`}
              data-target="true"
              data-value={v}
              data-wrong={wrong.has(x) ? 'true' : undefined}
              className={`${box} outline-2 -outline-offset-2 ${wrong.has(x) ? 'outline-red-400' : 'outline-amber-300'} text-stone-100`}
            >
              <input
                ref={(el) => {
                  inputs.current[k] = el
                }}
                data-testid={`${p.testId}-input-${l}`}
                value={v}
                disabled={p.disabled}
                maxLength={1}
                aria-label={`The letter AD sends ${l} to`}
                autoComplete="off"
                spellCheck={false}
                onKeyDown={(e) => onKey(k, e)}
                onChange={(e) => {
                  const typed = e.target.value.toUpperCase().replace(/[^A-Z]/g, '')
                  p.onChange(k, typed.slice(-1))
                }}
                className="h-full w-full bg-transparent text-center uppercase caret-amber-300 focus:bg-stone-800 focus:outline-none disabled:opacity-60"
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}

/**
 * The indicator that defines a cell, sliding into it: letters 1 and 4 of `indicator` become the cell `from → to`.
 * With reduced motion it simply appears.
 */
export function DefiningPair(p: { indicator: string; typed: string; reducedMotion: boolean; testId: string }): JSX.Element {
  const ref = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el || p.reducedMotion || typeof el.animate !== 'function') return
    const a = el.animate(
      [
        { transform: 'translateX(-1.5rem)', opacity: 0.2 },
        { transform: 'translateX(0)', opacity: 1 },
      ],
      { duration: 700, easing: 'ease-out', delay: 150 },
    )
    return () => a.cancel()
  }, [p.reducedMotion])
  const from = p.indicator[0]!
  const to = p.indicator[3]!
  return (
    <li data-testid={p.testId} className="flex flex-wrap items-center gap-2">
      <IndicatorPair indicator={p.indicator} pos={0} />
      <span aria-hidden="true">⇒</span>
      <span ref={ref} className="inline-flex items-center gap-1 rounded border border-amber-400/70 px-1.5 font-mono">
        {from} → <strong className="text-amber-200">{to}</strong>
      </span>
      <span className="text-stone-400">
        (you typed <span className="font-mono">{p.typed || 'nothing'}</span>)
      </span>
    </li>
  )
}

/**
 * A 26-column table at full size: on a narrow screen it scrolls sideways instead of squeezing its cells (machine-ui's
 * PermTable shrinks its cells to fit the width).
 */
export function Wide({ children }: { children: ReactNode }): JSX.Element {
  return (
    <div className="relative flex min-w-0 flex-col gap-1">
      <div className="max-w-full overflow-x-auto">
        <div className="min-w-[46rem]">{children}</div>
      </div>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-0 right-0 bottom-6 w-10 bg-gradient-to-l from-stone-950 to-transparent sm:hidden"
      />
      <p aria-hidden="true" className="text-xs text-stone-400 sm:hidden">
        Scroll sideways for N–Z →
      </p>
    </div>
  )
}
