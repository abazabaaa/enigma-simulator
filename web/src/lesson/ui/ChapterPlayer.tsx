/**
 * ChapterPlayer (PLAN §2.2 item 7, §2.3): runs a chapter's scenes with the XState chapter machine, rebuilt
 * from ProgressV1 on every mount. The URL shows the current scene (#/c/<id>/<scene>, #/lab/fixture/<scene>);
 * a scene beyond `reached` (or an unknown one) redirects to the furthest reached scene. It also runs the
 * return-visit check and keeps lastVisit up to date.
 */

import { useCallback, useEffect, useRef, useState, type JSX } from 'react'
import type { AnyChapterId } from '../../contracts/core'
import type { ChapterDef } from '../../contracts/lesson'
import { CHAPTERS } from '../../content/registry'
import { navigate } from '../../router'
import { chapterContext, startChapter, type ChapterActor, type ChapterContext } from '../chapterMachine'
import { now, useClock } from '../clock'
import { emit } from '../events'
import { canAdvanceScene, eligibleActs, nextChapter, returnCheckDue, taskKey } from '../flow'
import { progressSnapshot, useProgress } from '../progress'
import { RECALL_UI } from '../recall/items'
import { returnCheckItems, type RecallId } from '../recall/pool'
import { registerPlayer } from '../runtime'
import { seedFor } from '../../lib/rng'
import { commitBet, SceneFrame } from './SceneFrame'
import { ProgressNotices } from './ProgressNotices'
import { ReturnCheck, type ReturnCheckState } from './ReturnCheck'

function dueCheck(): ReturnCheckState | null {
  const p = progressSnapshot()
  if (!returnCheckDue(p, now())) return null
  const items: RecallId[] = returnCheckItems(
    eligibleActs(CHAPTERS, p),
    p.recall,
    seedFor(p.salt, p.lastVisit, 'return'),
  )
  return items.length ? { stamp: p.lastVisit, items } : null
}

