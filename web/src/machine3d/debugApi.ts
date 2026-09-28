/**
 * window.__machine3d: an e2e-only view into the live 3D scene (installed with ?e2e=1, by debug.ts).
 * Types only, so Playwright specs can import them in Node. State, never pixels: angles, flags,
 * frame counts, projected positions and label boxes (client CSS pixels).
 */

import type { CameraShot } from '../contracts/stage'

export interface ClientRect {
  x: number
  y: number
  w: number
  h: number
}

/**
 * Share of a label's box height taken by its font size: labels.tsx draws names in 50 px type on an
 * 88 px texture and symbols in 84 px type on 128 px.
 */
export const LABEL_FONT_RATIO = { name: 50 / 88, symbol: 84 / 128 } as const
/** Labels never draw their type smaller than this on screen (CSS px), however far the camera. */
export const MIN_LABEL_FONT_PX = 9.5
/** Share of a glyph cell taken by the type: letters are set at 100 px, ring numbers at 78 px, in 128 px cells. */
export const GLYPH_FONT_RATIO = { letter: 100 / 128, number: 78 / 128 } as const

/** What screenPoints() can project. */
export type PointKind = 'key' | 'lamp' | 'socket' | 'window' | 'pawl' | 'core-index' | 'reflector'

export interface Machine3DDebugApi {
  /** The camera: current shot, position, look-at target, and how many frames it took to arrive. */
  camera(): {
    shot: CameraShot | null
    position: [number, number, number]
    target: [number, number, number]
    /** Frames from the shot request until the camera reached it; null while still moving. */
    settleFrames: number | null
  }
  /** The canvas's client rectangle. */
  canvas(): ClientRect
  /** Per rotor (LEFT → RIGHT): window shown, ring and core rotation.x, pawl state (null: no pawl). */
  rotors(): { slot: string; window: number; ringAngle: number; coreAngle: number; engaged: boolean | null }[]
  /**
   * Per rotor: the digit glyphs drawn on the ring band, whether a number sits beside the window
   * letter, the ring setting picked out in the exploded view (e.g. '05', else null) and whether the
   * leader from the core index to it is drawn.
   */
  rings(): { slot: string; digits: string[]; windowNumber: boolean; ringSetting: string | null; leader: boolean }[]
  /** Parts present in the scene and those whose materials are all dimmed (scenery excluded). */
  parts(): { present: string[]; dimmed: string[]; highlighted: string[] }
  /** Frames rendered since the view mounted. */
  frames(): number
  /** Milliseconds since the last change that needed a frame. */
  idleMs(): number
  /** Client (CSS pixel) coordinates of a key cap's centre, or null if the key is not in the scene. */
  keyPoint(letter: string): { x: number; y: number } | null
  /**
   * Client coordinates of every point of a kind in the scene, by letter (keys, lamps, sockets) or by
   * slot (window letters, pawl tips = pawl–notch contacts, core indexes) or 'U' (reflector).
   */
  screenPoints(kind: PointKind): Record<string, { x: number; y: number }>
  /**
   * The labels as laid out on screen (with their leader line, from the label's edge to the part, if
   * any), the keep-out boxes they must avoid (pawl–notch contacts, the ring-setting number) and the
   * soft ones they avoid when they can (the rings, while the pawls are labelled).
   */
  labels(): {
    labels: (ClientRect & {
      key: string
      text: string
      symbol: boolean
      leader: { x1: number; y1: number; x2: number; y2: number } | null
    })[]
    keepOut: ClientRect[]
    soft: ClientRect[]
  }
  /**
   * The on-screen size (CSS px) of a ring's glyph cells: the window letter (its width shrinks when it
   * is seen edge-on) and, in the exploded view, the smallest dial number facing the camera.
   */
  glyphs(slot: string): { window: { w: number; h: number } | null; dialMin: number | null }
}

declare global {
  interface Window {
    __machine3d?: Machine3DDebugApi
  }
}
