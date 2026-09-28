// @vitest-environment happy-dom
import ReactThreeTestRenderer from '@react-three/test-renderer'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { BufferGeometry, Material, Mesh, MeshBasicMaterial, MeshStandardMaterial, Object3D, Scene } from 'three'
import { STAGE_PRESETS, resolveStage, type StageDirective } from '../../contracts/stage'
import { LETTERS, createMachine, pressKey, type Letter, type MachineConfigInput } from '../../engine'
import { createRng } from '../../lib/rng'
import { randomToy, toySlots } from '../../lib/toy'
import { DEMO_CONFIGS, demoGhost } from '../../pages/StageLabPage'
import { useMachineStore } from '../../state/machineStore'
import { usePlaybackStore } from '../../state/playbackStore'
import { useStageStore } from '../../state/stageStore'
import { useToyStore } from '../../state/toyStore'
import { useUiStore } from '../../state/uiStore'
import { BLOOM } from '../effects'
import { makeLayout, pathPoints } from '../layout'
import { swatch } from '../palette'
import { Machine3DScene } from '../Scene'
import { useSignalReport } from '../signalReport'
import { useStageView } from '../useStageView'
import { buildCurve } from './curve'
import { signalRoute } from './route'
;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const I: MachineConfigInput = DEMO_CONFIGS.I // plugboard AV BS CG
const M4: MachineConfigInput = DEMO_CONFIGS.M4

function Connected({ directive }: { directive: StageDirective }) {
  const state = useStageView(directive.source)
  return <Machine3DScene directive={directive} reducedMotion={false} state={state} />
}

let renderer: Awaited<ReturnType<typeof ReactThreeTestRenderer.create>> | null = null

async function mount(directive: StageDirective): Promise<Scene> {
  renderer = await ReactThreeTestRenderer.create(<Connected directive={directive} />)
  const scene = renderer.scene.instance as unknown as Scene
  // The test renderer never draws: do what the first WebGL frame does for meshes that come and go
  // with the signal (usePrimed.ts), which are drawn once, empty, and then hidden until needed.
  await act(() =>
    scene.traverse((o) => {
      if (o.visible) (o.onAfterRender as () => void)()
    }),
  )
  return scene
}

const act = (fn: () => void) => ReactThreeTestRenderer.act(async () => fn())

const named = (scene: Scene, name: string): Object3D => {
  const o = scene.getObjectByName(name)
  if (!o) throw new Error(`no object named ${name}`)
  return o
}
const meshNamed = (scene: Scene, name: string) => named(scene, name) as Mesh<BufferGeometry, Material>
const pathPointsReported = () => useSignalReport.getState().pathPoints

/** Press a key on the machine store and pin the playback clock to that press at time t. */
async function pressAt(letter: Letter, t: number) {
  await act(() => {
    const s = useMachineStore.getState()
    s.pressKey(letter)
    const { seq, last } = useMachineStore.getState()
    usePlaybackStore.setState({ source: 'machine', seq, hops: last!.trace.length, t, playing: false })
  })
}

const at = async (t: number) => act(() => usePlaybackStore.setState({ t }))

beforeEach(() => {
  const s = useMachineStore.getState()
  s.setLocks({})
  s.setConfig(I)
  usePlaybackStore.setState({ source: 'machine', seq: 0, t: 0, hops: 0, playing: false, gated: false, speed: 1 })
  useStageStore.setState({ highlight: [], ghost: null })
})

afterEach(async () => {
  await renderer?.unmount()
  renderer = null
})

