/**
 * Plug cables (PLAN §2.6, brief 11): one cable per plugged pair, from the plug in one socket to the
 * plug in its partner, sagging in front of the panel (signal/route.ts cablePath). Rendered by the
 * scene only while the directive shows the plugboard; dimmed with the plugboard.
 * The signal crosses the plugboard twice, on the way in (plugboard-in: key's socket → partner) and
 * on the way out (plugboard-out: partner → lamp's socket): a cable it runs along lights up in the
 * signal's glow once the signal gets there, and the glowing tube follows the same line.
 * Draw calls: every cable and plug (vertex colours), and one per lit cable (at most two). The lit
 * copies are fixed geometries shown through a draw range, so nothing is rebuilt per key press.
 */

import { useThree } from '@react-three/fiber'
import { memo, useLayoutEffect, useMemo, type JSX } from 'react'
import { MeshStandardMaterial } from 'three'
import { usePartMaterial } from '../focus'
import { box } from '../geometry'
import { DECK, socketPosition, type Layout } from '../layout'
import { markChange } from '../monitor'
import { swatch } from '../palette'
import { glowMaterial } from '../signal/materials'
import { mergeColored, showRange, tubeAlong, type Merged } from '../signal/mesh'
import { PLUG_FRONT_Z, cablePath, wirePairs } from '../signal/route'
import { usePrimed } from '../signal/usePrimed'
import { hopShown, useSignal } from '../signal/useSignal'

export interface CablesProps {
  readonly layout: Layout
  /** The plugboard as an involution on layout.n; plugs[i] ≠ i means i is cabled to plugs[i]. */
  readonly plugs: readonly number[]
}

const CABLE_RADIUS = 0.12
const LIT_RADIUS = 0.14
const CABLE_SEGMENTS = 40
const CABLE_COLOR = '#8a7560'
const PLUG_COLOR = '#1f1b18'

function cableTubes(layout: Layout, pairs: readonly (readonly [number, number])[], radius: number) {
  return pairs.map(([a, b]) => tubeAlong(cablePath(layout, a, b), radius, CABLE_SEGMENTS, 8))
}

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

/** The lit cable of one plugboard hop, or null (an unplugged letter crosses no cable). */
function litPair(s: ReturnType<typeof useSignal>, index: number): readonly [number, number] | null {
  if (!hopShown(s, index)) return null
  const h = s.hops[index]!
  if (h.kind !== 'plugboard' || h.inputIndex === h.outputIndex) return null
  return [Math.min(h.inputIndex, h.outputIndex), Math.max(h.inputIndex, h.outputIndex)]
}

function LitCable({
  name,
  merged,
  pairs,
  lit,
}: {
  name: string
  merged: Merged
  pairs: readonly (readonly [number, number])[]
  lit: readonly [number, number] | null
}): JSX.Element {
  const glow = usePartMaterial('plugboard', glowMaterial)
  const invalidate = useThree((s) => s.invalidate)
  const index = lit ? pairs.findIndex(([a, b]) => a === lit[0] && b === lit[1]) : -1
  const primed = usePrimed(index >= 0)
  useLayoutEffect(() => {
    showRange(merged, index >= 0 ? index : null)
    markChange()
    invalidate()
  }, [merged, index, invalidate])
  return (
    <mesh
      name={name}
      geometry={merged.geometry}
      material={glow}
      visible={primed.visible}
      onAfterRender={primed.onAfterRender}
      userData={{ part: 'plugboard', lit: index >= 0 ? lit : null }}
    />
  )
}

export const Cables = memo(function Cables({ layout, plugs }: CablesProps): JSX.Element {
  const plugKey = plugs.join()
  const pairs = useMemo(() => wirePairs(plugs), [plugKey])
  const cables = useMemo(
    () =>
      mergeColored([
        ...cableTubes(layout, pairs, CABLE_RADIUS).map((geometry) => ({ geometry, color: CABLE_COLOR })),
        ...pairs.flatMap(([a, b]) => [...plugGeometry(layout, a), ...plugGeometry(layout, b)]),
      ]),
    [layout, pairs],
  )
  // One lit copy per plugboard crossing: in and out may light two different cables.
  const litIn = useMemo(
    () => mergeColored(cableTubes(layout, pairs, LIT_RADIUS).map((geometry) => ({ geometry, color: null }))),
    [layout, pairs],
  )
  const litOut = useMemo(
    () => mergeColored(cableTubes(layout, pairs, LIT_RADIUS).map((geometry) => ({ geometry, color: null }))),
    [layout, pairs],
  )
  useLayoutEffect(() => () => cables.geometry.dispose(), [cables])
  useLayoutEffect(() => () => litIn.geometry.dispose(), [litIn])
  useLayoutEffect(() => () => litOut.geometry.dispose(), [litOut])
  const material = usePartMaterial(
    'plugboard',
    () => new MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.2 }),
  )

  const signal = useSignal()
  const last = signal.hops.length - 1
  const inPair = litPair(signal, 0)
  const outPair = last > 0 ? litPair(signal, last) : null

  return (
    <group name="cables-group">
      <mesh name="cables" geometry={cables.geometry} material={material} userData={{ part: 'plugboard', pairs }} />
      <LitCable name="cables-lit-in" merged={litIn} pairs={pairs} lit={inPair} />
      <LitCable name="cables-lit-out" merged={litOut} pairs={pairs} lit={outPair} />
    </group>
  )
})
