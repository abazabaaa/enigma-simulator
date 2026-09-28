import { useRoute } from '../router'

/** STUB (02 → 05). #/c/:chapter[/:scene]: the scene stepper, gates, bets and LockedPage. */
export function ChapterPage() {
  const { params } = useRoute()
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-3xl font-semibold text-stone-100">Chapter {params.chapter}</h1>
      <p className="mt-4 text-stone-400">The chapter runtime is on its way.</p>
    </main>
  )
}
