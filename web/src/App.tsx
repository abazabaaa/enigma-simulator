import { Suspense, lazy, type ComponentType, type LazyExoticComponent } from 'react'
import { useRoute, type RoutePattern } from './router'
import { usePlaybackClock } from './state/playbackStore'

type Page = LazyExoticComponent<ComponentType>

/** Lazily load a page module's named export, so every page is its own chunk. */
function page<M>(load: () => Promise<M>, name: keyof M): Page {
  return lazy(async () => ({ default: (await load())[name] as ComponentType }))
}

const HomePage = page(() => import('./pages/HomePage'), 'HomePage')
const ChapterPage = page(() => import('./pages/ChapterPage'), 'ChapterPage')
const FixturePage = page(() => import('./pages/FixturePage'), 'FixturePage')

/** The route table (PLAN §2.3). Pages read their params and query with useRoute(). */
const PAGES: Readonly<Record<RoutePattern, Page>> = {
  '/': HomePage,
  '/course': page(() => import('./pages/CoursePage'), 'CoursePage'),
  '/c/:chapter': ChapterPage,
  '/c/:chapter/:scene': ChapterPage,
  '/machine': page(() => import('./pages/SandboxPage'), 'SandboxPage'),
  '/engine': page(() => import('./pages/EngineDevPage'), 'EngineDevPage'),
  '/lab/stage': page(() => import('./pages/StageLabPage'), 'StageLabPage'),
  '/lab/fixture': FixturePage,
  '/lab/fixture/:scene': FixturePage,
  '/lab/gate/:chapter/:gate': page(() => import('./pages/GateLabPage'), 'GateLabPage'),
  '/lab/viz': page(() => import('./pages/VizLabPage'), 'VizLabPage'),
}

function Loading() {
  return (
    <p data-testid="route-loading" className="p-6 font-mono text-sm text-stone-500">
      Loading…
    </p>
  )
}

export default function App() {
  usePlaybackClock()
  const route = useRoute()
  // Unknown paths show the home page.
  const Page = route.pattern ? PAGES[route.pattern] : HomePage
  return (
    <Suspense fallback={<Loading />}>
      <Page />
    </Suspense>
  )
}
