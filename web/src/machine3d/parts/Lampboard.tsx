/**
 * The lampboard: 26 lamp windows (n on a toy) as drei <Instances> with their letters. The lit lamp
 * gets a glowing disc: emissive intensity above 1 with toneMapped off, so a later Bloom pass
 * (luminanceThreshold 1) catches only it.
 */

import { Instance, Instances } from '@react-three/drei'
import { memo, useMemo, type JSX } from 'react'
import { MeshStandardMaterial, Quaternion, Vector3 } from 'three'
import type { Letter } from '../../engine'
import { usePartMaterial } from '../focus'
import { GlyphMesh, type GlyphItem } from '../glyphs'
import { DECK, lampPosition, type Layout } from '../layout'
import { PALETTE } from '../palette'

const FACE_UP = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), -Math.PI / 2)
const LAMP_H = 0.3
export const LIT_INTENSITY = 3

export interface LampboardProps {
  readonly layout: Layout
  readonly letters: readonly Letter[]
  readonly litLamp: number | null
}

export const Lampboard = memo(function Lampboard({ layout, letters, litLamp }: LampboardProps): JSX.Element {
  const windows = usePartMaterial(
    'lampboard',
    () => new MeshStandardMaterial({ color: PALETTE.lampOff, roughness: 0.25, metalness: 0 }),
  )
  const glow = usePartMaterial(
    'lampboard',
    () =>
      new MeshStandardMaterial({
        color: PALETTE.lampLit,
        emissive: PALETTE.lampLit,
        emissiveIntensity: LIT_INTENSITY,
        toneMapped: false,
      }),
  )
  const n = letters.length
  const glyphs = useMemo(
    (): GlyphItem[] =>
      letters.map((letter, k) => {
        const p = lampPosition(layout, k)
        const color = k === litLamp ? PALETTE.glyphDark : '#292524'
        return { glyph: letter, position: [p.x, p.y + 0.08, p.z], quaternion: FACE_UP, size: 1.15, color }
      }),
    [layout, letters, litLamp],
  )
  const lit = litLamp === null ? null : lampPosition(layout, litLamp)
  return (
    <group name="lampboard" userData={{ part: 'lampboard' }}>
      <Instances key={`lamps-${n}`} name="lamps" limit={n} range={n} material={windows}>
        <cylinderGeometry args={[DECK.lampR, DECK.lampR, LAMP_H, 32]} />
        {letters.map((letter, k) => {
          const p = lampPosition(layout, k)
          return <Instance key={letter} name={`lamp-${letter}`} position={[p.x, p.y - LAMP_H / 2, p.z]} userData={{ letter }} />
        })}
      </Instances>
      <mesh
        name="lamp-glow"
        material={glow}
        visible={lit !== null}
        position={lit ? [lit.x, lit.y + 0.02, lit.z] : [0, 0, 0]}
        userData={{ part: 'lampboard', lit: litLamp === null ? null : letters[litLamp] }}
      >
        <cylinderGeometry args={[DECK.lampR * 1.02, DECK.lampR * 1.02, 0.06, 32]} />
      </mesh>
      <GlyphMesh name="lamp-letters" items={glyphs} part="lampboard" />
    </group>
  )
})
