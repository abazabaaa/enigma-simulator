import { useLayoutEffect, useRef, type JSX } from 'react'
import { Color, type BufferGeometry, type InstancedMesh, type Material, type Matrix4 } from 'three'

const _c = new Color()

/** An instanced mesh with fixed per-instance matrices (and optional colours): contacts, markers. */
export function StaticInstances({
  geometry,
  material,
  matrices,
  colors,
  name,
  userData,
}: {
  geometry: BufferGeometry
  material: Material
  matrices: readonly Matrix4[]
  colors?: readonly string[]
  name?: string
  userData?: Record<string, unknown>
}): JSX.Element {
  const ref = useRef<InstancedMesh>(null)
  const count = matrices.length
  useLayoutEffect(() => {
    const m = ref.current
    if (!m) return
    matrices.forEach((mat, i) => m.setMatrixAt(i, mat))
    if (colors) colors.forEach((c, i) => m.setColorAt(i, _c.set(c)))
    m.instanceMatrix.needsUpdate = true
    if (m.instanceColor) m.instanceColor.needsUpdate = true
    m.computeBoundingSphere()
  }, [matrices, colors])
  return <instancedMesh key={count} ref={ref} name={name} args={[geometry, material, count]} userData={userData} />
}
