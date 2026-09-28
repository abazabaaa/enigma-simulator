/**
 * URL flags, placed BEFORE the hash so they survive in-app navigation (PLAN §2.3):
 *   ?e2e=1            enables the e2e-only hooks; remembered for the tab in sessionStorage (?e2e=0 clears it)
 *   ?stage=2d|3d      forces a renderer
 *   ?motion=reduce|full overrides reduced motion
 *   ?seed=<salt>      fixes the progress salt
 * e.g. /enigma-simulator/?e2e=1&stage=2d#/lab/stage?preset=pawls
 */

import { sessionStore } from './storage'

export interface Flags {
  readonly e2e: boolean
  readonly stage: '2d' | '3d' | null
  readonly motion: 'reduce' | 'full' | null
  readonly seed: string | null
}

const E2E_KEY = 'enigma.e2e'

/** Pure parse of a location.search string. `e2e` is null when the flag is absent. */
export function parseFlags(search: string): Omit<Flags, 'e2e'> & { readonly e2e: boolean | null } {
  const q = new URLSearchParams(search)
  const e2e = q.get('e2e')
  const stage = q.get('stage')
  const motion = q.get('motion')
  const seed = q.get('seed')
  return {
    e2e: e2e === null ? null : e2e === '1' || e2e === 'true',
    stage: stage === '2d' || stage === '3d' ? stage : null,
    motion: motion === 'reduce' || motion === 'full' ? motion : null,
    seed: seed === null || seed === '' ? null : seed,
  }
}

let cache: { search: string; flags: Flags } | null = null

/** The current flags (cached per location.search). */
export function getFlags(): Flags {
  const search = typeof location === 'undefined' ? '' : location.search
  if (cache?.search === search) return cache.flags
  const parsed = parseFlags(search)
  if (parsed.e2e === true) sessionStore.set(E2E_KEY, '1')
  if (parsed.e2e === false) sessionStore.remove(E2E_KEY)
  const flags: Flags = { ...parsed, e2e: parsed.e2e ?? sessionStore.get(E2E_KEY) === '1' }
  cache = { search, flags }
  return flags
}

/** True when the page was opened with ?e2e=1 (in this tab). */
export function isE2E(): boolean {
  return getFlags().e2e
}
