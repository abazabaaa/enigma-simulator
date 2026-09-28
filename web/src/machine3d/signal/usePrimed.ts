/**
 * Visibility for meshes that come and go with the signal (the head, a lit reflector pair, a lit
 * cable). three.js uploads a geometry (and counts it in renderer.info.memory.geometries) the first
 * time the mesh is drawn, so a mesh first shown on the tenth key press would add a geometry then.
 * A primed mesh is drawn once, empty, when it mounts; after that it shows only when asked to, and
 * the geometry count does not change over key presses. The prime is React state (never a direct
 * write to mesh.visible), so the `visible` prop R3F applies always says what the mesh shows.
 */

import { useState } from 'react'

export interface Primed {
  readonly visible: boolean
  readonly onAfterRender: () => void
}

export function usePrimed(visible: boolean): Primed {
  const [primed, setPrimed] = useState(false)
  return {
    visible: visible || !primed,
    onAfterRender: () => {
      if (!primed) setPrimed(true)
    },
  }
}
