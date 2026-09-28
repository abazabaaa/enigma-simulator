/**
 * The plugboard on the front panel: 26 double sockets (n on a toy) as drei <Instances>, lettered in
 * keyboard order. Plugged sockets show the plugboard's symbol colour (S); PR 11 adds the cables.
 */

import { Instance, Instances } from '@react-three/drei'
import { memo, useMemo, type JSX } from 'react'
import { CylinderGeometry, MeshStandardMaterial, Quaternion } from 'three'
import type { Letter } from '../../engine'
import { usePartMaterial } from '../focus'
import { box, merge } from '../geometry'
import { GlyphMesh, type GlyphItem } from '../glyphs'
import { useGeometry } from '../hooks'
import { DECK, socketPosition, type Layout } from '../layout'
import { PALETTE, swatch } from '../palette'

const IDENTITY = new Quaternion()

function socketGeometry() {
  const hole = (dy: number) => {
    const g = new CylinderGeometry(0.34, 0.34, 0.16, 20)
    g.rotateX(Math.PI / 2)
    g.translate(0, dy, 0)
    return g
  }
  return merge([hole(DECK.socketHoleDy), hole(-DECK.socketHoleDy)])
}

export interface SocketsProps {
  readonly layout: Layout
  readonly letters: readonly Letter[]
  /** Involution on n; a socket i with plugs[i] ≠ i is plugged. */
  readonly plugs: readonly number[]
}

export const Sockets = memo(function Sockets({ layout, letters, plugs }: SocketsProps): JSX.Element {
  const n = letters.length
  const plate = useGeometry(() => {
    const xs = letters.map((_, k) => socketPosition(layout, k))
    const x0 = Math.min(...xs.map((p) => p.x)) - 1.6
    const x1 = Math.max(...xs.map((p) => p.x)) + 1.6
    const y0 = Math.min(...xs.map((p) => p.y)) - 1.2
    const y1 = Math.max(...xs.map((p) => p.y)) + 1.9
    return merge([box(x0, x1, y0, y1, DECK.panelZ, DECK.panelZ + 0.06)])
  }, [layout, n])
  const holes = useGeometry(socketGeometry, [])
  const plateMaterial = usePartMaterial(
    'plugboard',
    () => new MeshStandardMaterial({ color: PALETTE.metalDark, roughness: 0.6, metalness: 0.3 }),
  )
  const socketMaterial = usePartMaterial('plugboard', () => new MeshStandardMaterial({ roughness: 0.4, metalness: 0.2 }))
  const glyphs = useMemo(
    (): GlyphItem[] =>
      letters.map((letter, k) => {
        const p = socketPosition(layout, k)
        return { glyph: letter, position: [p.x, p.y + 1.1, DECK.panelZ + 0.08], quaternion: IDENTITY, size: 0.8, color: PALETTE.glyphLight }
      }),
    [layout, letters],
  )
  const plugged = swatch('S')
  return (
    <group name="plugboard" userData={{ part: 'plugboard' }}>
      <mesh name="plugboard-plate" geometry={plate} material={plateMaterial} userData={{ part: 'plugboard' }} />
      <Instances key={`sockets-${n}`} name="sockets" limit={n} range={n} geometry={holes} material={socketMaterial}>
        {letters.map((letter, k) => {
          const p = socketPosition(layout, k)
          const isPlugged = (plugs[k] ?? k) !== k
          return (
            <Instance
              key={letter}
              name={`socket-${letter}`}
              position={[p.x, p.y, DECK.panelZ + 0.1]}
              color={isPlugged ? plugged : PALETTE.socket}
              userData={{ letter, plugged: isPlugged }}
            />
          )
        })}
      </Instances>
      <GlyphMesh name="socket-letters" items={glyphs} part="plugboard" />
    </group>
  )
})
