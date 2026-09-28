/**
 * Plug cables (PLAN §2.6, brief 11): one cable per plugged pair, from the plug in one socket to the
 * plug in its partner, sagging in front of the panel (signal/route.ts cablePath). Rendered by the
 * scene only while the directive shows the plugboard; dimmed with the plugboard.
 * The signal crosses the plugboard twice: on the way in (plugboard-in: the key's socket → its
 * partner) and on the way out (plugboard-out: a partner → the lamp's socket). A cable it crosses is
 * lit: the glowing signal tube runs along that very cable, and the mesh records the pairs
 * (userData.lit) once the signal gets there. One draw call: every cable and plug, in vertex colours.
 */

import { memo, useLayoutEffect, useMemo, type JSX } from 'react'
import { MeshStandardMaterial } from 'three'
import { usePartMaterial } from '../focus'
import { box } from '../geometry'
import { DECK, socketPosition, type Layout } from '../layout'
import { swatch } from '../palette'
import { mergeColored, tubeAlong } from '../signal/mesh'
import { PLUG_FRONT_Z, cablePath, wirePairs } from '../signal/route'
import { hopShown, useSignal, type SignalState } from '../signal/useSignal'

export interface CablesProps {
  readonly layout: Layout
  /** The plugboard as an involution on layout.n; plugs[i] ≠ i means i is cabled to plugs[i]. */
  readonly plugs: readonly number[]
}

const CABLE_RADIUS = 0.12
/** Tessellation of a cable (segments along it, sides around it). */
export const CABLE_SEGMENTS = 28
export const CABLE_SIDES = 6
const CABLE_COLOR = '#8a7560'
const PLUG_COLOR = '#1f1b18'

/** A plug body over both holes of socket k, and its pins' collar in the plugboard colour. */
function plugGeometry(layout: Layout, k: number) {
  const s = socketPosition(layout, k)
  return [
    {
      geometry: box(s.x - 0.45, s.x + 0.45, s.y - 0.95, s.y + 0.95, DECK.panelZ + 0.12, PLUG_FRONT_Z),
      color: PLUG_COLOR,
    },
    {
      geometry: box(s.x - 0.5, s.x + 0.5, s.y - 1.0, s.y + 1.0, DECK.panelZ + 0.06, DECK.panelZ + 0.2),
      color: swatch('S'),
    },
  ]
}

/** The cable a plugboard hop crosses once the signal gets there, or null (an unplugged letter). */
function crossed(s: SignalState, index: number): [number, number] | null {
  if (!hopShown(s, index)) return null
  const h = s.hops[index]!
  if (h.kind !== 'plugboard' || h.inputIndex === h.outputIndex) return null
  return [Math.min(h.inputIndex, h.outputIndex), Math.max(h.inputIndex, h.outputIndex)]
}

export const Cables = memo(function Cables({ layout, plugs }: CablesProps): JSX.Element {
  const plugKey = plugs.join()
  const pairs = useMemo(() => wirePairs(plugs), [plugKey])
  const merged = useMemo(
    () =>
      mergeColored([
        ...pairs.map(([a, b]) => ({
          geometry: tubeAlong(cablePath(layout, a, b), CABLE_RADIUS, CABLE_SEGMENTS, CABLE_SIDES),
          color: CABLE_COLOR,
        })),
        ...pairs.flatMap(([a, b]) => [...plugGeometry(layout, a), ...plugGeometry(layout, b)]),
      ]),
    [layout, pairs],
  )
  useLayoutEffect(() => () => merged.geometry.dispose(), [merged])
  const material = usePartMaterial(
    'plugboard',
    () => new MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.2 }),
  )

  // The way in (hop 0) and the way out (the last hop); the same cable when key and lamp are partners.
  const signal = useSignal()
  const lit: [number, number][] = []
  for (const index of [0, signal.hops.length - 1]) {
    const pair = crossed(signal, index)
    if (pair && !lit.some(([a, b]) => a === pair[0] && b === pair[1])) lit.push(pair)
  }

  return (
    <mesh name="cables" geometry={merged.geometry} material={material} userData={{ part: 'plugboard', pairs, lit }} />
  )
})