describe('the live signal', () => {
  it('reports pathPoints by the 2D rule and draws the tube up to t, with the head on the live hop', async () => {
    const scene = await mount(STAGE_PRESETS.wire)
    expect(pathPointsReported()).toBe(2)
    await pressAt('A', 0.5)
    const tube = meshNamed(scene, 'signal-live')
    const head = named(scene, 'signal-head')
    expect(pathPointsReported()).toBe(2)
    expect(tube.visible).toBe(false)
    expect(head.visible).toBe(false)
    const u = tube.userData.anchorsU as number[]
    expect(u).toHaveLength(24)
    let drawn = 0
    for (let k = 0; k < 11; k++) {
      await at(1.5 + k)
      expect(pathPointsReported(), `hop ${k}`).toBe(2 + 2 * (k + 1))
      expect(tube.visible).toBe(true)
      expect(tube.geometry.drawRange.count).toBeGreaterThan(drawn)
      drawn = tube.geometry.drawRange.count
      const f = tube.userData.fraction as number
      expect(f).toBeGreaterThan(u[2 * k]!)
      expect(f).toBeLessThan(u[2 * k + 2]!)
      expect(head.visible).toBe(true)
      expect(tube.userData.drawn).toBe(k + 1)
    }
    await at(12)
    expect(pathPointsReported()).toBe(24)
    expect(tube.geometry.drawRange.count).toBe(tube.geometry.index!.count)
    expect(head.visible).toBe(false)
  })

  it('the head moves left through the forward rotors and right through the backward ones', async () => {
    const scene = await mount(STAGE_PRESETS.wire)
    await pressAt('Q', 1)
    const head = named(scene, 'signal-head')
    const xs: number[] = []
    for (const k of [2, 3, 4, 6, 7, 8]) {
      await at(1.5 + k)
      xs.push(head.position.x)
    }
    expect(xs[1]!).toBeLessThan(xs[0]!)
    expect(xs[2]!).toBeLessThan(xs[1]!)
    expect(xs[4]!).toBeGreaterThan(xs[3]!)
    expect(xs[5]!).toBeGreaterThan(xs[4]!)
  })

  it('glows: signal colour, emissive intensity above 1, not tone mapped', async () => {
    const scene = await mount(STAGE_PRESETS.wire)
    await pressAt('A', 12)
    for (const name of ['signal-live', 'signal-head']) {
      const m = meshNamed(scene, name).material as MeshStandardMaterial
      expect(m.emissiveIntensity, name).toBeGreaterThan(1)
      expect(m.toneMapped, name).toBe(false)
    }
    const m = meshNamed(scene, 'signal-live').material as MeshStandardMaterial
    expect(`#${m.emissive.getHexString()}`).toBe(swatch('signal'))
  })

  it('under reduced motion a press draws the whole path at once', async () => {
    const saved = useUiStore.getState().reducedMotion
    useUiStore.setState({ reducedMotion: true })
    try {
      const scene = await mount(STAGE_PRESETS.wire)
      await act(() => {
        useMachineStore.getState().pressKey('E')
        const { seq, last } = useMachineStore.getState()
        usePlaybackStore.getState().play('machine', seq, last!.trace.length)
      })
      expect(usePlaybackStore.getState().t).toBe(12)
      const tube = meshNamed(scene, 'signal-live')
      expect(pathPointsReported()).toBe(24)
      expect(tube.geometry.drawRange.count).toBe(tube.geometry.index!.count)
      expect(named(scene, 'signal-head').visible).toBe(false)
    } finally {
      useUiStore.setState({ reducedMotion: saved })
    }
  })

  it('draws nothing with trace off or while lampsHidden conceals the path; static waits for the steps', async () => {
    let scene = await mount(resolveStage({ preset: 'wire', with: { trace: 'off' } }))
    await pressAt('A', 12)
    expect(pathPointsReported()).toBe(2)
    expect(meshNamed(scene, 'signal-live').visible).toBe(false)
    await renderer!.unmount()

    await act(() => useMachineStore.getState().setLocks({ lampsHidden: true }))
    scene = await mount(STAGE_PRESETS.wire)
    await pressAt('B', 12)
    expect(pathPointsReported()).toBe(2)
    expect(meshNamed(scene, 'signal-live').visible).toBe(false)
    await renderer!.unmount()
    await act(() => useMachineStore.getState().setLocks({}))

    scene = await mount(STAGE_PRESETS.rotors) // trace 'static'
    await pressAt('C', 0.5)
    expect(pathPointsReported()).toBe(2)
    await at(1)
    expect(pathPointsReported()).toBe(24)
    expect(named(scene, 'signal-head').visible).toBe(false)
  })

  it('M4: 13 hops through the Greek rotor, 28 path points, the thin reflector', async () => {
    await act(() => useMachineStore.getState().setConfig(M4))
    const scene = await mount(STAGE_PRESETS.wire)
    await pressAt('A', 14)
    expect(useMachineStore.getState().last!.trace).toHaveLength(13)
    expect(pathPointsReported()).toBe(28)
    expect(meshNamed(scene, 'signal-live').userData.anchors).toHaveLength(28)
    const reflector = named(scene, 'reflector')
    expect(reflector.userData.thin).toBe(true)
    expect(reflector.userData.width).toBe(0.6)
    expect((named(scene, 'reflector-arcs').userData.pairs as unknown[]).length).toBe(13)
  })

  it('shows the press on show: a toy view is not redrawn by the machine’s playback', async () => {
    const spec = randomToy(createRng(1), 6, 2)
    await act(() => useToyStore.getState().setSpec(spec))
    await mount(STAGE_PRESETS.toy)
    let toyHops = 0
    await act(() => {
      const press = useToyStore.getState().press('B')
      toyHops = press.hops.length
      usePlaybackStore.setState({ source: 'toy', seq: useToyStore.getState().seq, hops: toyHops, t: 1 + toyHops })
    })
    expect(pathPointsReported()).toBe(2 + 2 * toyHops)
    // A machine press starts playing: the toy's press stays finished.
    await pressAt('A', 3.5)
    expect(pathPointsReported()).toBe(2 + 2 * toyHops)
  })
})

