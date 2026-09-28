import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { installWindowApi } from './debug/windowApi.ts'
import { applySymbolTokens } from './lib/symbols.ts'
import { StageErrorBoundary } from './stage/StageErrorBoundary.tsx'
import { installStageApi } from './stage/stageApi.ts'
import { installSync } from './state/sync.ts'

// A path-style deep link (served by 404.html on GitHub Pages) becomes the equivalent hash route:
// /enigma-simulator/course?x=1 → /enigma-simulator/?x=1#/course
const base = import.meta.env.BASE_URL
if (location.pathname.startsWith(base) && location.pathname.length > base.length && !location.hash) {
  const rest = location.pathname.slice(base.length).replace(/\/+$/, '').replace(/index\.html$|404\.html$/, '')
  if (rest) history.replaceState(null, '', `${base}${location.search}#/${rest}`)
}

applySymbolTokens()
installWindowApi()
installStageApi()
installSync()

createRoot(document.getElementById('root')!, {
  // A failing 3D view is recoverable (StageHost falls back to 2D): report it as a warning.
  onCaughtError(error, info) {
    if (info.errorBoundary instanceof StageErrorBoundary) console.warn('3D stage error (recovered):', error)
    else console.error(error, info.componentStack)
  },
}).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
