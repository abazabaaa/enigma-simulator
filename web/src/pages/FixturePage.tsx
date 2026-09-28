import { ChapterPlayer } from '../lesson'
import fixture from '../lesson/fixture'
import { useRoute } from '../router'

/** #/lab/fixture[/:scene]: the hidden fixture chapter that uses every generic item kind. */
export function FixturePage() {
  const { params } = useRoute()
  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-4 px-4 py-6">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl font-semibold text-stone-100">Fixture chapter</h1>
        <span className="text-xs text-stone-500">lab-fixture · every scene and item kind</span>
      </header>
      <ChapterPlayer def={fixture} chapterId="lab-fixture" basePath="/lab/fixture" sceneParam={params.scene} />
    </main>
  )
}