describe('the reflector', () => {
  it('has 13 arcs; the used pair lights once the signal reaches the reflector', async () => {
    const scene = await mount(STAGE_PRESETS.reflector)
    const arcs = named(scene, 'reflector-arcs')
    expect((arcs.userData.pairs as [number, number][]).length).toBe(13)
    const lit = meshNamed(scene, 'reflector-lit')
    expect(lit.visible).toBe(false)
    await pressAt('A', 1.5)
    const trace = useMachineStore.getState().last!.trace
    const r = trace.findIndex((h) => h.kind === 'reflector')
    await at(1 + r - 0.5)
    expect(lit.visible).toBe(false)
    await at(1 + r + 0.1)
    expect(lit.visible).toBe(true)
    const hop = trace[r]!
    expect(lit.userData.lit).toEqual([
      Math.min(hop.inputIndex, hop.outputIndex),
      Math.max(hop.inputIndex, hop.outputIndex),
    ])
    // exactly one arc is drawn lit: 1/13 of the lit geometry
    expect(lit.geometry.drawRange.count * 13).toBe(lit.geometry.getAttribute('position').count)
    const glow = lit.material as MeshStandardMaterial
    expect(glow.emissiveIntensity).toBeGreaterThan(1)
    expect(glow.toneMapped).toBe(false)
    await at(12)
    expect(lit.visible).toBe(true)
  })
})

describe('the cables', () => {
  const TEN: MachineConfigInput = { ...I, plugboard: 'AV BS CG DL FU HZ IN KM OW RX' }

  /** A key whose path crosses a cable on the way in and another on the way out. */
  function crossedTwice(): Letter {
    const m = createMachine(TEN)
    for (const l of LETTERS) {
      const t = pressKey(m, l).trace
      const pin = t[0]!
      const pout = t[t.length - 1]!
      if (pin.inputIndex !== pin.outputIndex && pout.inputIndex !== pout.outputIndex) return l
    }
    throw new Error('no key crosses two cables')
  }

  it('has one cable per plug pair', async () => {
    const scene = await mount(STAGE_PRESETS.plugboard)
    expect(named(scene, 'cables').userData.pairs).toEqual([
      [0, 21],
      [1, 18],
      [2, 6],
    ])
    // one tube per pair (40 segments × 8 sides × 6 vertices), and two plugs per pair (2 boxes each)
    const perCable = 40 * 8 * 6
    expect(meshNamed(scene, 'cables').geometry.getAttribute('position').count).toBe(3 * perCable + 3 * 2 * 2 * 36)
    expect(meshNamed(scene, 'cables-lit-in').geometry.getAttribute('position').count).toBe(3 * perCable)
    await renderer!.unmount()
    await act(() => useMachineStore.getState().setConfig(TEN))
    const ten = await mount(STAGE_PRESETS.plugboard)
    expect((named(ten, 'cables').userData.pairs as unknown[]).length).toBe(10)
    expect(meshNamed(ten, 'cables-lit-out').geometry.getAttribute('position').count).toBe(10 * perCable)
  })

  it('the path lights the cable it crosses on the way in, then the one it crosses on the way out', async () => {
    await act(() => useMachineStore.getState().setConfig(TEN))
    const scene = await mount(STAGE_PRESETS.plugboard)
    const litIn = meshNamed(scene, 'cables-lit-in')
    const litOut = meshNamed(scene, 'cables-lit-out')
    const key = crossedTwice()
    await pressAt(key, 0.5)
    expect([litIn.visible, litOut.visible]).toEqual([false, false])
    await at(1.2)
    expect([litIn.visible, litOut.visible]).toEqual([true, false])
    await at(11.5)
    expect([litIn.visible, litOut.visible]).toEqual([true, true])
    const trace = useMachineStore.getState().last!.trace
    const pair = (i: number) => {
      const h = trace[i]!
      return [Math.min(h.inputIndex, h.outputIndex), Math.max(h.inputIndex, h.outputIndex)]
    }
    expect(litIn.userData.lit).toEqual(pair(0))
    expect(litOut.userData.lit).toEqual(pair(10))
    expect(litIn.geometry.drawRange.count).toBe(40 * 8 * 6)
  })

  it('an unplugged key and lamp light no cable; without plugs there is no cable', async () => {
    await act(() => useMachineStore.getState().setConfig({ ...I, plugboard: '' }))
    const scene = await mount(STAGE_PRESETS.plugboard)
    expect(named(scene, 'cables').userData.pairs).toEqual([])
    await pressAt('A', 12)
    expect(meshNamed(scene, 'cables-lit-in').visible).toBe(false)
    expect(meshNamed(scene, 'cables-lit-out').visible).toBe(false)
  })
})

