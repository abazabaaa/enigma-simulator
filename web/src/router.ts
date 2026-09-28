/**
 * A tiny hash router (GitHub Pages has no SPA fallback, so routes live in the hash). The hash is
 * `#/path?query`; URL flags such as ?e2e=1 go BEFORE the hash (lib/flags.ts). The route table is
 * PLAN §2.3; App.tsx maps each pattern to a lazily loaded page.
 */

import { useSyncExternalStore } from 'react'

/** Every route pattern, in match order. `:name` matches one path segment. */
export const ROUTE_PATTERNS = [
  '/',
  '/course',
  '/c/:chapter',
  '/c/:chapter/:scene',
  '/machine',
  '/engine',
  '/lab/stage',
  '/lab/fixture',
  '/lab/fixture/:scene',
  '/lab/gate/:chapter/:gate',
  '/lab/viz',
] as const
export type RoutePattern = (typeof ROUTE_PATTERNS)[number]

export interface Route {
  /** The path without the leading '#', e.g. '/c/i2-stepping/gate'. Defaults to '/'. */
  readonly path: string
  /** The matching pattern, or null for an unknown path. */
  readonly pattern: RoutePattern | null
  /** Decoded `:name` segments of the matching pattern. */
  readonly params: Readonly<Record<string, string>>
  /** The hash query, e.g. { preset: 'pawls' } for #/lab/stage?preset=pawls. */
  readonly query: Readonly<Record<string, string>>
}

/** The params when `path` matches `pattern` ('/c/:chapter'), else null. */
export function matchRoute(pattern: string, path: string): Record<string, string> | null {
  const want = pattern.split('/').filter(Boolean)
  const got = path.split('/').filter(Boolean)
  if (want.length !== got.length) return null
  const params: Record<string, string> = {}
  for (let i = 0; i < want.length; i++) {
    const w = want[i]!
    const g = got[i]!
    if (w.startsWith(':')) {
      try {
        params[w.slice(1)] = decodeURIComponent(g)
      } catch {
        return null
      }
    } else if (w !== g) {
      return null
    }
  }
  return params
}

/** Parse a location.hash such as '#/lab/stage?preset=pawls&locks=keyboard'. */
export function parseHash(hash: string): Route {
  const raw = hash.replace(/^#/, '')
  const q = raw.indexOf('?')
  const pathPart = q === -1 ? raw : raw.slice(0, q)
  const path = pathPart === '' ? '/' : pathPart.startsWith('/') ? pathPart : `/${pathPart}`
  const query = Object.fromEntries(new URLSearchParams(q === -1 ? '' : raw.slice(q + 1)))
  for (const pattern of ROUTE_PATTERNS) {
    const params = matchRoute(pattern, path)
    if (params) return { path, pattern, params, query }
  }
  return { path, pattern: null, params: {}, query }
}

/** A hash for a path and query: hrefFor('/lab/stage', { preset: 'pawls' }) → '#/lab/stage?preset=pawls'. */
export function hrefFor(path: string, query: Readonly<Record<string, string>> = {}): string {
  const qs = new URLSearchParams(query).toString()
  return `#${path}${qs ? `?${qs}` : ''}`
}

/** Navigate within the app (keeps the ?flags before the hash). */
export function navigate(path: string, query?: Readonly<Record<string, string>>, o: { replace?: boolean } = {}): void {
  const hash = hrefFor(path, query)
  if (o.replace) {
    history.replaceState(history.state, '', `${location.pathname}${location.search}${hash}`)
    window.dispatchEvent(new HashChangeEvent('hashchange'))
  } else {
    location.hash = hash
  }
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener('hashchange', onChange)
  return () => window.removeEventListener('hashchange', onChange)
}

let cached: { hash: string; route: Route } | null = null

function snapshot(): Route {
  const hash = window.location.hash
  if (cached?.hash !== hash) cached = { hash, route: parseHash(hash) }
  return cached.route
}

const SERVER_ROUTE = parseHash('')

/** Current route path without the leading '#', e.g. '/engine'. Defaults to '/'. (01's API.) */
export function currentRoute(): string {
  return snapshot().path
}

export function useRoute(): Route {
  return useSyncExternalStore(subscribe, snapshot, () => SERVER_ROUTE)
}
