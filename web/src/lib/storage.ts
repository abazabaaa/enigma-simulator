/**
 * localStorage / sessionStorage that never throws: every access is wrapped in try/catch, and when
 * the browser refuses storage (private mode, quota, disabled cookies) values live in memory for
 * the rest of the session. `persistent` tells the UI whether a banner is needed.
 */

export interface SafeStorage {
  get(key: string): string | null
  /** Returns false when the value could only be kept in memory. */
  set(key: string, value: string): boolean
  remove(key: string): void
  /** False once the real storage has failed (or does not exist). */
  readonly persistent: boolean
}

function backing(kind: 'local' | 'session'): Storage | null {
  try {
    const s = kind === 'local' ? globalThis.localStorage : globalThis.sessionStorage
    return s ?? null
  } catch {
    return null
  }
}

export function createSafeStorage(kind: 'local' | 'session'): SafeStorage {
  const memory = new Map<string, string>()
  let ok = backing(kind) !== null
  return {
    get(key) {
      if (ok) {
        try {
          return backing(kind)!.getItem(key)
        } catch {
          ok = false
        }
      }
      return memory.get(key) ?? null
    },
    set(key, value) {
      memory.set(key, value)
      if (!ok) return false
      try {
        backing(kind)!.setItem(key, value)
        return true
      } catch {
        ok = false
        return false
      }
    },
    remove(key) {
      memory.delete(key)
      if (!ok) return
      try {
        backing(kind)!.removeItem(key)
      } catch {
        ok = false
      }
    },
    get persistent() {
      return ok
    },
  }
}

/** localStorage with a memory fallback. */
export const storage: SafeStorage = createSafeStorage('local')
/** sessionStorage with a memory fallback. */
export const sessionStore: SafeStorage = createSafeStorage('session')
