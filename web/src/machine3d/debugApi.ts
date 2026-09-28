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
  /** The labels as laid out on screen, and the keep-out boxes they avoid (pawl–notch contacts). */
  labels(): { labels: (ClientRect & { key: string; text: string })[]; keepOut: ClientRect[] }
}

declare global {
  interface Window {
    __machine3d?: Machine3DDebugApi
  }
}
