// @vitest-environment happy-dom
import ReactThreeTestRenderer from '@react-three/test-renderer'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { Material, Mesh, Object3D, Scene } from 'three'
import {
  ALL_PARTS,
  STAGE_PRESETS,
  dimmedParts,
  resolveStage,
  type PartId,
  type StageDirective,
} from '../contracts/stage'
import { LETTERS, isAtTurnover, type MachineConfigInput } from '../engine'
import { useMachineStore } from '../state/machineStore'
import { usePlaybackStore } from '../state/playbackStore'
import { useStageStore } from '../state/stageStore'
import { DIM_OPACITY, HALO_OPACITY } from './focus'
import { stepAngle, makeLayout } from './layout'
import { pawlAngle } from './parts/Pawls'
import { Machine3DScene } from './Scene'
import { useStageView } from './useStageView'

const I: MachineConfigInput = {
  model: 'I',
  reflector: 'B',
  rotors: ['I', 'II', 'III'],
  rings: 'AAA',
  positions: 'ADU',
  plugboard: 'AV BS CG',
}
const M4: MachineConfigInput = {
  model: 'M4',
  reflector: 'B-thin',
  rotors: ['Beta', 'II', 'IV', 'I'],
  rings: 'AAAV',
  positions: 'VJNA',
}

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

function Connected({ directive, reducedMotion = false }: { directive: StageDirective; reducedMotion?: boolean }) {
  const state = useStageView(directive.source)
  return <Machine3DScene directive={directive} reducedMotion={reducedMotion} state={state} />
}

let renderer: Awaited<ReturnType<typeof ReactThreeTestRenderer.create>> | null = null

async function mount(directive: StageDirective, reducedMotion = false): Promise<Scene> {
  renderer = await ReactThreeTestRenderer.create(<Connected directive={directive} reducedMotion={reducedMotion} />)
  return renderer.scene.instance as unknown as Scene
}

const act = (fn: () => void) => ReactThreeTestRenderer.act(async () => fn())

const named = (scene: Scene, name: string): Object3D => {
  const o = scene.getObjectByName(name)
  if (!o) throw new Error(`no object named ${name}`)
  return o
}

/** Every mesh tagged with a part, with its material(s). */
function partMeshes(scene: Scene): { part: PartId | 'scenery'; materials: Material[] }[] {
  const out: { part: PartId | 'scenery'; materials: Material[] }[] = []
  scene.traverse((o) => {
    const part = o.userData.part as PartId | 'scenery' | undefined
    const m = (o as Mesh).material
    if (!part || !m || !(o as Mesh).isMesh) return
    out.push({ part, materials: Array.isArray(m) ? m : [m] })
  })
  return out
}

beforeEach(() => {
  const s = useMachineStore.getState()
  s.setLocks({})
  s.setConfig(I)
  usePlaybackStore.setState({ t: 0, hops: 0, playing: false })
  useStageStore.setState({ highlight: [], ghost: null })
})

afterEach(async () => {
  await renderer?.unmount()
  renderer = null
})

