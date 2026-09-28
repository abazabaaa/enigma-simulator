/**
 * window.__machine3dSignal: an e2e-only view of the signal layer (installed with ?e2e=1 by
 * signal/index.tsx). Types only, so Playwright specs can import them in Node. State, never pixels:
 * what the tube, the ghost, the reflector arcs, the cables, the toy wiring and the effects show.
 */

export type V3 = [number, number, number]

export interface SignalDebugApi {
  /** The live signal: the tube drawn up to the playback time and its head. */
  live(): {
    /** Hops of the press on show. */
    hops: number
    /** Hops drawn (a partly drawn live hop counts). */
    drawn: number
    /** What the report says: 2 + 2·drawn. */
    pathPoints: number
    /** Drawn fraction of the path's length, 0…1. */
    fraction: number
    /** The fraction of the length at each path point (2 + 2·hops of them). */
    anchorsU: number[]
    /** The path points (pathPoints(hops, layout)). */
    anchors: V3[]
    /** Tube segments drawn, of all. */
    segments: number
    totalSegments: number
    /** The head while an animated path is drawn, else null. */
    head: V3 | null
    /** The tube and head colours (the signal swatch), and whether they glow (emissive > 1, not tone mapped). */
    color: string
    glow: boolean
  }
  /** The ghost against the reference (null when the stage store has no ghost). */
  ghost(): {
    divergeAt: number
    ghostAnchors: V3[]
    referenceAnchors: V3[]
    ghostColor: string
    referenceColor: string
    dashed: boolean
    /** The divergence marker, at the entry of hop divergeAt; null without a divergence. */
    marker: V3 | null
  } | null
  /** The reflector's wire pairs as letter pairs ('AY'), the lit pair and whether it is the M4's thin one. */
  reflector(): { arcs: number; pairs: string[]; lit: string | null; width: number; thin: boolean }
  /** Plug cables as letter pairs, and those the path lights. */
  cables(): { pairs: string[]; lit: string[] } | null
  /** The toy's own wiring (6 or 8 letters; terminals while the plugboard is hidden), or null on the machine. */
  toy(): { n: number; wires: number; contacts: number; terminals: number } | null
  /** The post-processing in the lazy effects chunk (dropped: given up as too slow for the session). */
  effects(): { bloom: boolean; luminanceThreshold: number | null; mipmapBlur: boolean | null; dropped: boolean }
}

declare global {
  interface Window {
    __machine3dSignal?: SignalDebugApi
  }
}
