// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { StageReport } from '../contracts/stage'

/**
 * A Canvas without WebGL that behaves like R3F's around the context: onCreated hands over a renderer
 * whose canvas can lose its context, and unmounting it loses the context on purpose (R3F's teardown
 * calls forceContextLoss() right after the commit, before any passive effect cleanup; here it happens
 * in the Canvas's own layout cleanup, the earliest it could).
 */
vi.mock('@react-three/fiber', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@react-three/fiber')>()
  const React = await import('react')
  function FakeCanvas({ onCreated }: { onCreated?: (root: unknown) => void }) {
    const ref = React.useRef<HTMLCanvasElement>(null)
    React.useEffect(() => {
      const ctx = { RENDERER: 0x1f01, getExtension: () => null, getParameter: () => 'Fake GPU' }
      onCreated?.({ gl: { domElement: ref.current!, getContext: () => ctx, debug: {} } })
    }, [])
    React.useLayoutEffect(() => {
      const canvas = ref.current!
      return () => void canvas.dispatchEvent(new Event('webglcontextlost'))
    }, [])
    return React.createElement('canvas', { ref, 'data-testid': 'fake-canvas' })
  }
  return { ...actual, Canvas: FakeCanvas }
})
;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const tick = (ms = 10) => act(() => new Promise<void>((r) => setTimeout(r, ms)))

let roots: { root: Root; container: HTMLElement }[] = []
function mountInto(): { root: Root; container: HTMLElement } {
  const container = document.createElement('div')
  document.body.append(container)
  const entry = { root: createRoot(container), container }
  roots.push(entry)
  return entry
}

afterEach(async () => {
  for (const { root, container } of roots) {
    await act(async () => root.unmount())
    container.remove()
  }
  roots = []
  vi.restoreAllMocks()
})

describe('Machine3DView and the WebGL context', () => {
  it('reports a context lost while mounted (StageHost falls back to 2D)', async () => {
    const { default: Machine3DView } = await import('./index')
    const { STAGE_PRESETS } = await import('../contracts/stage')
    const onError = vi.fn()
    const reports: StageReport[] = []
    const { root, container } = mountInto()
    await act(async () =>
      root.render(
        <Machine3DView
          directive={STAGE_PRESETS.wire}
          reducedMotion={false}
          onReport={(r) => reports.push(r)}
          onError={onError}
        />,
      ),
    )
    await tick()
    expect(reports.at(-1)).toMatchObject({ renderer: 'webgl2', gpu: 'Fake GPU', focus: 'wire' })
    container.querySelector('canvas')!.dispatchEvent(new Event('webglcontextlost'))
    expect(onError).toHaveBeenCalledTimes(1)
    expect(String(onError.mock.calls[0]![0])).toContain('WebGL context was lost')
  })

  it('ignores the context R3F loses on purpose after unmount', async () => {
    const { default: Machine3DView } = await import('./index')
    const { STAGE_PRESETS } = await import('../contracts/stage')
    const onError = vi.fn()
    const { root, container } = mountInto()
    await act(async () =>
      root.render(
        <Machine3DView directive={STAGE_PRESETS.wire} reducedMotion={false} onReport={() => {}} onError={onError} />,
      ),
    )
    await tick()
    const canvas = container.querySelector('canvas')!
    await act(async () => root.unmount())
    roots = roots.filter((r) => r.root !== root)
    await tick(20)
    canvas.dispatchEvent(new Event('webglcontextlost'))
    expect(onError).not.toHaveBeenCalled()
  })

  it('StageHost stays on WebGL 2 across scene changes that remount the stage', async () => {
    // hasWebGL2()'s probe: this environment has no WebGL, pretend it does
    HTMLCanvasElement.prototype.getContext = (() => ({})) as never
    const warn = vi.spyOn(console, 'warn')
    const { StageHost } = await import('../stage/StageHost')
    const scenes = ['rotors', 'pawls', 'rotor-layers', 'wire'] as const
    for (const preset of scenes) {
      const { root, container } = mountInto()
      await act(async () => root.render(<StageHost stage={preset} />))
      const stage = () => container.querySelector<HTMLElement>('[data-testid="stage"]')!
      for (let i = 0; i < 20 && stage().dataset.renderer !== 'webgl2'; i++) await tick()
      expect(stage().dataset.renderer, `scene ${preset}`).toBe('webgl2')
      await act(async () => root.unmount())
      roots = roots.filter((r) => r.root !== root)
      container.remove()
      // let the teardown's context loss fire on the detached canvas
      await tick(20)
    }
    expect(warn).not.toHaveBeenCalledWith(expect.stringContaining('2D'), expect.anything())
  })
})
