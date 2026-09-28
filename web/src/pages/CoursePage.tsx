import { ACTS, CHAPTERS } from '../content/registry'

/** STUB (02 → 05). #/course: act map, progress, reset, export as JSON. Lists the registry for now. */
export function CoursePage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-3xl font-semibold text-stone-100">The course</h1>
      <p className="mt-4 text-stone-400">The act map, progress and export are on their way.</p>
      {ACTS.map((act) => (
        <section key={act.id} className="mt-6">
          <h2 className="text-lg font-semibold text-stone-200">{act.title}</h2>
          <ul className="mt-2 flex flex-col gap-1">
            {CHAPTERS.filter((c) => c.act === act.id).map((c) => (
              <li key={c.id}>
                <a className="text-amber-300 underline" href={`#/c/${c.id}`}>
                  {c.title}
                </a>{' '}
                <span className="font-mono text-xs text-stone-500">{c.dates}</span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </main>
  )
}
