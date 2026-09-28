/**
 * The glowing signal (PLAN §2.6, brief 11), mounted inside the Canvas by Scene.tsx:
 *  - the live path: a TubeGeometry over a CatmullRomCurve3 through pathPoints(hops, layout) (plus
 *    routing waypoints, route.ts), drawn up to the playback time with setDrawRange, and an emissive
 *    head at curve.getPointAt(f) with its tag (Head.tsx: the part, its letter change, the count).
 *    Tube and head glow: signal colour, emissive intensity above 1 and toneMapped false, so Bloom
 *    (luminanceThreshold 1) catches the live wire and the lit lamp only. A faint copy drawn without
 *    depth test shows the path where the rotors and the deck hide it, unless one part is in focus;
 *  - with the plugboard hidden, the cables the path runs along are drawn faintly (FaintCables);
 *  - the ghost (stage store, after a wrong answer): the learner's path as a dashed red tube against
 *    the reference in gold, drawn over the machine, with a marker where they part (divergeAt);
 *  - the report: StageReport.pathPoints = 2 + 2·(hops drawn), by the 2D view's rule (timing.ts).
 * Reduced motion needs nothing special: playback is instant, so the whole path shows at once.
 * Nothing here animates by itself: every frame follows a store change (framesWhileIdle stays 0).
 */

import { Billboard } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useMemo, type JSX } from 'react'
import { MeshBasicMaterial, MeshStandardMaterial, type Material, type Object3D } from 'three'
import { hopAt } from '../../contracts/machine'
import type { Ghost } from '../../contracts/stage'
import { LETTERS } from '../../engine'
import { isE2E } from '../../lib/flags'
import { useMachine } from '../../state/activeMachine'
import { useStageStore } from '../../state/stageStore'
import { useToyStore } from '../../state/toyStore'
import { useStage3D } from '../context'
import { pathPoints, type Layout } from '../layout'
import { markChange } from '../monitor'
import { swatch } from '../palette'
import { useSignalReport } from '../signalReport'
import { buildCurve, buildTube, dashTube, drawSegments, pointAt, segmentsFor } from './curve'
import type { SignalDebugApi, V3 } from './debugApi'
import { effectsState, useEffectsSwitch } from './effectsState'
import { divergeAnchor, ghostHops, referenceHops } from './ghost'
import { FaintCables } from './FaintCables'
import { Head, type HeadInfo } from './Head'
import { glowMaterial, overlayMaterial } from './materials'
import { signalRoute } from './route'
import { headTag } from './tag'
import { drawnFraction, headVisible, pathPointCount } from './timing'
import { useSignal, useStableLayout } from './useSignal'

export const LIVE_RADIUS = 0.15
const GHOST_RADIUS = 0.13
/** Ghost and reference run beside each other (and beside the live path), not inside it. */
const GHOST_OFFSET = { x: 0.17, y: 0.17, z: 0.17 }
const REFERENCE_OFFSET = { x: -0.17, y: -0.17, z: -0.17 }
const DASH_SEGMENTS = 4

/** Materials created once and disposed on unmount. */
function useMaterials<T extends Record<string, Material>>(create: () => T): T {
  const m = useMemo(create, [])
  useEffect(
    () => () => {
      for (const material of Object.values(m)) material.dispose()
    },
    [m],
  )
  return m
}

const tuple = (p: { x: number; y: number; z: number }): V3 => [p.x, p.y, p.z]

// ---------------------------------------------------------------------------
// The live signal
// ---------------------------------------------------------------------------

/** Focus on a group (or nothing): the see-through copy of the path helps. On one part it clutters. */
const GROUP_FOCUS: ReadonlySet<string> = new Set(['overview', 'wire', 'rotor-stack', 'pawls'])