describe('Machine3DScene', () => {
  it('has 26 key and 26 lamp instances, and 26 plugboard sockets', async () => {
    const scene = await mount(STAGE_PRESETS.overview)
    const instances = (name: string) => named(scene, name).children.filter((c) => c.name)
    expect(
      instances('key-caps')
        .map((c) => c.name)
        .sort(),
    ).toEqual(LETTERS.map((l) => `key-${l}`).sort())
    expect(
      instances('lamps')
        .map((c) => c.name)
        .sort(),
    ).toEqual(LETTERS.map((l) => `lamp-${l}`).sort())
    expect(instances('sockets')).toHaveLength(26)
    const plugged = instances('sockets')
      .filter((c) => c.userData.plugged)
      .map((c) => c.userData.letter)
    expect(plugged.sort()).toEqual(['A', 'B', 'C', 'G', 'S', 'V'])
  })

  it('has 3 rotors, or 4 on the M4, each with a ring and a core', async () => {
    let scene = await mount(STAGE_PRESETS.rotors)
    const rotors = (s: Scene) => named(s, 'rotor-stack').children.map((c) => c.name)
    expect(rotors(scene)).toEqual(['rotor-left', 'rotor-middle', 'rotor-right'])
    await renderer!.unmount()
    await act(() => useMachineStore.getState().setConfig(M4))
    scene = await mount(STAGE_PRESETS.rotors)
    expect(rotors(scene)).toEqual(['rotor-greek', 'rotor-left', 'rotor-middle', 'rotor-right'])
    for (const slot of ['greek', 'left', 'middle', 'right']) {
      expect(named(scene, `ring-${slot}`).parent?.name).toBe(`rotor-${slot}`)
      expect(named(scene, `core-${slot}`).parent?.name).toBe(`rotor-${slot}`)
    }
    expect(scene.getObjectByName('notch-greek')).toBeUndefined()
    expect(scene.getObjectByName('pawl-greek')).toBeUndefined()
    expect(named(scene, 'pawl-left').userData.engaged).toBe(isAtTurnover('IV', 'N'))
  })

  it('setting the ring turns the core but not the ring glyphs at a fixed window', async () => {
    const scene = await mount(STAGE_PRESETS['rotor-layers'])
    const l = makeLayout({ n: 26, slots: ['left', 'middle', 'right'], toy: false })
    const ring = () => named(scene, 'ring-right').rotation.x
    const core = () => named(scene, 'core-right').rotation.x
    const ring0 = ring()
    const core0 = core()
    expect(ring0).toBeCloseTo(20 * stepAngle(l), 12) // window U
    expect(core0).toBeCloseTo(20 * stepAngle(l), 12) // ring 01
    for (const [letter, k] of [
      ['C', 2],
      ['Z', 25],
      ['A', 0],
    ] as const) {
      await act(() => useMachineStore.getState().setRing(2, letter))
      expect(useMachineStore.getState().machine.positions).toEqual([0, 3, 20])
      expect(ring()).toBe(ring0)
      expect(core()).toBeCloseTo(core0 - k * stepAngle(l), 12)
    }
  })

  it('a pawl is engaged exactly when isAtTurnover, for all 26 positions of rotor II', async () => {
    const scene = await mount(STAGE_PRESETS.pawls)
    for (let p = 0; p < 26; p++) {
      await act(() => useMachineStore.getState().setPositions(`A${LETTERS[p]}A`))
      // the left pawl rests on the middle rotor (II)'s notch ring
      const pawl = named(scene, 'pawl-left')
      const engaged = isAtTurnover('II', p)
      expect(pawl.userData.engaged, `II at ${LETTERS[p]}`).toBe(engaged)
      expect(pawl.rotation.x).toBeCloseTo(pawlAngle(engaged), 12)
      expect(named(scene, 'pawl-right').userData.engaged).toBe(true)
    }
    expect(pawlAngle(true)).not.toBeCloseTo(pawlAngle(false), 3)
  })

  it('interpolates the stepping rotor during the stepping phase', async () => {
    const scene = await mount(STAGE_PRESETS.rotors)
    const l = makeLayout({ n: 26, slots: ['left', 'middle', 'right'], toy: false })
    await act(() => {
      useMachineStore.getState().pressKey('A')
      usePlaybackStore.setState({ t: 0.5, hops: 11, playing: false })
    })
    expect(named(scene, 'ring-right').rotation.x).toBeCloseTo(20.5 * stepAngle(l), 12)
    expect(named(scene, 'ring-right').userData.window).toBe(20)
    await act(() => usePlaybackStore.setState({ t: 1, hops: 11 }))
    expect(named(scene, 'ring-right').rotation.x).toBeCloseTo(21 * stepAngle(l), 12)
    expect(named(scene, 'ring-middle').rotation.x).toBeCloseTo(3 * stepAngle(l), 12)
  })

  it.each(['overview', 'wire', 'pawls', 'rotor-layers', 'reflector', 'plugboard'] as const)(
    'focus %s: exactly the dimmedParts are transparent at 0.25; every present part is drawn',
    async (preset) => {
      const directive = resolveStage({ preset, with: { lid: 'closed', plugboard: true } })
      const scene = await mount(directive)
      const dimmed = new Set(dimmedParts(directive.focus, 'I'))
      const meshes = partMeshes(scene)
      expect(new Set(meshes.map((m) => m.part))).toEqual(new Set([...ALL_PARTS('I'), 'scenery']))
      for (const { part, materials } of meshes) {
        const dim = part === 'scenery' ? dimmed.size > 0 : dimmed.has(part)
        for (const m of materials) {
          expect(m.opacity, part).toBe(dim ? DIM_OPACITY : 1)
          if (dim) expect(m.transparent, part).toBe(true)
        }
      }
    },
  )

  it('labels the parts in focus, in names or symbols', async () => {
    const labels = (s: Scene) => {
      const out: string[] = []
      s.getObjectByName('labels')?.traverse((o) => {
        if (o.userData.label) out.push(o.userData.label as string)
      })
      return out
    }
    let scene = await mount(STAGE_PRESETS.wire)
    expect(labels(scene).sort()).toEqual(
      [
        'Keyboard',
        'Lampboard',
        'Plugboard',
        'Entry wheel',
        'Left rotor I',
        'Middle rotor II',
        'Right rotor III',
        'Reflector B',
      ].sort(),
    )
    await renderer!.unmount()
    scene = await mount(STAGE_PRESETS.symbols)
    expect(labels(scene).sort()).toEqual(['H', 'L', 'M', 'N', 'S', 'U'])
    await renderer!.unmount()
    scene = await mount(STAGE_PRESETS.overview)
    expect(labels(scene)).toEqual([])
    await renderer!.unmount()
    scene = await mount(STAGE_PRESETS.pawls)
    expect(labels(scene).sort()).toEqual(['Notch', 'Notch', 'Notch', 'Pawl', 'Pawl', 'Pawl'])
  })

  it('draws a halo and a tint on highlighted parts', async () => {
    const scene = await mount(STAGE_PRESETS.pawls)
    await act(() => useStageStore.getState().setHighlight([{ part: 'notch-right', tone: 'hint' }]))
    expect(scene.getObjectByName('halo-notch-right')).toBeDefined()
    const notch = named(scene, 'notch-right') as Mesh
    expect((notch.material as Material).userData.tone).toBe('hint')
    await act(() => useStageStore.getState().setHighlight([]))
    expect(scene.getObjectByName('halo-notch-right')).toBeUndefined()
  })

  it('pulses a highlight, or holds a static outline under reduced motion', async () => {
    for (const reducedMotion of [false, true]) {
      const scene = await mount(STAGE_PRESETS.pawls, reducedMotion)
      await act(() => useStageStore.getState().setHighlight([{ part: 'notch-right', tone: 'error' }]))
      const tint = (named(scene, 'notch-right') as Mesh).material as Material & { emissiveIntensity: number }
      const halo = (named(scene, 'halo-notch-right') as Mesh).material as Material
      const samples: number[][] = []
      for (let i = 0; i < 3; i++) {
        await renderer!.advanceFrames(1, 0.2)
        samples.push([tint.emissiveIntensity, halo.opacity])
      }
      if (reducedMotion)
        expect(samples).toEqual([
          [0.7, HALO_OPACITY],
          [0.7, HALO_OPACITY],
          [0.7, HALO_OPACITY],
        ])
      else {
        expect(new Set(samples.map((s) => s[0])).size).toBe(3)
        expect(new Set(samples.map((s) => s[1])).size).toBe(3)
      }
      await act(() => useStageStore.getState().setHighlight([]))
      await renderer!.unmount()
      renderer = null
    }
  })

  it('lights the lamp of the last press once the path is played', async () => {
    const scene = await mount(STAGE_PRESETS.wire)
    let lamp = ''
    await act(() => {
      lamp = useMachineStore.getState().pressKey('A').output
      usePlaybackStore.setState({ t: 5, hops: 11 })
    })
    expect(named(scene, 'lamp-glow').visible).toBe(false)
    await act(() => usePlaybackStore.setState({ t: 12, hops: 11 }))
    const glow = named(scene, 'lamp-glow') as Mesh
    expect(glow.visible).toBe(true)
    expect(glow.userData.lit).toBe(lamp)
    const m = glow.material as Material & { emissiveIntensity: number; toneMapped: boolean }
    expect(m.emissiveIntensity).toBeGreaterThan(1)
    expect(m.toneMapped).toBe(false)
  })
})