export function ChapterPlayer(p: {
  def: ChapterDef
  chapterId: AnyChapterId
  /** '/c/<id>' or '/lab/fixture'. */
  basePath: string
  sceneParam: string | undefined
}): JSX.Element {
  const { def, chapterId } = p
  const scenes = def.scenes
  const [actor, setActor] = useState<ChapterActor | null>(null)
  const [ctx, setCtx] = useState<ChapterContext | null>(null)
  const [done, setDone] = useState(false)
  const [check, setCheck] = useState<ReturnCheckState | null>(() => dueCheck())
  const checkRef = useRef(check)
  checkRef.current = check
  const progress = useProgress()
  const offset = useClock((s) => s.offset)

  const complete = useCallback(() => {
    const prev = useProgress.getState().chapters[chapterId]
    useProgress
      .getState()
      .patchChapter(chapterId, { completed: true, reached: Math.max(prev?.reached ?? 0, scenes.length - 1) })
    emit({ type: 'chapter.complete', chapter: chapterId })
    setDone(true)
  }, [chapterId, scenes.length])
  const completeRef = useRef(complete)
  completeRef.current = complete

  // The machine, rebuilt from progress on every mount (never from a snapshot).
  useEffect(() => {
    const rec = useProgress.getState().chapters[chapterId]
    const reached = Math.min(scenes.length - 1, rec?.reached ?? 0)
    const asked = p.sceneParam ? scenes.findIndex((s) => s.id === p.sceneParam) : -1
    const start = asked !== -1 && asked <= reached ? asked : rec?.completed && !p.sceneParam ? 0 : reached
    const a = startChapter({
      count: scenes.length,
      start,
      reached,
      canAdvance: (i) => canAdvanceScene(chapterId, scenes[i]!, useProgress.getState()),
      onComplete: () => completeRef.current(),
    })
    const sub = a.subscribe((snap) => setCtx(snap.context as ChapterContext))
    setCtx(chapterContext(a))
    setActor(a)
    return () => {
      sub.unsubscribe()
      a.stop()
    }
    // The URL is read once here; later URL changes are handled below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [def, chapterId])

  const index = ctx?.index ?? -1
  const reached = ctx?.reached ?? 0

  // Machine → progress and URL.
  useEffect(() => {
    if (index < 0) return
    const rec = useProgress.getState().chapters[chapterId]
    if ((rec?.reached ?? -1) < reached) useProgress.getState().patchChapter(chapterId, { reached })
    const want = scenes[index]!.id
    if (p.sceneParam !== want) {
      const known = p.sceneParam !== undefined && scenes.some((s) => s.id === p.sceneParam)
      navigate(`${p.basePath}/${want}`, undefined, {
        replace: !known || scenes.findIndex((s) => s.id === p.sceneParam) > reached,
      })
    }
    if (!checkRef.current) useProgress.getState().visit(now())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, reached])

  // URL → machine (the back button, a typed URL): GOTO within reached, else redirect.
  useEffect(() => {
    if (!actor || index < 0 || p.sceneParam === undefined) return
    const i = scenes.findIndex((s) => s.id === p.sceneParam)
    if (i === index) return
    if (i === -1 || i > reached) navigate(`${p.basePath}/${scenes[index]!.id}`, undefined, { replace: true })
    else actor.send({ type: 'GOTO', index: i })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.sceneParam])

  // The return-visit check (§4.2): due on entry, or when the clock moves (e2e configure({ now })).
  useEffect(() => {
    if (!checkRef.current) {
      const due = dueCheck()
      if (due) setCheck(due)
    }
  }, [offset])
  useEffect(() => {
    if (check)
      emit({
        type: 'return-check',
        items: check.items.map((id, k) => `${chapterId}/return-${check.stamp}-${k}/${id}` as const),
      })
  }, [check, chapterId])

  // lastVisit on leaving the tab.
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'hidden' && !checkRef.current) useProgress.getState().visit(now())
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [])

  const scene = index >= 0 ? scenes[index] : undefined
  const canNext = scene ? canAdvanceScene(chapterId, scene, progress) : false

  const next = useCallback((): boolean => {
    if (!actor || !scene) return false
    if (!canAdvanceScene(chapterId, scene, useProgress.getState())) return false
    emit({ type: 'scene.complete', chapter: chapterId, scene: scene.id })
    actor.send({ type: 'NEXT' })
    return true
  }, [actor, scene, chapterId])

  const nextRef = useRef(next)
  nextRef.current = next
  const sceneRef = useRef(scene)
  sceneRef.current = scene

  useEffect(
    () =>
      registerPlayer({
        where() {
          const s = sceneRef.current
          const i = s ? scenes.indexOf(s) : -1
          return {
            chapter: chapterId,
            scene: s?.id ?? null,
            index: i,
            kind: s?.kind ?? null,
            canNext: s ? canAdvanceScene(chapterId, s, useProgress.getState()) : false,
            locked: false,
          }
        },
        next: () => nextRef.current(),
        bet(betId, value) {
          const s = sceneRef.current
          if (!s?.bets?.some((b) => b.id === betId)) throw new Error(`Bet '${betId}' is not in scene '${s?.id}'`)
          commitBet(chapterId, betId, value)
        },
        completeTasks() {
          const s = sceneRef.current
          for (const t of s?.tasks ?? []) useProgress.getState().addTask(chapterId, taskKey(s!.id, t.id))
        },
      }),
    [chapterId, scenes],
  )

  const upcoming = nextChapter(CHAPTERS, chapterId)
  return (
    <div className="flex flex-col gap-4">
      {/* While the return check is open, the chapter behind it is inert (no focus, no clicks). */}
      <div className="flex flex-col gap-4" inert={check ? true : undefined}>
        <ProgressNotices />
        <ol className="flex flex-wrap gap-1" aria-label="Scenes">
          {scenes.map((s, k) => (
            <li key={s.id}>
              <a
                href={k <= reached ? `#${p.basePath}/${s.id}` : undefined}
                aria-current={k === index ? 'step' : undefined}
                aria-disabled={k > reached ? true : undefined}
                title={s.title}
                className={`block h-2 w-6 rounded ${k === index ? 'bg-amber-400' : k <= reached ? 'bg-stone-500' : 'bg-stone-800'}`}
              >
                <span className="sr-only">
                  {k + 1}. {s.title}
                </span>
              </a>
            </li>
          ))}
        </ol>
        {scene && actor ? (
          <SceneFrame
            key={scene.id}
            chapter={chapterId}
            def={def}
            scene={scene}
            index={index}
            canNext={canNext}
            isLast={index === scenes.length - 1}
            recallUi={RECALL_UI}
            onNext={() => void next()}
            onBack={() => actor.send({ type: 'BACK' })}
          />
        ) : (
          <p className="text-sm text-stone-400">Loading the chapter…</p>
        )}
        {done || progress.chapters[chapterId]?.completed ? (
          <section
            data-testid="chapter-complete"
            className="rounded-lg border border-emerald-700 bg-emerald-950/30 p-3 text-sm"
          >
            <p className="font-semibold text-emerald-200">Chapter complete.</p>
            <p className="mt-1 flex flex-wrap gap-3">
              {upcoming ? (
                <a data-testid="chapter-next-link" className="text-amber-300 underline" href={`#/c/${upcoming.id}`}>
                  Next: {upcoming.title}
                </a>
              ) : null}
              <a className="text-amber-300 underline" href="#/course">
                The course map
              </a>
            </p>
          </section>
        ) : null}
      </div>
      {check ? (
        <ReturnCheck
          chapter={chapterId}
          check={check}
          onDone={() => {
            setCheck(null)
            useProgress.getState().visit(now())
          }}
        />
      ) : null}
    </div>
  )
}
