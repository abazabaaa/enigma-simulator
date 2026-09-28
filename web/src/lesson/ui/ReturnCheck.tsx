/**
 * The return-visit check (PLAN §4.2): after 6 h or more away, two recall items (one from the act seen least
 * recently, one from another) must each be answered correctly or revealed before resuming. It never locks
 * anything further. Each item is its own one-item gate, keyed by the visit it belongs to.
 */

import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type JSX, type KeyboardEvent } from 'react'
import type { AnyChapterId, GateKey } from '../../contracts/core'
import { useProgress } from '../progress'
import { RECALL_UI } from '../recall/items'
import { recallGateOf, type RecallId } from '../recall/pool'
import { GateRunner, useGateController } from './GateRunner'

export interface ReturnCheckState {
  /** The lastVisit this check belongs to (keys its gates, so a reload shows the same instances). */
  readonly stamp: number
  readonly items: readonly RecallId[]
}

function ReturnItem(p: { gateKey: GateKey; id: RecallId; onDone(): void }): JSX.Element {
  const binding = useMemo(() => ({ logic: recallGateOf([p.id]), ui: RECALL_UI }), [p.id])
  const controller = useGateController(p.gateKey, binding, true)
  const phase = useSyncExternalStore(controller.subscribe, () => controller.getState().phase)
  const rec = useProgress((s) => s.gates[p.gateKey]?.items[p.id])
  const done = !!rec && (rec.passed || rec.outcomes.some((o) => o.result === 'revealed'))
  const { onDone } = p
  useEffect(() => {
    if (done && phase === 'answer') onDone()
  }, [done, phase, onDone])
  return <GateRunner gateKey={p.gateKey} binding={binding} recall controller={controller} />
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * A modal dialog (review m2): it takes focus when it opens and at each item, Tab and Shift+Tab cycle inside
 * it, and focus that lands outside (the page behind is inert) is brought back.
 */
export function ReturnCheck(p: { chapter: AnyChapterId; check: ReturnCheckState; onDone(): void }): JSX.Element {
  const [k, setK] = useState(0)
  const dialog = useRef<HTMLDivElement>(null)
  const title = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    title.current?.focus()
  }, [k])
  useEffect(() => {
    const onFocusIn = (e: FocusEvent) => {
      if (dialog.current && !dialog.current.contains(e.target as Node)) title.current?.focus()
    }
    document.addEventListener('focusin', onFocusIn)
    return () => document.removeEventListener('focusin', onFocusIn)
  }, [])
  const trap = (e: KeyboardEvent) => {
    if (e.key !== 'Tab' || !dialog.current) return
    const all = [...dialog.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null)
    if (!all.length) return
    const first = all[0]!
    const last = all.at(-1)!
    const active = document.activeElement
    if (e.shiftKey && (active === first || active === title.current)) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && active === last) {
      e.preventDefault()
      first.focus()
    }
  }
  const id = p.check.items[k]
  const gateKey = `${p.chapter}/return-${p.check.stamp}-${k}` as GateKey
  const { onDone } = p
  const advance = useMemo(
    () => () => (k + 1 < p.check.items.length ? setK(k + 1) : onDone()),
    [k, p.check.items.length, onDone],
  )
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-stone-950/85 p-4">
      <div
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="return-check-title"
        data-testid="return-check"
        data-step={k}
        onKeyDown={trap}
        className="mt-8 flex w-full max-w-2xl flex-col gap-3 rounded-xl border border-stone-700 bg-stone-900 p-4"
      >
        <h2
          id="return-check-title"
          ref={title}
          tabIndex={-1}
          className="text-lg font-semibold text-stone-100 focus:outline-none"
        >
          Welcome back
        </h2>
        <p className="text-sm text-stone-300">
          Two quick questions from earlier chapters ({k + 1} of {p.check.items.length}). Answer it, or work through the
          hints to the solution, and you are straight back in.
        </p>
        {id ? <ReturnItem key={gateKey} gateKey={gateKey} id={id} onDone={advance} /> : null}
      </div>
    </div>
  )
}
