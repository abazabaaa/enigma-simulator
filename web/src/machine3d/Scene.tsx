/**
 * The 3D machine's scene graph, inside the Canvas: lights, camera rig, parts, labels, highlights,
 * PR 11's signal layer and the frame/stats hooks. A pure function of its props (the directive and
 * the store snapshot from useStageView); every render requests a frame (frameloop="demand").
 */

import { useThree } from '@react-three/fiber'
import { useLayoutEffect, useMemo, useRef, type JSX } from 'react'
import { ALL_PARTS, dimmedParts, type PartId, type StageDirective } from '../contracts/stage'
import type { Letter, ModelName } from '../engine'
import { CameraRig } from './CameraRig'
import { Stage3DContext, type Stage3D } from './context'
import { DebugHook, StatsHook } from './debug'
import { FocusProvider, HighlightPulse, createRegistry } from './focus'
import { Halos, PartLabels } from './labels'
import { markChange } from './monitor'
import { Cables } from './parts/Cables'
import { Case } from './parts/Case'
import { Etw } from './parts/Etw'
import { Keyboard } from './parts/Keyboard'
import { Lampboard } from './parts/Lampboard'
import { Pawls } from './parts/Pawls'
import { Reflector } from './parts/Reflector'
import { RotorStack } from './parts/RotorStack'
import { Sockets } from './parts/Sockets'
import { ToyGeometry } from './parts/ToyGeometry'
import { SignalLayer } from './signal'
import type { StageViewState } from './useStageView'
import type { SceneView } from './view'

/** Keeps the previous value while its key is unchanged, so memoised parts skip re-rendering. */
function useStableBy<T>(value: T, key: string): T {
  const ref = useRef({ key, value })
  if (ref.current.key !== key) ref.current = { key, value }
  return ref.current.value
}

/** The parts drawn for this directive and source, in ALL_PARTS order. */
export function presentParts(model: ModelName, directive: StageDirective, view: SceneView): PartId[] {
  const slots = new Set<string>(view.layout.slots)
  return ALL_PARTS(model).filter((p) => {
    if (p === 'plugboard') return directive.plugboard
    if (p === 'lid') return directive.lid !== 'cutaway'
    if (p === 'etw') return view.source === 'machine'
    const dash = p.indexOf('-')
    if (dash < 0) return true
    const slot = p.slice(dash + 1)
    if (!slots.has(slot)) return false
    const rotor = view.rotors.find((r) => r.slot === slot)
    if (p.startsWith('notch-')) return !!rotor?.turnovers.length
    if (p.startsWith('pawl-')) return !!rotor?.pawl
    return true
  })
}

function Lights(): JSX.Element {
  return (
    <>
      <hemisphereLight args={['#fff7ed', '#44403c', 2.2]} />
      <directionalLight position={[14, 34, 26]} intensity={3} />
      <directionalLight position={[-24, 16, -4]} intensity={1.3} />
      <directionalLight position={[20, 6, -30]} intensity={0.8} />
    </>
  )
}

export interface SceneProps {
  readonly directive: StageDirective
  readonly reducedMotion: boolean
  readonly state: StageViewState
  /** Presses a key through the store; undefined while the canvas keys are inert. */
  readonly onPress?: (letter: Letter) => void
}

export function Machine3DScene({ directive, reducedMotion, state, onPress }: SceneProps): JSX.Element {
  const { view, model, highlight } = state
  const invalidate = useThree((s) => s.invalidate)
  useLayoutEffect(() => {
    markChange()
    invalidate()
  })

  const layout = useStableBy(view.layout, `${view.layout.n}|${view.layout.slots.join()}|${view.layout.toy}`)
  const letters = useStableBy(view.letters, view.letters.join(''))
  const rotors = useStableBy(view.rotors, JSON.stringify(view.rotors))
  const plugs = useStableBy(view.plugs, view.plugs.join())
  const wiring = useStableBy(view.reflector.wiring, view.reflector.wiring.join())
  const dimmed = useMemo(() => new Set(dimmedParts(directive.focus, model)), [directive.focus, model])
  const highlightKey = highlight.map((h) => `${h.part}:${h.tone}`).join()
  const highlightMap = useMemo(() => new Map(highlight.map((h) => [h.part, h.tone] as const)), [highlightKey])
  const registry = useMemo(createRegistry, [])
  const presentNow = presentParts(model, directive, view)
  const present = useStableBy(presentNow, presentNow.join())
  const context = useMemo(
    (): Stage3D => ({ view, directive, reducedMotion, model, t: state.t }),
    [view, directive, reducedMotion, model, state.t],
  )
  const isToy = view.source === 'toy'

  return (
    <Stage3DContext.Provider value={context}>
      <FocusProvider dimmed={dimmed} highlight={highlightMap} reducedMotion={reducedMotion} registry={registry}>
        <Lights />
        <CameraRig directive={directive} layout={layout} reducedMotion={reducedMotion} />
        <Case layout={layout} lid={directive.lid} />
        <Keyboard layout={layout} letters={letters} pressedKey={view.pressedKey} onPress={onPress} />
        <Lampboard layout={layout} letters={letters} litLamp={view.litLamp} />
        {directive.plugboard ? (
          <>
            <Sockets layout={layout} letters={letters} plugs={plugs} />
            <Cables layout={layout} plugs={plugs} />
          </>
        ) : null}
        {isToy ? null : <Etw layout={layout} />}
        <RotorStack
          layout={layout}
          rotors={rotors}
          letters={letters}
          numbers={directive.ringLayer && !isToy}
          explode={directive.ringLayer}
        />
        <Pawls layout={layout} rotors={rotors} />
        <Reflector layout={layout} wiring={wiring} name={view.reflector.name} />
        {isToy ? <ToyGeometry layout={layout} spec={state.toySpec} /> : null}
        <SignalLayer />
        <PartLabels view={view} directive={directive} present={present} />
        <Halos view={view} explode={directive.ringLayer} />
        <HighlightPulse />
        <StatsHook />
        <DebugHook slots={layout.slots} />
      </FocusProvider>
    </Stage3DContext.Provider>
  )
}
