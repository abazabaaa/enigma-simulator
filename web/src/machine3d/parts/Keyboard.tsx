/**
 * The keyboard: 26 keys (n on a toy) as drei <Instances> on stems, letters on the caps. A click
 * presses the key through the store — the one write path (PLAN §2.5) — when the directive is
 * interactive and the keyboard is not locked. The key being played is held down.
 */

import { Instance, Instances } from '@react-three/drei'
import type { ThreeEvent } from '@react-three/fiber'
import { memo, useMemo, type JSX } from 'react'
import { MeshStandardMaterial, Quaternion, Vector3 } from 'three'
import type { Letter } from '../../engine'
import { usePartMaterial } from '../focus'
import { GlyphMesh, type GlyphItem } from '../glyphs'
import { DECK, keyPosition, type Layout } from '../layout'
import { PALETTE } from '../palette'

const FACE_UP = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), -Math.PI / 2)
const PRESS_DEPTH = 0.45
const CAP_H = 0.5

export interface KeyboardProps {
  readonly layout: Layout
  readonly letters: readonly Letter[]
  readonly pressedKey: number | null
  /** Called with the key's letter when a click should press it (undefined: keys are inert). */
  readonly onPress?: (letter: Letter) => void
}

export const Keyboard = memo(function Keyboard({ layout, letters, pressedKey, onPress }: KeyboardProps): JSX.Element {
  const caps = usePartMaterial(
    'keyboard',
    () => new MeshStandardMaterial({ color: PALETTE.keyCap, roughness: 0.45, metalness: 0.1 }),
  )
  const stems = usePartMaterial(
    'keyboard',
    () => new MeshStandardMaterial({ color: PALETTE.keyStem, roughness: 0.5, metalness: 0.6 }),
  )
  const n = letters.length
  const glyphs = useMemo(
    (): GlyphItem[] =>
      letters.map((letter, k) => {
        const p = keyPosition(layout, k)
        const down = k === pressedKey ? PRESS_DEPTH : 0
        return { glyph: letter, position: [p.x, p.y - down + 0.01, p.z], quaternion: FACE_UP, size: 1.25, color: PALETTE.glyphLight }
      }),
    [layout, letters, pressedKey],
  )
  const click = (letter: Letter) => (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    onPress?.(letter)
  }
  const hover = (on: boolean) => () => {
    if (onPress && typeof document !== 'undefined') document.body.style.cursor = on ? 'pointer' : ''
  }
  return (
    <group name="keyboard" userData={{ part: 'keyboard' }}>
      <Instances key={`caps-${n}`} name="key-caps" limit={n} range={n} material={caps}>
        <cylinderGeometry args={[DECK.keyR, DECK.keyR * 0.96, CAP_H, 32]} />
        {letters.map((letter, k) => {
          const p = keyPosition(layout, k)
          const down = k === pressedKey ? PRESS_DEPTH : 0
          return (
            <Instance
              key={letter}
              name={`key-${letter}`}
              position={[p.x, p.y - CAP_H / 2 - down, p.z]}
              userData={{ letter }}
              onClick={click(letter)}
              onPointerOver={hover(true)}
              onPointerOut={hover(false)}
            />
          )
        })}
      </Instances>
      <Instances key={`stems-${n}`} name="key-stems" limit={n} range={n} material={stems}>
        <cylinderGeometry args={[0.22, 0.22, DECK.keyTopY - CAP_H, 8]} />
        {letters.map((letter, k) => {
          const p = keyPosition(layout, k)
          const down = k === pressedKey ? PRESS_DEPTH : 0
          return <Instance key={letter} position={[p.x, (DECK.keyTopY - CAP_H) / 2 - down, p.z]} />
        })}
      </Instances>
      <GlyphMesh name="key-letters" items={glyphs} part="keyboard" />
    </group>
  )
})