function LiveSignal(): JSX.Element {
  const { hops, clock, drawn, layout } = useSignal()
  const { directive } = useStage3D()
  const invalidate = useThree((s) => s.invalidate)
  const curve = useMemo(() => buildCurve(signalRoute(hops, layout)), [hops, layout])
  const tube = useMemo(() => (curve ? buildTube(curve, LIVE_RADIUS) : null), [curve])
  useEffect(() => () => tube?.geometry.dispose(), [tube])
  const m = useMaterials(() => ({ tube: glowMaterial(), xray: overlayMaterial(swatch('signal'), 0.32) }))

  const fraction = curve ? drawnFraction(curve.u, clock) : 0
  const segments = tube ? segmentsFor(tube, fraction) : 0
  const head = curve && headVisible(clock) ? pointAt(curve, fraction) : null
  const tag = head ? headTag(hops, hopAt(clock.t, hops.length)) : null

  // The report (index.tsx): 2 + 2·(hops drawn), the 2D view's rule.
  const points = pathPointCount(drawn)
  useEffect(() => {
    useSignalReport.getState().setPathPoints(points)
  }, [points])

  useLayoutEffect(() => {
    if (!tube) return
    drawSegments(tube, segments)
    markChange()
    invalidate()
  }, [tube, segments, invalidate])

  const anchors = useMemo(() => pathPoints(hops, layout).map(tuple), [hops, layout])
  const visible = segments > 0
  const xray = visible && GROUP_FOCUS.has(directive.focus)
  const info = {
    hops: hops.length,
    drawn,
    pathPoints: points,
    fraction,
    anchorsU: curve?.u ?? [],
    anchors,
    segments,
    totalSegments: tube?.segments ?? 0,
    xray,
  }
  return (
    <group name="signal-live-group">
      {tube ? (
        <>
          <mesh
            name="signal-live"
            geometry={tube.geometry}
            material={m.tube}
            visible={visible}
            frustumCulled={false}
            userData={info}
          />
          <mesh
            name="signal-live-xray"
            geometry={tube.geometry}
            material={m.xray}
            visible={xray}
            frustumCulled={false}
            renderOrder={5}
          />
        </>
      ) : null}
      <Head head={head} tag={tag} />
    </group>
  )
}

// ---------------------------------------------------------------------------
// The ghost and the reference
// ---------------------------------------------------------------------------

function GhostPaths({ ghost, layout }: { ghost: Ghost; layout: Layout }): JSX.Element {
  const { directive } = useStage3D()
  const machine = useMachine((s) => s.machine)
  const spec = useToyStore((s) => s.spec)
  const toy = directive.source === 'toy'
  const reference = useMemo(() => referenceHops(ghost, { toy, machine, spec }), [ghost, toy, machine, spec])
  const learner = useMemo(() => ghostHops(ghost), [ghost])

  const ghostTube = useMemo(() => {
    const c = buildCurve(signalRoute(learner, layout), GHOST_OFFSET)
    if (!c) return null
    const tube = buildTube(c, GHOST_RADIUS, 5)
    dashTube(tube, DASH_SEGMENTS)
    return tube
  }, [learner, layout])
  const referenceTube = useMemo(() => {
    const c = reference ? buildCurve(signalRoute(reference, layout), REFERENCE_OFFSET) : null
    return c ? buildTube(c, GHOST_RADIUS, 5) : null
  }, [reference, layout])
  useEffect(() => () => ghostTube?.geometry.dispose(), [ghostTube])
  useEffect(() => () => referenceTube?.geometry.dispose(), [referenceTube])

  const m = useMaterials(() => ({
    ghost: overlayMaterial(swatch('ghost'), 0.95),
    reference: overlayMaterial(swatch('reference'), 0.85),
    marker: overlayMaterial(swatch('ghost'), 1),
  }))
  const ghostAnchors = useMemo(() => pathPoints(learner, layout).map(tuple), [learner, layout])
  const referenceAnchors = useMemo(
    () => (reference ? pathPoints(reference, layout).map(tuple) : []),
    [reference, layout],
  )
  const at = divergeAnchor(ghost)
  const marker = at === null ? null : (ghostAnchors[at] ?? null)

  return (
    <group name="signal-ghost-group">
      {referenceTube ? (
        <mesh
          name="signal-reference"
          geometry={referenceTube.geometry}
          material={m.reference}
          renderOrder={6}
          userData={{ anchors: referenceAnchors }}
        />
      ) : null}
      {ghostTube ? (
        <mesh
          name="signal-ghost"
          geometry={ghostTube.geometry}
          material={m.ghost}
          renderOrder={7}
          userData={{ anchors: ghostAnchors, divergeAt: ghost.divergeAt, dashed: true }}
        />
      ) : null}
      {marker ? (
        <Billboard name="signal-diverge" position={marker} userData={{ marker }}>
          <mesh material={m.marker} renderOrder={8}>
            <ringGeometry args={[0.62, 0.88, 40]} />
          </mesh>
        </Billboard>
      ) : null}
    </group>
  )
}

function Ghosts(): JSX.Element | null {
  const { view } = useStage3D()
  const layout = useStableLayout(view.layout)
  const ghost = useStageStore((s) => s.ghost)
  if (!ghost || ghost.hops.length === 0) return null
  return <GhostPaths ghost={ghost} layout={layout} />
}

// ---------------------------------------------------------------------------
// e2e hook
// ---------------------------------------------------------------------------

const letterPair = (a: number, b: number): string => `${LETTERS[a]}${LETTERS[b]}`

type Colored = { material?: MeshBasicMaterial | MeshStandardMaterial }
const hex = (o: Object3D | undefined): string =>
  `#${(o as Colored | undefined)?.material?.color.getHexString() ?? '000000'}`

