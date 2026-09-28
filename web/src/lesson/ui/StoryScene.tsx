import type { JSX } from 'react'
import type { ClockSpec, Fact, StorySpec } from '../../contracts/lesson'
import { formatSci, keyspace } from '../../lib/keyspace'

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

function parseDate(f: Fact | undefined): { year: string; month: string | null; day: string | null } | null {
  const m = /^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/.exec(String(f?.value ?? ''))
  if (!m) return null
  return { year: m[1]!, month: m[2] ? MONTHS[Number(m[2]) - 1]! : null, day: m[3] ? String(Number(m[3])) : null }
}

/** A STATIC clock and calendar (G12, G17): it reads the date from the facts and never counts anything. */
export function ActClock({ clock, facts }: { clock: ClockSpec; facts: readonly Fact[] }): JSX.Element {
  const fact = facts.find((f) => f.id === clock.date)
  const date = parseDate(fact)
  const [hh, mm] = (clock.time ?? '').split(':').map(Number)
  const hasTime = Number.isFinite(hh) && Number.isFinite(mm)
  const hourAngle = hasTime ? (((hh! % 12) + mm! / 60) / 12) * 360 : 0
  const minuteAngle = hasTime ? (mm! / 60) * 360 : 0
  const dateText = date ? [date.day, date.month, date.year].filter(Boolean).join(' ') : (fact?.text ?? '')
  const label = `${clock.caption} ${dateText}${hasTime ? `, ${clock.time}` : ''}`.trim()
  return (
    <figure
      data-testid="act-clock"
      aria-label={label}
      role="img"
      className="flex items-center gap-4 rounded-lg border border-stone-700 p-3"
    >
      <svg viewBox="0 0 64 64" width="64" height="64" aria-hidden="true" className="shrink-0 text-stone-300">
        <circle cx="32" cy="32" r="29" fill="none" stroke="currentColor" strokeWidth="2" />
        {Array.from({ length: 12 }, (_, k) => (
          <line
            key={k}
            x1="32"
            y1="6"
            x2="32"
            y2="10"
            stroke="currentColor"
            strokeWidth="2"
            transform={`rotate(${k * 30} 32 32)`}
          />
        ))}
        {hasTime ? (
          <>
            <line
              x1="32"
              y1="32"
              x2="32"
              y2="18"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              transform={`rotate(${hourAngle} 32 32)`}
            />
            <line
              x1="32"
              y1="32"
              x2="32"
              y2="10"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              transform={`rotate(${minuteAngle} 32 32)`}
            />
          </>
        ) : null}
        <circle cx="32" cy="32" r="2" fill="currentColor" />
      </svg>
      <div className="flex flex-col">
        {date ? (
          <div className="flex flex-col rounded border border-stone-600 text-center" aria-hidden="true">
            <span className="bg-red-900/60 px-2 text-xs uppercase text-stone-200">{date.month ?? '—'}</span>
            <span className="px-2 text-lg font-semibold text-stone-100">{date.day ?? date.year}</span>
            <span className="px-2 text-xs text-stone-400">{date.year}</span>
          </div>
        ) : (
          <span className="text-sm text-stone-300">{fact?.text}</span>
        )}
        <figcaption className="mt-1 max-w-xs text-xs text-stone-400">{clock.caption}</figcaption>
      </div>
    </figure>
  )
}

/** A story scene (G12): a data-only card of at most 120 words with its people and date from the facts. */
export function StoryScene({ story, facts }: { story: StorySpec; facts: readonly Fact[] }): JSX.Element {
  const byId = (id: string) => facts.find((f) => f.id === id)
  const people = story.people.map(byId).filter((f): f is Fact => !!f)
  const date = byId(story.date)
  return (
    <div className="flex flex-col gap-4">
      {story.clock ? <ActClock clock={story.clock} facts={facts} /> : null}
      <article
        data-testid="story-card"
        className="rounded-lg border border-stone-700 bg-stone-900/60 p-4 leading-relaxed text-stone-200"
      >
        <p className="whitespace-pre-line">{story.text}</p>
        <footer className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-stone-400">
          {people.length ? <span>{people.map((p) => p.text).join(', ')}</span> : null}
          {date ? <span>{date.text}</span> : null}
        </footer>
        {story.figure === 'keyspace' ? (
          <p className="mt-3 font-mono text-sm text-amber-200" data-testid="keyspace-figure">
            {formatSci(keyspace())} settings; {formatSci(keyspace({ rings: true }))} with the ring settings.
          </p>
        ) : null}
      </article>
    </div>
  )
}
