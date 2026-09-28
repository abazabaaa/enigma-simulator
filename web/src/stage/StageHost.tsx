/**
 * StageHost (PLAN §2.6): resolves a StageRef through the stage store and picks the renderer.
 *  - 3D when MACHINE_3D_READY, WebGL 2 is available, and neither ?stage=2d nor the '2d' preference
 *    is set. The 3D view is lazy-loaded, so three.js never lands in the entry chunk.
 *  - Otherwise Stage2D. While Stage2D is still the 02 stub (it reports renderer 'placeholder'),
 *    StagePlaceholder prints the directive.
 *  - On the view's onError (context loss, shader failure, chunk load failure) it switches to 2D
 *    for the rest of the session and logs console.warn, never console.error.
 */

import { Suspense, lazy, useCallback, useEffect, useMemo, useState, type JSX } from 'react'
import { resolveStage, type StageRef, type StageReport } from '../contracts/stage'
import { MACHINE_3D_READY } from '../machine3d/ready'
import Stage2D from '../stage2d'
import { useStageStore } from '../state/stageStore'
import { requestedStage, useReducedMotion, useUiStore } from '../state/uiStore'
import { StageErrorBoundary } from './StageErrorBoundary'
import { StagePlaceholder } from './StagePlaceholder'
import { reportStage } from './stageApi'

const Machine3D = lazy(() => import('../machine3d'))

let webgl2: boolean | null = null

/** WebGL 2 probe: one throwaway canvas, cached for the session. */
export function hasWebGL2(): boolean {
  if (webgl2 === null) {
    try {
      webgl2 = typeof document !== 'undefined' && document.createElement('canvas').getContext('webgl2') !== null
    } catch {
      webgl2 = false
    }
  }
  return webgl2
}

/** Set once the 3D view has failed: 2D for the rest of the session. */
let failed3d = false

export function StageHost({ stage, className }: { stage: StageRef | null; className?: string }): JSX.Element | null {
  const key = stage === null ? '' : typeof stage === 'string' ? stage : JSON.stringify(stage)
  // The directive depends on the ref's content, not on its identity.
  const directive = useMemo(() => (stage === null ? null : resolveStage(stage)), [key])
  const setDirective = useStageStore((s) => s.setDirective)
  const reducedMotion = useReducedMotion()
  const pref = useUiStore((s) => s.stage)
  const [failed, setFailed] = useState(failed3d)
  const [renderer, setRenderer] = useState<StageReport['renderer'] | null>(null)

  useEffect(() => {
    setDirective(directive)
    return () => setDirective(null)
  }, [directive, setDirective])

  useEffect(() => () => reportStage(null), [])

  const onReport = useCallback((r: StageReport) => {
    reportStage(r)
    setRenderer(r.renderer)
  }, [])

  const onError = useCallback((e: unknown) => {
    console.warn('The 3D stage failed; switching to the 2D view for this session.', e)
    failed3d = true
    setFailed(true)
  }, [])

  if (directive === null) return null
  const want3d = MACHINE_3D_READY && !failed && requestedStage(pref) !== '2d' && hasWebGL2()
  const view = { directive, reducedMotion, onReport, onError }

  return (
    <div data-testid="stage" data-renderer={renderer ?? 'pending'} data-focus={directive.focus} className={className}>
      {want3d ? (
        <StageErrorBoundary onError={onError}>
          <Suspense fallback={<p className="p-4 text-sm text-stone-500">Loading the machine…</p>}>
            <Machine3D {...view} />
          </Suspense>
        </StageErrorBoundary>
      ) : (
        <Stage2D {...view} />
      )}
      {renderer === 'placeholder' && !want3d ? <StagePlaceholder directive={directive} /> : null}
    </div>
  )
}
