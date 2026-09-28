/**
 * How much of the signal is drawn at playback time t (PLAN §3.2 timing, §2.5). PURE, and the same
 * rule as the 2D view (stage2d), so both report the same StageReport.pathPoints:
 *  - nothing with trace 'off', before the first press, or while lampsHidden conceals the path;
 *  - 'animate': nothing during the stepping phase [0, 1); hop k grows on [1+k, 2+k) from the
 *    previous point (the key, or hop k−1's exit) through the hop; the lamp lead is added once lit
 *    (t ≥ 1 + hops);
 *  - 'static': the whole path once the stepping phase is over (t ≥ 1), nothing before;
 *  - reduced motion: playback is instant, so t is at the end and the whole path shows at once.
 * pathPoints = 2 + 2·(hops drawn): a partly drawn live hop counts as drawn, and the lamp lead is
 * counted from the moment the last hop is live.
 */

import { hopAt, isLit } from '../../contracts/machine'
import type { StageDirective } from '../../contracts/stage'
import { pieceAnchors } from './route'

export interface TraceClock {
  readonly trace: StageDirective['trace']
  /** A press is on show. */
  readonly hasPress: boolean
  /** lampsHidden: the path would give the lamp away. */
  readonly conceal: boolean
  /** Playback time of the press on show, in [0, 1 + hops]. */
  readonly t: number
  readonly hops: number
}

const shown = (c: TraceClock): boolean => c.trace !== 'off' && !c.conceal && c.hasPress && c.hops > 0

/** Hops drawn (a partly drawn live hop counts). */
export function hopsDrawn(c: TraceClock): number {
  if (!shown(c)) return 0
  if (c.trace === 'static') return c.t >= 1 ? c.hops : 0
  return Math.max(0, hopAt(c.t, c.hops) + 1)
}

/** StageReport.pathPoints for this many drawn hops: 2 when nothing is drawn. */
export function pathPointCount(drawn: number): number {
  return 2 + 2 * Math.max(0, drawn)
}

/**
 * The drawn fraction of the route's length, given u[i] = the fraction at anchor i (pathPoints order):
 * 0 when nothing is drawn, 1 when the whole path (lamp lead included) is.
 */
export function drawnFraction(u: readonly number[], c: TraceClock): number {
  if (!shown(c) || u.length < 2) return 0
  if (c.t < 1) return 0
  if (c.trace === 'static' || isLit(c.t, c.hops)) return 1
  const k = Math.min(c.hops - 1, Math.floor(c.t - 1))
  const [a, b] = pieceAnchors(k)
  const ua = u[a] ?? 0
  const ub = u[b] ?? 1
  return ua + (c.t - 1 - k) * (ub - ua)
}

/** The moving head shows while an animated path is being drawn (hidden once the lamp is lit). */
export function headVisible(c: TraceClock): boolean {
  return shown(c) && c.trace === 'animate' && c.t >= 1 && !isLit(c.t, c.hops)
}
