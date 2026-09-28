/**
 * Caches for seeded generators (PLAN §3.1 purity). The gate engine regenerates an instance from its seed many times
 * (the draw, the view, the repeat check, __course.gate()), and some generators search or encipher. These caches keep
 * each result a pure function of its seed. Chapters may adopt them in place of their local copies
 * (iii9-cribs and iii10-menus `memoised`, iv-capstone `memo`); PURE, unit-tested.
 */

import { createRng, type Rng } from './rng'

/** Keep at most `size` entries, dropping the oldest first. */
function remember<K, V>(cache: Map<K, V>, key: K, value: V, size: number): V {
  if (cache.size >= size) cache.delete(cache.keys().next().value!)
  cache.set(key, value)
  return value
}

/**
 * Wrap a generator `(r: Rng) => I`. The cache keys on the Rng's first draw and builds the instance from a generator
 * seeded by that draw, so equal seeds give the SAME object and the result is still a pure function of the seed.
 * (It consumes exactly one draw from `r`.)
 */
export function memoised<I>(make: (r: Rng) => I, size = 800): (r: Rng) => I {
  const cache = new Map<number, I>()
  return (r) => {
    const key = r()
    const hit = cache.get(key)
    return hit !== undefined ? hit : remember(cache, key, make(createRng(Math.floor(key * 2 ** 32))), size)
  }
}

/** Wrap a function of a key (a seed, an id): the same key gives the same object, at most `size` kept. */
export function memoByKey<K, T>(make: (key: K) => T, size = 400): (key: K) => T {
  const cache = new Map<K, T>()
  return (key) => (cache.has(key) ? cache.get(key)! : remember(cache, key, make(key), size))
}
