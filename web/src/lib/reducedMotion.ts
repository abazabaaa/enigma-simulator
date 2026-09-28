/**
 * Reduced motion (PLAN §2.6): the ?motion= flag beats the stored preference, which beats the
 * system setting (prefers-reduced-motion). Under reduced motion, playback is instant, camera moves
 * are cuts and pulses are static outlines. state/uiStore.ts holds the resolved value.
 */

const QUERY = '(prefers-reduced-motion: reduce)'

function media(): MediaQueryList | null {
  try {
    return typeof matchMedia === 'function' ? matchMedia(QUERY) : null
  } catch {
    return null
  }
}

export function systemPrefersReducedMotion(): boolean {
  return media()?.matches ?? false
}

/** Calls `onChange` when the system setting changes; returns an unsubscribe function. */
export function subscribeSystemReducedMotion(onChange: (reduced: boolean) => void): () => void {
  const m = media()
  if (!m) return () => {}
  const listener = (e: MediaQueryListEvent) => onChange(e.matches)
  m.addEventListener('change', listener)
  return () => m.removeEventListener('change', listener)
}

export function resolveReducedMotion(
  pref: 'system' | 'reduce' | 'full',
  flag: 'reduce' | 'full' | null,
  system: boolean,
): boolean {
  const choice = flag ?? pref
  return choice === 'system' ? system : choice === 'reduce'
}
