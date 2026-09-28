/**
 * Props of the crypto views (PLAN §3.11). Every view is SVG plus a few DOM controls, keyboard-operable, coloured
 * through the slot tokens var(--sym-*), and carries a data-testid (default: its kebab-case name; override with
 * `testId` when a page shows two) with data-* attributes that e2e specs read instead of pixels.
 */

import type { Letter } from '../engine'
import type { CatalogueStats } from '../crypto/catalogue'
import type { Menu, MenuEdge } from '../crypto/menu'
import type { WireState } from '../crypto/bombe'

export interface CycleDiagramProps {
  /** The permutation to draw as cycles (letters A…). */
  readonly perm: readonly number[]
  /** Alphabet size (default perm.length). */
  readonly n?: number
  /** A cycle (letter indices) to emphasise, e.g. the one a learner miscounted. */
  readonly highlightCycle?: readonly number[]
  /** Relabel point i as relabelBy[i] in place: the drawing then shows conjugate(perm, relabelBy), same geometry. */
  readonly relabelBy?: readonly number[]
  /** Makes each letter a button (Enter/Space or click) reporting its point index. */
  onPickLetter?(i: number): void
  readonly testId?: string
}

export interface CycleAlignProps {
  /** Two cycles of equal length (letter indices, in cycle order). */
  readonly a: readonly number[]
  readonly b: readonly number[]
  /** b is shifted `offset` places under a (mod its length) … */
  readonly offset: number
  /** … and read backwards from its first letter when `reversed` (see alignmentPairs). */
  readonly reversed: boolean
  /** Arrow keys / buttons change the offset; R or the button toggles the direction. */
  onChange(offset: number, reversed: boolean): void
  readonly testId?: string
}

export interface CatalogueHistogramProps {
  readonly stats: CatalogueStats
  /** A bucket size to mark, as a decimal string (e.g. String(catalogue.get(key)?.length ?? 0)). */
  readonly highlight?: string
  readonly testId?: string
}

export interface LightTableProps {
  /** Sheets of size × size apertures (true = hole), row-major. */
  readonly sheets: readonly (readonly boolean[])[]
  readonly size: 51
  /** How many sheets (from the first) are stacked; only apertures open on every stacked sheet let light through. */
  readonly shown: number
  onShown(n: number): void
  readonly testId?: string
}

export interface CribStripProps {
  readonly cipher: string
  readonly crib: string
  /** 0-based position of the crib's first letter under the cipher. */
  readonly offset: number
  /** Arrow keys (and the buttons) move the crib; omitted or readOnly = display only. */
  onOffset?(o: number): void
  readonly readOnly?: boolean
  readonly testId?: string
}

export interface MenuGraphProps {
  /** The edges drawn (the learner's menu). */
  readonly menu: Menu
  /** Edges that may be added (e.g. the whole crib's menu); Enter or click on one calls onAddEdge(pos). */
  readonly available?: readonly MenuEdge[]
  onAddEdge?(pos: number): void
  /** Delete/Backspace (or the button) on a drawn edge calls onRemoveEdge(pos). */
  onRemoveEdge?(pos: number): void
  /** Letters of a loop to emphasise, in order. */
  readonly highlightLoop?: readonly Letter[]
  /** Crib positions to flag (e.g. at or past the middle rotor's turnover). */
  readonly warnings?: readonly number[]
  readonly testId?: string
}

export interface WireGridProps {
  readonly state: WireState
  /** Show only the first `step` events of state.order (default: all), to replay the propagation. */
  readonly step?: number
  /** Draw the diagonal board's joins. */
  readonly diagonal: boolean
  /** The bank read by the test register (its row is marked). */
  readonly testLetter: Letter
  /** Makes each cell a button (grid with arrow-key navigation) reporting (bank, wire). */
  onToggleWire?(bank: number, wire: number): void
  readonly testId?: string
}

export interface TestRegisterProps {
  /** The test bank's wires (length n). */
  readonly live: readonly boolean[]
  readonly testLetter: Letter
  readonly testId?: string
}