describe('the ghost', () => {
  it('draws the learner’s path dashed in red against the reference in gold, with a marker at divergeAt', async () => {
    const scene = await mount(STAGE_PRESETS.wire)
    expect(scene.getObjectByName('signal-ghost')).toBeUndefined()
    const ghost = demoGhost()
    await act(() => useStageStore.getState().setGhost(ghost))
    const g = meshNamed(scene, 'signal-ghost')
    const r = meshNamed(scene, 'signal-reference')
    expect(`#${(g.material as MeshBasicMaterial).color.getHexString()}`).toBe(swatch('ghost'))
    expect(`#${(r.material as MeshBasicMaterial).color.getHexString()}`).toBe(swatch('reference'))
    expect(swatch('ghost')).not.toBe(swatch('signal'))
    // dashed: about half of the tube's triangles
    const gAnchors = g.userData.anchors as [number, number, number][]
    const rAnchors = r.userData.anchors as [number, number, number][]
    expect(gAnchors).toHaveLength(24)
    for (let i = 0; i <= 9; i++) expect(gAnchors[i]).toEqual(rAnchors[i])
    expect(gAnchors[13]).not.toEqual(rAnchors[13])
    const marker = named(scene, 'signal-diverge')
    expect(marker.userData.marker).toEqual(gAnchors[1 + 2 * ghost.divergeAt])
    expect(marker.position.toArray()).toEqual(gAnchors[1 + 2 * ghost.divergeAt])
    // the ghost never glows: below Bloom's threshold
    expect((g.material as MeshBasicMaterial).color.r).toBeLessThanOrEqual(1)
    await act(() => useStageStore.getState().setGhost(null))
    expect(scene.getObjectByName('signal-ghost')).toBeUndefined()
    expect(scene.getObjectByName('signal-diverge')).toBeUndefined()
  })
})

describe('the toys', () => {
  it.each([
    [6, 2],
    [8, 3],
  ] as const)(
    'n = %i: its own wiring (n wires and contacts), n/2 reflector arcs, 2 + 2·hops path points',
    async (n, k) => {
      const spec = randomToy(createRng(1), n, k)
      await act(() => useToyStore.getState().setSpec(spec))
      const scene = await mount(STAGE_PRESETS.toy)
      const toy = named(scene, 'toy-geometry')
      expect(toy.userData).toMatchObject({ n, wires: n, contacts: n, terminals: n })
      expect((named(scene, 'reflector-arcs').userData.pairs as unknown[]).length).toBe(n / 2)
      let hops: readonly import('../../contracts/stage').PathHop[] = []
      await act(() => {
        hops = useToyStore.getState().press('C').hops
        usePlaybackStore.setState({
          source: 'toy',
          seq: useToyStore.getState().seq,
          hops: hops.length,
          t: 1 + hops.length,
        })
      })
      expect(hops).toHaveLength(3 + 2 * k)
      expect(pathPointsReported()).toBe(2 + 2 * hops.length)
      const l = makeLayout({ n, slots: toySlots(k), toy: true })
      expect(meshNamed(scene, 'signal-live').userData.anchors).toEqual(pathPoints(hops, l).map((p) => [p.x, p.y, p.z]))
      // The machine has no toy wiring.
      await renderer!.unmount()
      const machine = await mount(STAGE_PRESETS.wire)
      expect(machine.getObjectByName('toy-geometry')).toBeUndefined()
      // the toy path follows its own wire: the harness runs through the tube's route
      expect(buildCurve(signalRoute(hops, l))!.u).toHaveLength(2 + 2 * hops.length)
    },
  )
})

describe('effects', () => {
  it('Bloom: mipmap blur, luminance threshold 1', () => {
    expect(BLOOM.luminanceThreshold).toBe(1)
    expect(BLOOM.mipmapBlur).toBe(true)
  })
})
