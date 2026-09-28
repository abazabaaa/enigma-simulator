import { useEffect, useMemo } from 'react'
import type { BufferGeometry } from 'three'

/** A geometry built once per `deps` and disposed when replaced or unmounted. */
export function useGeometry<G extends BufferGeometry>(create: () => G, deps: readonly unknown[]): G {
  const g = useMemo(create, deps)
  useEffect(() => () => g.dispose(), [g])
  return g
}
