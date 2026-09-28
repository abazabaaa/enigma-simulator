/**
 * One scene (PLAN §2.4, §4.1): title, stage, machine panel, the chapter's View, bets and reveals, tasks,
 * the gate (gate scenes) or the recall gate (recall scenes), and scene-back / scene-next.
 * The scene's setup is applied on enter; its locks are restored on leave.
 */

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type JSX } from 'react'
import { useShallow } from 'zustand/react/shallow'
import type { AnyChapterId } from '../../contracts/core'
import type {
  BetHandle,
  ChapterDef,
  GateBinding,
  GateHandle,
  ItemUiMap,
  SceneDef,
  SceneProps,
} from '../../contracts/lesson'
import type { BetRecord } from '../../contracts/progress'
import { MachinePanel } from '../../machine-ui'
import { StageHost } from '../../stage/StageHost'
import { useMachineStore } from '../../state/machineStore'
import { useStageStore } from '../../state/stageStore'
import { useToyStore } from '../../state/toyStore'
import { useReducedMotion } from '../../state/uiStore'
import { now } from '../clock'
import { emit } from '../events'
import { betKey, gateKey, taskKey, RECALL_GATE } from '../flow'
import { useProgress } from '../progress'
import { recallGate } from '../recall/pool'
import { BetPanel, RevealButton, SceneRuntimeContext, type SceneRuntime } from './bets'
import { BUTTON, QUIET_BUTTON } from './controls'
import { GateRunner, useGateController } from './GateRunner'
import { applyGating, releaseGating } from './gating'
import { useItemStage } from './itemStage'
import { StoryScene } from './StoryScene'

export interface SceneFrameProps {
  readonly chapter: AnyChapterId
  readonly def: ChapterDef
  readonly scene: SceneDef
  readonly index: number
  readonly canNext: boolean
  readonly isLast: boolean
  readonly recallUi: ItemUiMap
  onNext(): void
  onBack(): void
}

/** Commit a bet of this chapter (the UI and __course.bet share it). No-op when already committed. */
export function commitBet(chapter: AnyChapterId, bet: string, value: string): boolean {
  const key = betKey(chapter, bet)
  const p = useProgress.getState()
  if (p.bets[key]) return false
  p.setBet(key, { value, correct: null, at: now() })
  emit({ type: 'bet.commit', bet: key, value })
  return true
}

export function resolveBet(chapter: AnyChapterId, bet: string, truth: string): void {
  const key = betKey(chapter, bet)
  const p = useProgress.getState()
  const rec = p.bets[key]
  if (!rec) return
  const correct = rec.value.toUpperCase() === truth.toUpperCase()
  if (rec.correct === correct) return
  p.setBet(key, { ...rec, correct })
  emit({ type: 'bet.resolve', bet: key, correct })
}

/** Press a key on the default store for a 'step' reveal, even when the scene keeps the keyboard locked. */
function stepPress(key: string): void {
  const m = useMachineStore.getState()
  const locks = m.locks
  if (locks.keyboard) m.setLocks({ ...locks, keyboard: false })
  try {
    m.pressKey(key)
  } finally {
    if (locks.keyboard) useMachineStore.getState().setLocks({ ...useMachineStore.getState().locks, keyboard: true })
  }
}

function GateBody(p: {
  gateKey: `${string}/${string}`
  binding: GateBinding
  recall: boolean
  onHandle(h: GateHandle | null): void
}): JSX.Element {
  const controller = useGateController(p.gateKey as never, p.binding, p.recall)
  const { onHandle } = p
  useEffect(() => {
    onHandle({
      get key() {
        return controller.key
      },
      get passed() {
        return controller.view().passed
      },
      get current() {
        return controller.view().current
      },
      get items() {
        return controller.view().items
      },
      get last() {
        const l = controller.getState().last
        return l ? { itemId: l.itemId, result: l.result } : null
      },
      submit: (itemId, answer) => controller.submit(itemId, answer),
      continue: () => controller.continue(),
    })
    return () => onHandle(null)
  }, [controller, onHandle])
  return <GateRunner gateKey={p.gateKey as never} binding={p.binding} recall={p.recall} controller={controller} />
}

