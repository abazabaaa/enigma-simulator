/**
 * GateRunner (PLAN §3.5, §4.1 G2–G8): a gate's items one at a time. Each shown instance applies its
 * setup (machine, locks, toy, stage) and restores the previous setup afterwards. After a submit the
 * rollback of the learner's own answer shows until gate-continue. The hint ladder runs per item.
 * window.__course drives the same controller (registered while mounted).
 */

import { useEffect, useMemo, useSyncExternalStore, type ComponentType, type JSX } from 'react'
import type { GateKey } from '../../contracts/core'
import type { GateBinding, ItemRuntimeView, Rollback } from '../../contracts/lesson'
import type { Highlight, PartId } from '../../contracts/stage'
import { createMachine, step } from '../../engine'
import { useMachineApi } from '../../state/activeMachine'
import { useStageStore } from '../../state/stageStore'
import { useToyStore } from '../../state/toyStore'
import { createGateController, type GateController } from '../gateController'
import { gateView, itemKeyOf, shownInstance, type Shown } from '../gateEngine'
import { partForStage } from '../kinds/helpers'
import { WIDGETS, type WidgetProps } from '../kinds/widgets'
import { useProgress } from '../progress'
import { registerGate } from '../runtime'
import { HintPanel } from './HintPanel'
import { RollbackView } from './RollbackView'
import { useItemStage } from './itemStage'

const KIND_LABEL: Record<string, string> = {
  letter: 'Predict a letter',
  letters: 'Letters',
  numbers: 'Numbers',
  choice: 'Choose',
  order: 'Put in order',
  chain: 'Follow the chain',
  'set-machine': 'Set the machine',
  'ghost-pick': 'Find the fault',
  code: 'Code',
  custom: 'Hands on',
}

/** The parts to outline for a wrong answer (tone 'error'). */
function rollbackParts(rb: Rollback): PartId[] {
  if (rb.kind === 'path') {
    const hop = rb.ghost.hops[rb.ghost.divergeAt]
    return hop ? [partForStage(hop.stage)] : []
  }
  if (rb.kind === 'machine') return [...rb.highlight]
  if (rb.kind === 'windows') {
    // The carrying rotor at the first wrong press: its pawl and the notch that engaged it.
    let state = createMachine(rb.from)
    for (let k = 0; k < rb.firstWrong; k++) state = step(state).state
    const s = step(state)
    if (s.stepped.left) return ['notch-middle', 'pawl-left']
    if (s.stepped.middle) return ['notch-right', 'pawl-middle']
    return ['pawl-right']
  }
  return []
}

export function useGateController(key: GateKey, binding: GateBinding, recall = false): GateController {
  const controller = useMemo(() => createGateController({ key, logic: binding.logic, recall }), [key, binding, recall])
  useEffect(
    () =>
      registerGate({
        view: () => controller.view(),
        answer: (itemId, answer) => controller.submit(itemId, answer),
        continue: () => controller.continue(),
      }),
    [controller],
  )
  return controller
}

