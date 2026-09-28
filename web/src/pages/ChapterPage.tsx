import { useEffect, useState } from 'react'
import { CHAPTERS, chapterMeta, isChapterId } from '../content/registry'
import type { ChapterDef } from '../contracts/lesson'
import { ChapterPlayer, LockedPage, isLocked, previousRequired, useProgress } from '../lesson'
import { useCourseConfig } from '../lesson/config'
import { useRoute } from '../router'

/** #/c/:chapter[/:scene]: a locked chapter shows LockedPage; otherwise the chapter runtime. */
export function ChapterPage() {
  const { params } = useRoute()
  const id = params.chapter ?? ''
  const meta = isChapterId(id) ? chapterMeta(id) : undefined
  const chapters = useProgress((s) => s.chapters)
  const unlockAll = useCourseConfig((s) => s.unlockAll)
  const [def, setDef] = useState<{ id: string; def: ChapterDef } | null>(null)
  const locked = meta ? !unlockAll && isLocked(CHAPTERS, meta.id, { chapters } as never) : false

  useEffect(() => {
    if (!meta || locked) return
    let live = true
    void meta.load().then((m) => {
      if (live) setDef({ id: meta.id, def: m.default })
    })
    return () => {
      live = false
    }
  }, [meta, locked])

  if (!meta) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-2xl font-semibold text-stone-100">No such chapter</h1>
        <p className="mt-3">
          <a className="text-amber-300 underline" href="#/course">
            The course map
          </a>
        </p>
      </main>
    )
  }
  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-4 px-4 py-6">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl font-semibold text-stone-100">{meta.title}</h1>
        <a className="text-sm text-amber-300 underline" href="#/course">
          The course
        </a>
      </header>
      {locked ? (
        <LockedPage meta={meta} previous={previousRequired(CHAPTERS, meta.id)} />
      ) : def && def.id === meta.id ? (
        <ChapterPlayer key={meta.id} def={def.def} chapterId={meta.id} basePath={`/c/${meta.id}`} sceneParam={params.scene} />
      ) : (
        <p className="text-sm text-stone-400">Loading the chapter…</p>
      )}
    </main>
  )
}
