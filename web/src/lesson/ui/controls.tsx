/** Small shared controls for gates and scenes (exported to chapters through lesson/index.ts). */

import type { ButtonHTMLAttributes, JSX, ReactNode } from 'react'

export const BUTTON =
  'rounded-md border border-amber-400/60 bg-amber-400/10 px-3 py-1.5 text-sm font-medium text-amber-200 hover:bg-amber-400/20 disabled:cursor-not-allowed disabled:border-stone-700 disabled:bg-transparent disabled:text-stone-400 aria-disabled:cursor-not-allowed aria-disabled:border-stone-700 aria-disabled:bg-transparent aria-disabled:text-stone-400'
export const QUIET_BUTTON =
  'rounded-md border border-stone-600 px-3 py-1.5 text-sm text-stone-300 hover:bg-stone-800 disabled:cursor-not-allowed disabled:text-stone-600'
export const INPUT =
  'rounded-md border border-stone-600 bg-stone-900 px-2 py-1 font-mono text-stone-100 focus:border-amber-400 focus:outline-none disabled:opacity-50'

/** The gate's Submit button (test id gate-submit). Custom Answer components use it too. */
export function SubmitButton(
  p: { disabled?: boolean; onClick(): void; children?: ReactNode } & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onClick'>,
): JSX.Element {
  const { disabled, onClick, children, ...rest } = p
  return (
    <button type="button" data-testid="gate-submit" className={BUTTON} disabled={disabled} onClick={onClick} {...rest}>
      {children ?? 'Submit'}
    </button>
  )
}

/** A monospace strip of letters (tables in prompts). */
export function Mono({ children, className = '' }: { children: ReactNode; className?: string }): JSX.Element {
  return <span className={`font-mono tracking-wider ${className}`}>{children}</span>
}

/** A permutation table: the letters on top, their images below. Scrolls inside itself on narrow screens. */
export function LetterTable({ images, label, n }: { images: string; label?: ReactNode; n?: number }): JSX.Element {
  const top = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.slice(0, n ?? images.length)
  return (
    <div className="max-w-full overflow-x-auto">
      {label ? <div className="text-xs text-stone-400">{label}</div> : null}
      <pre className="font-mono text-sm leading-tight text-stone-200">
        {top}
        {'\n'}
        {images}
      </pre>
    </div>
  )
}
