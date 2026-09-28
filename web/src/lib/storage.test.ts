import { afterEach, describe, expect, it } from 'vitest'
import { createSafeStorage } from './storage'

const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')

function installLocalStorage(value: unknown) {
  Object.defineProperty(globalThis, 'localStorage', { value, configurable: true, writable: true })
}

afterEach(() => {
  if (original) Object.defineProperty(globalThis, 'localStorage', original)
  else delete (globalThis as { localStorage?: unknown }).localStorage
})

describe('createSafeStorage', () => {
  it('uses the real storage when it works', () => {
    const data = new Map<string, string>()
    installLocalStorage({
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => void data.set(k, v),
      removeItem: (k: string) => void data.delete(k),
    })
    const s = createSafeStorage('local')
    expect(s.set('a', '1')).toBe(true)
    expect(data.get('a')).toBe('1')
    expect(s.get('a')).toBe('1')
    s.remove('a')
    expect(s.get('a')).toBeNull()
    expect(s.persistent).toBe(true)
  })

  it('falls back to memory when storage throws', () => {
    installLocalStorage({
      getItem: () => {
        throw new Error('SecurityError')
      },
      setItem: () => {
        throw new Error('QuotaExceededError')
      },
      removeItem: () => {},
    })
    const s = createSafeStorage('local')
    expect(s.set('k', 'v')).toBe(false)
    expect(s.persistent).toBe(false)
    expect(s.get('k')).toBe('v')
    s.remove('k')
    expect(s.get('k')).toBeNull()
  })

  it('falls back to memory when there is no storage at all', () => {
    installLocalStorage(undefined)
    const s = createSafeStorage('local')
    expect(s.persistent).toBe(false)
    expect(s.set('x', 'y')).toBe(false)
    expect(s.get('x')).toBe('y')
  })

  it('survives a throwing accessor', () => {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get() {
        throw new Error('blocked')
      },
    })
    const s = createSafeStorage('local')
    expect(s.set('x', 'y')).toBe(false)
    expect(s.get('x')).toBe('y')
  })
})
