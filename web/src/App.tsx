import type { ComponentType } from 'react'
import { useRoute } from './router'
import { EngineDevPage } from './pages/EngineDevPage'
import { HomePage } from './pages/HomePage'

/** Route table. Later PRs add chapters here (e.g. '/machine', '/chapter/1'). */
const ROUTES: Record<string, ComponentType> = {
  '/': HomePage,
  '/engine': EngineDevPage,
}

export default function App() {
  const route = useRoute()
  const Page = ROUTES[route] ?? HomePage
  return <Page />
}
