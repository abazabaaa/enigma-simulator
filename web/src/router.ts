/**
 * A tiny hash router (GitHub Pages has no SPA fallback, so routes live in the hash):
 *   #/         → home
 *   #/engine   → hidden engine dev page (used by the Playwright e2e tests)
 */

import { useSyncExternalStore } from 'react'

function subscribe(onChange: () => void): () => void {
  window.addEventListener('hashchange', onChange)
  return () => window.removeEventListener('hashchange', onChange)
}

/** Current route path without the leading '#', e.g. '/engine'. Defaults to '/'. */
export function currentRoute(): string {
  const path = window.location.hash.replace(/^#/, '').split('?')[0] ?? ''
  return path === '' ? '/' : path
}

export function useRoute(): string {
  return useSyncExternalStore(subscribe, currentRoute, () => '/')
}
