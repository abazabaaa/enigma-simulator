import type { JSX } from 'react'
import type { Sym as SymName } from './symbols'

/** A symbol in its slot colour, e.g. N or N⁻¹ (the inverse). */
export function Sym({ s, inv }: { s: SymName; inv?: boolean }): JSX.Element {
  return (
    <span className="font-mono font-semibold" style={{ color: `var(--sym-${s})` }} data-sym={s}>
      {s}
      {inv ? <sup>−1</sup> : null}
    </span>
  )
}
