/**
 * Plug cables while the plugboard is hidden (review round 1, N3): with plugs set, the path still runs
 * along the cable of a plugged letter — as the 2D view still crosses its plugboard column — so the
 * cables it runs along are drawn faintly and the glowing tube does not swoop through empty space.
 * One geometry holds every plugged pair's cable as a group; a key press only switches which groups
 * draw (at most two), so nothing is built or freed per press. Dimmed with the plugboard part.
 */

import { memo, useLayoutEffect, useMemo, type JSX } from 'react'
import { MeshBasicMaterial, MeshStandardMaterial } from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { usePartMaterial } from '../focus'
import type { Layout } from '../layout'
import { CABLE_SEGMENTS, CABLE_SIDES } from '../parts/Cables'
import { tubeAlong } from './mesh'
import { cablePath, wirePairs } from './route'
import { crossedCables, useSignal } from './useSignal'

const RADIUS = 0.1
const COLOR = '#8a7560'

export const FaintCables = memo(function FaintCables({
  layout,
  plugs,
}: {
  layout: Layout
  plugs: readonly number[]
}): JSX.Element | null {
  const plugKey = plugs.join()
  const pairs = useMemo(() => wirePairs(plugs), [plugKey])
  const geometry = useMemo(() => {
    if (!pairs.length) return null
    const tubes = pairs.map(([a, b]) => tubeAlong(cablePath(layout, a, b), RADIUS, CABLE_SEGMENTS, CABLE_SIDES))
    const merged = mergeGeometries(tubes, true)
    for (const t of tubes) t.dispose()
    return merged
  }, [layout, pairs])
  useLayoutEffect(() => () => geometry?.dispose(), [geometry])
  const faint = usePartMaterial(
    'plugboard',
    () =>
      new MeshStandardMaterial({ color: COLOR, transparent: true, opacity: 0.45, depthWrite: false, roughness: 0.6 }),
  )
  const hidden = useMemo(() => new MeshBasicMaterial({ visible: false }), [])
  useLayoutEffect(() => () => hidden.dispose(), [hidden])
  const materials = useMemo(() => [faint, hidden], [faint, hidden])

  const shown = crossedCables(useSignal())
  const shownKey = shown.map((p) => p.join('-')).join()
  useLayoutEffect(() => {
    if (!geometry) return
    geometry.groups.forEach((g, i) => {
      const [a, b] = pairs[i]!
      g.materialIndex = shown.some(([x, y]) => x === a && y === b) ? 0 : 1
    })
    // shownKey stands for shown
  }, [geometry, pairs, shownKey])

  if (!geometry) return null
  return (
    <mesh
      name="signal-faint-cables"
      geometry={geometry}
      material={materials}
      frustumCulled={false}
      userData={{ part: 'plugboard', pairs, shown }}
    />
  )
})
