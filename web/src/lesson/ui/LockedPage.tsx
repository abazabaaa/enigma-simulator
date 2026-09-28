import { useEffect, type JSX } from 'react'
import type { ChapterMeta } from '../../contracts/lesson'
import { NOWHERE, registerPlayer } from '../runtime'

/** A chapter the learner has not unlocked yet (locked-page). */
export function LockedPage({ meta, previous }: { meta: ChapterMeta; previous: ChapterMeta | null }): JSX.Element {
  useEffect(
    () =>
      registerPlayer({
        where: () => ({ ...NOWHERE, chapter: meta.id, locked: true }),
        next: () => false,
        bet: () => {
          throw new Error(`${meta.id} is locked`)
        },
        completeTasks: () => {},
      }),
    [meta.id],
  )
  return (
    <section data-testid="locked-page" className="flex flex-col gap-3 rounded-lg border border-stone-700 p-4">
      <h2 className="text-xl font-semibold text-stone-100">{meta.title} is locked</h2>
      {previous ? (
        <p className="text-stone-300">
          Finish{' '}
          <a className="text-amber-300 underline" href={`#/c/${previous.id}`}>
            {previous.title}
          </a>{' '}
          first: this chapter builds on it.
        </p>
      ) : null}
      <p>
        <a className="text-amber-300 underline" href="#/course">
          Back to the course map
        </a>
      </p>
    </section>
  )
}
