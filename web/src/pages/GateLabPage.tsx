import { useEffect, useState } from 'react'
import { chapterMeta, isChapterId } from '../content/registry'
import type { AnyChapterId, GateKey } from '../contracts/core'
import type { ChapterDef } from '../contracts/lesson'
import { LAB_CHAPTER_ID } from '../contracts/core'
import { GateRunner, ProgressNotices } from '../lesson'
import { useItemStage } from '../lesson/ui/itemStage'
import { useRoute } from '../router'
import { StageHost } from '../stage/StageHost'

/**
 * #/lab/gate/:chapter/:gate: one gate alone, for review. Its progress is kept apart from the chapter's
 * (gate key '<chapter>/lab:<gate>'), so reviewing a gate never passes it in the course.
 */
export function GateLabPage() {
  const { params } = useRoute()
  const chapter = params.chapter ?? ''
  const gate = params.gate ?? ''
  const [def, setDef] = useState<ChapterDef | null | 'missing'>(null)
  const itemStage = useItemStage((s) => s.stage)

  useEffect(() => {
    let live = true
    const load =
      chapter === LAB_CHAPTER_ID
        ? import('../lesson/fixture').then((m) => m.default)
        : isChapterId(chapter)
          ? chapterMeta(chapter)!
              .load()
              .then((m) => m.default)
          : Promise.resolve('missing' as const)
    void load.then((d) => live && setDef(d))
    return () => {
      live = false
    }
  }, [chapter])

  const binding = def && def !== 'missing' ? def.gates[gate] : undefined
  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-4 px-4 py-6">
      <h1 className="text-2xl font-semibold text-stone-100">
        Gate lab: {chapter}/{gate}
      </h1>
      <ProgressNotices />
      {def === null ? <p className="text-sm text-stone-400">Loading…</p> : null}
      {def !== null && !binding ? (
        <p data-testid="gate-missing" className="text-stone-400">
          There is no gate “{gate}” in {chapter}.
        </p>
      ) : null}
      {binding ? (
        <>
          {itemStage !== null ? (
            <StageHost
              stage={itemStage ?? 'overview'}
              className="min-h-24 overflow-hidden rounded-lg border border-stone-800"
            />
          ) : null}
          <GateRunner
            key={`${chapter}/${gate}`}
            gateKey={`${chapter as AnyChapterId}/lab:${gate}` as GateKey}
            binding={binding}
          />
        </>
      ) : null}
    </main>
  )
}
