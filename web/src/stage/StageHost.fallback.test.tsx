// @vitest-environment happy-dom
import { act, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, it, vi } from 'vitest'
import type { StageViewProps } from '../contracts/stage'

// Pretend the 3D view exists and WebGL 2 is available; the 3D view then fails (e.g. a context loss).
vi.mock('../machine3d/ready', () => ({ MACHINE_3D_READY: true }))
vi.mock('../machine3d', () => ({
  default: function FailingMachine3D({ onReport, onError }: StageViewProps) {
    useEffect(() => {
      onReport({
        renderer: 'webgl2',
        focus: 'wire',
        dimmed: [],
        highlighted: [],
        litLamp: null,
        windows: 'AAA',
        hop: -1,
        pathPoints: 0,
        ghost: false,
      })
      onError(new Error('webglcontextlost'))
    }, [onReport, onError])
    return null
  },
}))

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

describe('StageHost fallback', () => {
  it('switches to 2D for the session on onError and warns instead of erroring', async () => {
    HTMLCanvasElement.prototype.getContext = (() => ({})) as never
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const error = vi.spyOn(console, 'error')
    const { StageHost } = await import('./StageHost')
    const { stageApi } = await import('./stageApi')

    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)
    await act(async () => root.render(<StageHost stage="wire" />))
    await act(async () => {})
    const stage = () => container.querySelector<HTMLElement>('[data-testid="stage"]')!
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('2D'), expect.any(Error))
    expect(error).not.toHaveBeenCalled()
    // The 2D view: 'placeholder' while Stage2D is the 02 stub, 'svg' once 04's view lands.
    expect(['placeholder', 'svg']).toContain(stage().dataset.renderer)
    expect(['placeholder', 'svg']).toContain(stageApi.info().renderer)

    // A new StageHost in the same session goes straight to 2D.
    await act(async () => root.unmount())
    const root2 = createRoot(container)
    warn.mockClear()
    await act(async () => root2.render(<StageHost stage="pawls" />))
    expect(['placeholder', 'svg']).toContain(stage().dataset.renderer)
    expect(warn).not.toHaveBeenCalled()
    await act(async () => root2.unmount())
    container.remove()
  })
})