export function SceneFrame(p: SceneFrameProps): JSX.Element {
  const { chapter, scene } = p
  const reducedMotion = useReducedMotion()
  const itemStage = useItemStage((s) => s.stage)
  const ownsMachine = useItemStage((s) => s.ownsMachine)
  const salt = useProgress((s) => s.salt)
  const reveals = useMemo(() => scene.reveals ?? [], [scene])
  const betIds = useMemo(() => (scene.bets ?? []).map((b) => b.id), [scene])
  const bets = useProgress(useShallow((s) => betIds.map((id) => s.bets[betKey(chapter, id)])))
  const tasksDone = useProgress(useShallow((s) => s.chapters[chapter]?.tasks ?? []))
  const betOf = (id: string): BetRecord | undefined => bets[betIds.indexOf(id)]
  const [fired, setFired] = useState<ReadonlySet<string>>(() => new Set())
  const [engaged, setEngaged] = useState<ReadonlySet<string>>(() => new Set())
  const firedRef = useRef(fired)
  firedRef.current = fired
  const [gateHandle, setGateHandle] = useState<GateHandle | null>(null)

  // The scene's setup, applied on enter; its locks (and any bet gating) are released on leave.
  useLayoutEffect(() => {
    const m = useMachineStore.getState()
    const savedLocks = m.locks
    const setup = scene.setup
    if (setup?.machine) m.setConfig(setup.machine)
    if (setup?.locks) m.setLocks(setup.locks)
    if (setup?.toy) useToyStore.getState().setSpec(setup.toy)
    emit({ type: 'scene.enter', chapter, scene: scene.id })
    return () => {
      releaseGating()
      useMachineStore.getState().setLocks(savedLocks)
      useStageStore.getState().setHighlight([])
      useStageStore.getState().setGhost(null)
    }
  }, [chapter, scene])

  const isCommitted = useCallback(
    (bet: string) => useProgress.getState().bets[betKey(chapter, bet)] !== undefined,
    [chapter],
  )

  // Reveals fire in the scene's order (review m8): a reveal is allowed once its bet is committed and every
  // earlier reveal has fired. Repeats of a fired reveal stay allowed. Views must not assume any other order.
  // [contracts-v2] Except a repeat of a fired Step while the next reveal's bet is open: the Step presses the key,
  // and that key stays locked until the bet is committed (G10), so a Step cannot slip a press past the bet.
  const isAllowed = useCallback(
    (bet: string) => {
      const fired = firedRef.current
      const k = reveals.findIndex((x) => x.bet === bet)
      if (k === -1 || !isCommitted(bet) || !reveals.slice(0, k).every((x) => fired.has(x.bet))) return false
      if (reveals[k]!.trigger !== 'step' || !fired.has(bet)) return true
      const pending = reveals.find((x) => !fired.has(x.bet))
      return !pending || isCommitted(pending.bet)
    },
    [reveals, isCommitted],
  )

  const fire = useCallback(
    (bet: string) => {
      const r = reveals.find((x) => x.bet === bet)
      if (!r || !isAllowed(bet)) return
      if (r.trigger === 'step') stepPress(r.key ?? 'A')
      if (firedRef.current.has(bet)) return
      const next = new Set(firedRef.current).add(bet)
      firedRef.current = next
      setFired(next)
      emit({ type: 'reveal', bet: betKey(chapter, bet), trigger: r.trigger })
    },
    [chapter, reveals, isAllowed],
  )

  // G10 gating for the next reveal that has not fired.
  const nextReveal = reveals.find((r) => !fired.has(r.bet))
  const lock = !!nextReveal && betOf(nextReveal.bet) === undefined
  const gate = lock && (nextReveal === reveals[0] || engaged.has(nextReveal!.bet))
  useEffect(() => {
    applyGating({ lock, gate })
  }, [lock, gate])

  // A key press (machine or toy) fires the next committed 'press' reveal.
  useEffect(() => {
    if (!reveals.some((r) => r.trigger === 'press')) return
    const onPress = (key: string | undefined) => {
      const r = reveals.find(
        (x) => x.trigger === 'press' && !firedRef.current.has(x.bet) && isAllowed(x.bet) && (!x.key || x.key === key),
      )
      if (r) fire(r.bet)
    }
    const a = useMachineStore.subscribe((s, prev) => {
      if (s.seq !== prev.seq) onPress(s.input.at(-1))
    })
    const b = useToyStore.subscribe((s, prev) => {
      if (s.seq !== prev.seq && s.last) onPress(s.last.hops[0]?.input)
    })
    return () => {
      a()
      b()
    }
  }, [reveals, fire, isAllowed])

  const runtime: SceneRuntime = useMemo(
    () => ({ fired, isCommitted, isAllowed, fire }),
    [fired, isCommitted, isAllowed, fire],
  )

  const betHandle = useCallback(
    (id: string): BetHandle => {
      const rec = useProgress.getState().bets[betKey(chapter, id)]
      return {
        committed: rec !== undefined,
        value: rec?.value ?? null,
        commit: (v) => void commitBet(chapter, id, v),
        resolve: (truth) => resolveBet(chapter, id, truth),
      }
    },
    [chapter],
  )

  const props: SceneProps = {
    chapter,
    scene: scene.id,
    reducedMotion,
    store: useMachineStore,
    completeTask: (id) => useProgress.getState().addTask(chapter, taskKey(scene.id, id)),
    bet: betHandle,
    reveal: (id) => ({ allowed: isAllowed(id), fire: () => fire(id) }),
    gate: gateHandle,
  }

  const binding: GateBinding | null = useMemo(() => {
    if (scene.kind === 'gate' && scene.gate) return p.def.gates[scene.gate] ?? null
    if (scene.kind === 'recall') return { logic: recallGate(chapter, salt), ui: p.recallUi }
    return null
  }, [scene, p.def, chapter, salt, p.recallUi])

  const stage = itemStage !== undefined ? itemStage : scene.stage
  const alphabet =
    scene.setup?.toy?.n ??
    (scene.stage && (typeof scene.stage === 'string' ? scene.stage : scene.stage.preset) === 'toy' ? 6 : 26)
  const View = scene.View

  return (
    <SceneRuntimeContext.Provider value={runtime}>
      <article
        data-testid="scene"
        data-scene={scene.id}
        data-kind={scene.kind}
        data-reveals={JSON.stringify(reveals)}
        data-tasks={JSON.stringify((scene.tasks ?? []).map((t) => t.id))}
        className="flex flex-col gap-4"
      >
        <h2 className="text-xl font-semibold text-stone-100">{scene.title}</h2>
        {scene.kind === 'story' && scene.story ? <StoryScene story={scene.story} facts={p.def.facts} /> : null}
        {stage ? (
          <StageHost stage={stage} className="min-h-24 overflow-hidden rounded-lg border border-stone-800" />
        ) : null}
        {scene.panels && !ownsMachine ? <MachinePanel show={scene.panels} /> : null}
        {View ? <View {...props} /> : null}
        {scene.bets?.length ? (
          <div className="grid gap-3 md:grid-cols-2">
            {scene.bets.map((b) => (
              <BetPanel
                key={b.id}
                bet={b}
                record={betOf(b.id)}
                alphabet={alphabet}
                onEngage={() => setEngaged((e) => (e.has(b.id) ? e : new Set(e).add(b.id)))}
                onCommit={(v) => commitBet(chapter, b.id, v)}
              />
            ))}
          </div>
        ) : null}
        {reveals.some((r) => r.trigger !== 'press') ? (
          <div className="flex flex-wrap gap-2">
            {reveals
              .filter((r) => r.trigger !== 'press')
              .map((r) => (
                <RevealButton key={r.bet} reveal={r} />
              ))}
          </div>
        ) : null}
        {scene.tasks?.length ? (
          <ul className="flex flex-col gap-1 text-sm" aria-label="Tasks">
            {scene.tasks.map((t) => {
              const done = tasksDone.includes(taskKey(scene.id, t.id))
              return (
                <li
                  key={t.id}
                  data-testid={`task-${t.id}`}
                  data-done={String(done)}
                  className={done ? 'text-emerald-300' : 'text-stone-300'}
                >
                  {done ? '✓' : '○'} {t.label}
                </li>
              )
            })}
          </ul>
        ) : null}
        {binding ? (
          <GateBody
            key={scene.kind === 'recall' ? gateKey(chapter, RECALL_GATE) : gateKey(chapter, scene.gate!)}
            gateKey={scene.kind === 'recall' ? gateKey(chapter, RECALL_GATE) : gateKey(chapter, scene.gate!)}
            binding={binding}
            recall={scene.kind === 'recall'}
            onHandle={setGateHandle}
          />
        ) : scene.kind === 'gate' ? (
          <p className="text-sm text-red-300">Gate {scene.gate} is missing.</p>
        ) : null}
        <nav className="flex items-center justify-between gap-2 border-t border-stone-800 pt-3">
          <button
            type="button"
            data-testid="scene-back"
            className={QUIET_BUTTON}
            disabled={p.index === 0}
            onClick={p.onBack}
          >
            Back
          </button>
          <button
            type="button"
            data-testid="scene-next"
            className={BUTTON}
            aria-disabled={!p.canNext}
            onClick={() => {
              if (p.canNext) p.onNext()
            }}
          >
            {p.isLast ? 'Finish the chapter' : 'Next'}
          </button>
        </nav>
      </article>
    </SceneRuntimeContext.Provider>
  )
}
