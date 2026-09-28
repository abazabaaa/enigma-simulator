/**
 * The entry wheel (Eintrittswalze, H): a fixed disc right of the right rotor, with n contacts on each
 * face in its symbol colour. On the Enigma I it is wired A→A, so the path's letters do not change.
 */

import { memo, useMemo, type JSX } from 'react'
import { Matrix4, MeshStandardMaterial, Quaternion, Vector3 } from 'three'
import { usePartMaterial } from '../focus'
import { discX } from '../geometry'
import { useGeometry } from '../hooks'
import { AXIS_Y, AXIS_Z, ETW, contactPoint, etwX, type Layout } from '../layout'
import { PALETTE, swatch } from '../palette'
import { StaticInstances } from '../StaticInstances'

const ONE = new Vector3(1, 1, 1)
const NONE = new Quaternion()

export const Etw = memo(function Etw({ layout }: { layout: Layout }): JSX.Element {
  const x = etwX(layout)
  const disc = useGeometry(() => discX(ETW.r, -ETW.width / 2, ETW.width / 2, 48), [])
  const pin = useGeometry(() => discX(0.2, -0.12, 0.12, 12), [])
  const body = usePartMaterial('etw', () => new MeshStandardMaterial({ color: PALETTE.core, roughness: 0.6, metalness: 0.3 }))
  const contacts = usePartMaterial(
    'etw',
    () => new MeshStandardMaterial({ color: swatch('H'), roughness: 0.35, metalness: 0.6 }),
  )
  const matrices = useMemo(() => {
    const out: Matrix4[] = []
    for (const face of ['in', 'out'] as const) {
      for (let k = 0; k < layout.n; k++) {
        const p = contactPoint(layout, 'etw', face, k, 0)
        out.push(new Matrix4().compose(new Vector3(p.x, p.y, p.z), NONE, ONE))
      }
    }
    return out
  }, [layout])
  return (
    <group name="etw" userData={{ part: 'etw' }}>
      <mesh name="etw-disc" geometry={disc} material={body} position={[x, AXIS_Y, AXIS_Z]} userData={{ part: 'etw' }} />
      <StaticInstances name="etw-contacts" geometry={pin} material={contacts} matrices={matrices} userData={{ part: 'etw' }} />
    </group>
  )
})
