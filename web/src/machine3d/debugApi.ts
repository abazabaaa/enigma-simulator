/**
 * window.__machine3d: an e2e-only view into the live 3D scene (installed with ?e2e=1, by debug.ts).
 * Types only, so Playwright specs can import them in Node. State, never pixels: angles, flags,
 * frame counts and projected key positions.
 */

import type { CameraShot } from '../contracts/stage'

export interface Machine3DDebugApi {
  /** The camera: current shot, position, look-at target, and how many frames it took to arrive. */
  camera(): {
    shot: CameraShot | null
    position: [number, number, number]
    target: [number, number, number]
    /** Frames from the shot request until the camera reached it; null while still moving. */
    settleFrames: number | null
  }
  /** Per rotor (LEFT → RIGHT): window shown, ring and core rotation.x, pawl state (null: no pawl). */
  rotors(): { slot: string; window: number; ringAngle: number; coreAngle: number; engaged: boolean | null }[]
  /** Parts present in the scene and those whose materials are all dimmed (scenery excluded). */
  parts(): { present: string[]; dimmed: string[]; highlighted: string[] }
  /** Frames rendered since the view mounted. */
  frames(): number
  /** Milliseconds since the last change that needed a frame. */
  idleMs(): number
  /** Client (CSS pixel) coordinates of a key cap's centre, or null if the key is not in the scene. */
  keyPoint(letter: string): { x: number; y: number } | null
}

declare global {
  interface Window {
    __machine3d?: Machine3DDebugApi
  }
}
