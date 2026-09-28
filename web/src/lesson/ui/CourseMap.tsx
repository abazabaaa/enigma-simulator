import type { JSX } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { ACTS, CHAPTERS } from '../../content/registry'
import type { ProgressV1 } from '../../contracts/progress'
import { isLocked } from '../flow'
import { useProgress } from '../progress'

/**
 * The course map (course-map): every chapter by act, with its lock state from the learner's progress
 * (chapter-link-<id> carries data-locked and data-completed), and the bets made / bets right.
 */
export function CourseMap({ heading = true }: { heading?: boolean }): JSX.Element {
  const { chapters, bets } = useProgress(useShallow((s) => ({ chapters: s.chapters, bets: s.bets })))
  const p = { chapters } as ProgressV1
  const made = Object.keys(bets).length
  const right = Object.values(bets).filter((b) => b.correct === true).length
  return (
    <nav data-testid="course-map" aria-label="The course" className="flex flex-col gap-5">
      {heading ? <h2 className="text-xl font-semibold text-stone-100">The course</h2> : null}
      {ACTS.map((act) => (
        <section key={act.id} className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-stone-400">{act.title}</h3>
          <ol className="flex flex-col gap-1">
            {CHAPTERS.filter((c) => c.act === act.id).map((c) => {
              const locked = isLocked(CHAPTERS, c.id, p)
              const done = chapters[c.id]?.completed === true
              return (
                <li key={c.id} className="flex flex-wrap items-baseline gap-2">
                  <a
                    data-testid={`chapter-link-${c.id}`}
                    data-locked={String(locked)}
                    data-completed={String(done)}
                    aria-disabled={locked || undefined}
                    href={`#/c/${c.id}`}
                    className={locked ? 'text-stone-500' : 'text-amber-300 underline'}
                  >
                    {c.title}
                  </a>
                  <span className="font-mono text-xs text-stone-500">{c.dates}</span>
                  <span className="text-xs text-stone-400">
                    {done ? '✓ complete' : locked ? '🔒 locked' : chapters[c.id] ? 'in progress' : 'open'}
                    {c.optional ? ' · optional' : ''}
                  </span>
                </li>
              )
            })}
          </ol>
        </section>
      ))}
      <p data-testid="bets-summary" data-made={made} data-right={right} className="text-sm text-stone-400">
        Bets made: {made} · bets right: {right}
      </p>
    </nav>
  )
}
