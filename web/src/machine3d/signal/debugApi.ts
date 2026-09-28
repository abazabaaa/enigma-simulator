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
    /** The see-through copy of the path is drawn (not when a single part is in focus). */
    xray: boolean
    /** The head's on-screen diameter in CSS px (at least HEAD_MIN_PX while shown), 0 when hidden. */
    headPx: number
    /**
     * The tag at the head: the part's symbol (⁻¹ on the way back) and letters ('N  E → W'), and the
     * change count ('change 4 of 7' / 'no change'); null when the head is hidden.
     */
    tag: {
      title: string
      detail: string
      sym: string
      inverse: boolean
      input: string
      output: string
      change: number | null
      changes: number
      color: string
      px: number
    } | null
  }
  /** Cables drawn faintly while the plugboard is hidden (the ones the path runs along), or null. */
  faintCables(): { pairs: string[]; shown: string[] } | null
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
  /**
   * The post-processing in the lazy effects chunk: Bloom mounted or not, its settings, whether the
   * frame budget gave it up (dropped) and whether the renderer is a software rasterizer (no Bloom).
   */
  effects(): {
    bloom: boolean
    luminanceThreshold: number | null
    mipmapBlur: boolean | null
    dropped: boolean
    software: boolean
  }
  /** Mounts Bloom whatever the renderer and the budget say (true), keeps it off (false), or neither (null). */
  forceBloom(on: boolean | null): void
}

declare global {
  interface Window {
    __machine3dSignal?: SignalDebugApi
  }
}
