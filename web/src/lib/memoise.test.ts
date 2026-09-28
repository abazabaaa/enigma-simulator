import { describe, expect, it } from 'vitest'
import { memoByKey, memoised } from './memoise'
import { createRng, int, type Rng } from './rng'

/** A generator that counts its calls and returns a fresh object. */
function counting() {
  let calls = 0
  const make = (r: Rng) => {
    calls++
    return { a: int(r, 1000), b: int(r, 1000) }
  }
  return { make, calls: () => calls }
}

describe('memoised (seeded generators)', () => {
  it('is a pure function of the seed: the same seed gives the same object, built once', () => {
    const c = counting()
    const gen = memoised(c.make)
    const x = gen(createRng(7))
    expect(gen(createRng(7))).toBe(x)
    expect(c.calls()).toBe(1)
    // … and equals the uncached generator seeded by the first draw.
    const first = createRng(7)()
    expect(x).toEqual(c.make(createRng(Math.floor(first * 2 ** 32))))
  })

  it('different seeds give (almost always) different instances', () => {
    const gen = memoised(counting().make)
    const seen = new Set(Array.from({ length: 50 }, (_, s) => JSON.stringify(gen(createRng(s)))))
    expect(seen.size).toBeGreaterThan(45)
  })

  it('consumes exactly one draw from the caller’s Rng', () => {
    const gen = memoised(counting().make)
    const r = createRng(3)
    const control = createRng(3)
    gen(r)
    control()
    expect(r()).toBe(control())
  })

  it('keeps at most `size` entries, dropping the oldest', () => {
    const c = counting()
    const gen = memoised(c.make, 2)
    gen(createRng(1))
    gen(createRng(2))
    gen(createRng(3)) // evicts seed 1
    gen(createRng(3))
    gen(createRng(2))
    expect(c.calls()).toBe(3)
    gen(createRng(1))
    expect(c.calls()).toBe(4)
  })
})

describe('memoByKey', () => {
  it('builds once per key, keeps at most `size`, and caches falsy values too', () => {
    let calls = 0
    const f = memoByKey((k: number) => {
      calls++
      return k % 2 === 0 ? 0 : { k }
    }, 2)
    expect(f(2)).toBe(0)
    expect(f(2)).toBe(0)
    const one = f(1)
    expect(f(1)).toBe(one)
    expect(calls).toBe(2)
    f(3) // evicts 2
    f(2)
    expect(calls).toBe(4)
  })
})