export function GateRunner(p: {
  gateKey: GateKey
  binding: GateBinding
  /** Record recall statistics (recall scenes and the return check). */
  recall?: boolean
  /** A compact heading (the return check). */
  title?: string
  controller?: GateController
}): JSX.Element {
  const own = useGateController(p.gateKey, p.binding, p.recall)
  const controller = p.controller ?? own
  const { logic } = p.binding
  const state = useSyncExternalStore(controller.subscribe, controller.getState)
  const rec = useProgress((s) => s.gates[p.gateKey])
  const salt = useProgress((s) => s.salt)
  const api = useMachineApi()
  const setItemStage = useItemStage((s) => s.set)
  const setHighlight = useStageStore((s) => s.setHighlight)
  const setGhost = useStageStore((s) => s.setGhost)

  // The current item's record exists once it is shown.
  useEffect(() => {
    controller.ensure()
  })

  const view = useMemo(() => gateView(controller.ctx(), rec), [controller, rec, salt])
  const current = view.current
  const currentLogic = current ? logic.items.find((it) => it.id === current.itemId)! : null
  const currentShown: Shown | null =
    current && currentLogic && rec?.items[current.itemId] ? shownInstance(controller.ctx(), currentLogic, rec.items[current.itemId]!) : null
  const feedback = state.phase === 'feedback' ? state.last : null
  const displayed: Shown | null = feedback ? feedback.shown : currentShown
  const displayedKey = feedback
    ? `fb|${feedback.itemKey}|${feedback.attempt}`
    : current && currentShown
      ? `cur|${current.key}|${current.attempt}|${current.seed}`
      : 'none'

  useEffect(() => {
    if (state.phase === 'answer' && currentShown) controller.announce()
  })

  // Apply the displayed instance's setup; restore what was there before when it goes away.
  useEffect(() => {
    if (!displayed) return
    const setup = displayed.logic.setup?.(displayed.instance)
    const ownsMachine = displayed.logic.kind === 'set-machine'
    setItemStage({ ownsMachine })
    if (!setup) return () => setItemStage({ ownsMachine: false })
    const machine = api.getState()
    const saved = { config: machine.snapshot(), locks: machine.locks, toy: useToyStore.getState().spec }
    if (setup.machine) machine.setConfig(setup.machine)
    if (setup.locks) machine.setLocks(setup.locks)
    if (setup.toy) useToyStore.getState().setSpec(setup.toy)
    if (setup.stage !== undefined) setItemStage({ stage: setup.stage })
    return () => {
      const m = api.getState()
      if (setup.machine) m.setConfig(saved.config)
      if (setup.locks) m.setLocks(saved.locks)
      if (setup.toy) useToyStore.getState().setSpec(saved.toy)
      setItemStage({ stage: undefined, ownsMachine: false })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayedKey])

  // Stage highlights: the hint (L1+) while answering, the rollback's parts after a wrong answer.
  const lastWrong = current ? state.lastWrong[current.itemId] : undefined
  const hintHighlights: readonly Highlight[] = useMemo(() => {
    if (feedback || !current || !currentShown || current.hintLevel < 1) return []
    try {
      return currentShown.logic.highlight(currentShown.instance, lastWrong ?? null)
    } catch {
      return []
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayedKey, current?.hintLevel, lastWrong, feedback])
  useEffect(() => {
    if (feedback && !feedback.result.correct) {
      setHighlight(rollbackParts(feedback.result.rollback).map((part) => ({ part, tone: 'error' as const })))
    } else setHighlight(hintHighlights)
    return () => setHighlight([])
  }, [feedback, hintHighlights, setHighlight])
  useEffect(() => {
    const rb = feedback && !feedback.result.correct ? feedback.result.rollback : null
    if (rb?.kind !== 'path') return
    setGhost(rb.ghost)
    return () => setGhost(null)
  }, [feedback, setGhost])

  return (
    <section data-testid="gate" data-gate={p.gateKey} data-passed={String(view.passed)} className="flex flex-col gap-3">
      {p.title ? <h3 className="text-base font-semibold text-stone-200">{p.title}</h3> : null}
      <ol className="flex flex-col gap-2">
        {view.items.map((v, k) => {
          const isCurrent = !!feedback ? feedback.itemId === v.itemId : current?.itemId === v.itemId
          const live = isCurrent ? (current?.itemId === v.itemId ? current : v) : v
          return (
            <li
              key={v.itemId}
              data-testid={`item-${v.itemId}`}
              data-passed={String(v.passed)}
              data-attempt={v.attempt}
              data-current={String(isCurrent)}
              data-kind={live.kind}
              data-fallback={String(live.fallback)}
              className={`rounded-lg border p-3 ${isCurrent ? 'border-stone-500 bg-stone-900/60' : 'border-stone-800'}`}
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2 text-xs text-stone-400">
                <span>
                  Item {k + 1} of {view.items.length} · {KIND_LABEL[live.kind] ?? live.kind}
                  {live.fallback ? ' · a hands-on variant' : ''}
                </span>
                <span>
                  {v.passed ? 'passed' : v.rule.kind === 'window' ? '2 of your last 3 right to pass' : 'one right answer passes'}
                  {v.attempt > 0 ? ` · attempt ${v.attempt}` : ''}
                </span>
              </div>
              {isCurrent && displayed ? (
                <ItemBody
                  controller={controller}
                  gateKey={p.gateKey}
                  binding={p.binding}
                  view={live as ItemRuntimeView}
                  displayed={displayed}
                  gatePassed={view.passed}
                  hintHighlights={hintHighlights}
                />
              ) : null}
            </li>
          )
        })}
      </ol>
      {view.passed && !feedback ? (
        <p data-testid="gate-passed" className="rounded-md border border-emerald-700 bg-emerald-950/30 p-2 text-sm text-emerald-200">
          Gate passed.
        </p>
      ) : null}
    </section>
  )
}

function ItemBody(p: {
  controller: GateController
  gateKey: GateKey
  binding: GateBinding
  view: ItemRuntimeView
  displayed: Shown
  gatePassed: boolean
  hintHighlights: readonly Highlight[]
}): JSX.Element {
  const { controller, displayed } = p
  const state = useSyncExternalStore(controller.subscribe, controller.getState)
  const itemUi = p.binding.ui[displayed.logic.id]
  if (!itemUi) return <p className="text-sm text-red-300">No UI for {displayed.logic.id}.</p>
  const { Prompt } = itemUi
  const feedback = state.phase === 'feedback' ? state.last : null
  const level = feedback ? 0 : p.view.hintLevel
  const submit = (a: unknown) => {
    try {
      controller.submit(p.view.itemId, a)
    } catch {
      // A second click while the first answer's feedback is showing: one outcome only.
    }
  }
  const Widget = (itemUi.Answer ?? (displayed.logic.kind === 'custom' ? null : WIDGETS[displayed.logic.kind])) as ComponentType<WidgetProps> | null
  return (
    <div className="mt-2 flex flex-col gap-3">
      <div className="text-sm text-stone-200" data-testid="item-prompt">
        <Prompt instance={displayed.instance} hintLevel={level} />
      </div>
      {feedback ? (
        <RollbackView
          result={feedback.result}
          answer={feedback.answer}
          instance={feedback.shown.instance}
          logic={feedback.shown.logic}
          ui={itemUi}
          passed={feedback.passed}
          gatePassed={p.gatePassed}
          onContinue={() => controller.continue()}
        />
      ) : (
        <>
          <HintPanel
            level={level}
            ui={itemUi}
            highlights={p.hintHighlights}
            worked={level === 2 ? controller.worked() : null}
            current={displayed.instance}
            solution={level === 3 ? displayed.logic.solve(displayed.instance) : null}
            onGotIt={() => controller.continue()}
          />
          {level < 3 && Widget ? (
            <Widget
              key={`${p.view.attempt}|${p.view.seed}`}
              instance={displayed.instance}
              disabled={false}
              hintLevel={level}
              submit={submit}
              logic={displayed.logic}
              itemKey={itemKeyOf(p.gateKey, p.view.itemId)}
            />
          ) : null}
        </>
      )}
    </div>
  )
}