/** window.__machine3dSignal (debugApi.ts), only with ?e2e=1. */
function SignalDebugHook(): null {
  const scene = useThree((s) => s.scene)
  useEffect(() => {
    if (!isE2E()) return
    const find = (name: string): Object3D | undefined => scene.getObjectByName(name)
    const api: SignalDebugApi = {
      live() {
        const tube = find('signal-live')
        const head = find('signal-head')
        const headInfo = (find('signal-head-group')?.userData.info as (() => HeadInfo) | undefined)?.()
        const d = (tube?.userData ?? {}) as Partial<ReturnType<SignalDebugApi['live']>>
        const material = (tube as { material?: MeshStandardMaterial } | undefined)?.material
        return {
          hops: d.hops ?? 0,
          drawn: d.drawn ?? 0,
          pathPoints: d.pathPoints ?? 2,
          fraction: d.fraction ?? 0,
          anchorsU: d.anchorsU ?? [],
          anchors: d.anchors ?? [],
          segments: tube?.visible ? (d.segments ?? 0) : 0,
          totalSegments: d.totalSegments ?? 0,
          head: (head?.userData.head as V3 | null | undefined) ?? null,
          color: material ? `#${material.emissive.getHexString()}` : '',
          glow: !!material && material.emissiveIntensity > 1 && material.toneMapped === false,
          xray: !!d.xray,
          headPx: headInfo?.headPx ?? 0,
          tag: headInfo?.tag
            ? {
                title: headInfo.tag.title,
                detail: headInfo.tag.detail,
                sym: headInfo.tag.sym,
                inverse: headInfo.tag.inverse,
                input: headInfo.tag.input,
                output: headInfo.tag.output,
                change: headInfo.tag.change,
                changes: headInfo.tag.changes,
                color: headInfo.tag.color,
                px: headInfo.tag.px,
              }
            : null,
        }
      },
      faintCables() {
        const o = find('signal-faint-cables')
        if (!o) return null
        const d = o.userData as { pairs: [number, number][]; shown: [number, number][] }
        return { pairs: d.pairs.map(([a, b]) => letterPair(a, b)), shown: d.shown.map(([a, b]) => letterPair(a, b)) }
      },
      ghost() {
        const ghost = find('signal-ghost')
        if (!ghost) return null
        const reference = find('signal-reference')
        const marker = find('signal-diverge')
        return {
          divergeAt: ghost.userData.divergeAt as number,
          ghostAnchors: ghost.userData.anchors as V3[],
          referenceAnchors: (reference?.userData.anchors as V3[] | undefined) ?? [],
          ghostColor: hex(ghost),
          referenceColor: hex(reference),
          dashed: !!ghost.userData.dashed,
          marker: (marker?.userData.marker as V3 | undefined) ?? null,
        }
      },
      reflector() {
        const d = (find('reflector')?.userData ?? {}) as {
          pairs?: [number, number][]
          lit?: [number, number] | null
          width?: number
          thin?: boolean
        }
        const pairs = d.pairs ?? []
        return {
          arcs: pairs.length,
          pairs: pairs.map(([a, b]) => letterPair(a, b)),
          lit: d.lit ? letterPair(...d.lit) : null,
          width: d.width ?? 0,
          thin: !!d.thin,
        }
      },
      cables() {
        const cables = find('cables')
        if (!cables) return null
        const d = cables.userData as { pairs: [number, number][]; lit: [number, number][] }
        return { pairs: d.pairs.map(([a, b]) => letterPair(a, b)), lit: d.lit.map(([a, b]) => letterPair(a, b)) }
      },
      toy() {
        const toy = find('toy-geometry')
        if (!toy) return null
        const d = toy.userData as { n: number; wires: number; contacts: number; terminals: number }
        return { n: d.n, wires: d.wires, contacts: d.contacts, terminals: d.terminals }
      },
      effects: () => ({ ...effectsState }),
      forceBloom: (force) => useEffectsSwitch.setState({ force }),
    }
    window.__machine3dSignal = api
    return () => {
      if (window.__machine3dSignal === api) delete window.__machine3dSignal
      useEffectsSwitch.setState({ force: null })
    }
  }, [scene])
  return null
}

// ---------------------------------------------------------------------------
// The layer
// ---------------------------------------------------------------------------

export function SignalLayer(): JSX.Element {
  const { view, directive } = useStage3D()
  const layout = useStableLayout(view.layout)
  // A later 3D view must not start from this one's path.
  useEffect(() => () => useSignalReport.getState().setPathPoints(0), [])
  return (
    <group name="signal">
      <LiveSignal />
      {directive.plugboard ? null : <FaintCables layout={layout} plugs={view.plugs} />}
      <Ghosts />
      <SignalDebugHook />
    </group>
  )
}
