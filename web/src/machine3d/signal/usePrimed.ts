/**
 * Visibility for meshes that come and go with the signal (the head, a lit reflector pair, a lit
 * cable). three.js uploads a geometry (and counts it in renderer.info.memory.geometries) the first
 * time the mesh is drawn, so a mesh first shown on the tenth key press would add a geometry then.
 * A primed mesh is drawn once, empty, when it mounts; after that it shows only when asked to, and
 * the geometry count does not change over key presses.
 */

import { useRef, type RefObject } from 'react'
import type { Object3D } from 'three'

export interface Primed<T extends Object3D> {
  readonly ref: RefObject<T | null>
  readonly visible: boolean
  readonly onAfterRender: () => void
}

export function usePrimed<T extends Object3D>(visible: boolean): Primed<T> {
  const ref = useRef<T>(null)
  const primed = useRef(false)
  const want = useRef(visible)
  want.current = visible
  return {
    ref,
    visible: visible || !primed.current,
    onAfterRender: () => {
      if (primed.current) return
      primed.current = true
      if (ref.current) ref.current.visible = want.current
    },
  }
}
