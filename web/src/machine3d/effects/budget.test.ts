import { describe, expect, it } from 'vitest'
import { FrameBudget, RUN, SLOW_MS, isSoftwareRenderer } from './budget'

/** Feeds frames `gap` ms apart; `pending` for all but the last. Returns the verdict after each. */
function run(b: FrameBudget, start: number, gap: number, frames: number, pendingLast = true): boolean[] {
  return Array.from({ length: frames }, (_, i) => b.frame(start + i * gap, i < frames - 1 || pendingLast))
}

describe('FrameBudget', () => {
  it(`gives Bloom up after ${RUN} slow animation frames in a row`, () => {
    const b = new FrameBudget()
    const verdicts = run(b, 0, SLOW_MS + 30, RUN + 1)
    expect(verdicts.indexOf(true)).toBe(RUN)
  })

  it('keeps it while animation frames are quick enough', () => {
    const b = new FrameBudget()
    expect(run(b, 0, 16.7, 600).some(Boolean)).toBe(false)
    expect(run(b, 20_000, SLOW_MS - 1, 100).some(Boolean)).toBe(false)
  })

  it('does not count the gaps of a demand frame loop: frames nobody asked for in advance', () => {
    const b = new FrameBudget()
    // 50 frames, each after an idle second, none asked for while the previous one was drawn
    for (let i = 0; i < 50; i++) expect(b.frame(i * 1000, false)).toBe(false)
  })

  it('needs the slow frames in one run: a quick frame or an idle gap starts over', () => {
    const b = new FrameBudget()
    expect(run(b, 0, 200, RUN - 1, false).some(Boolean)).toBe(false) // a short slow run, then idle
    expect(run(b, 10_000, 200, RUN - 1).some(Boolean)).toBe(false)
    expect(b.frame(10_000 + (RUN - 2) * 200 + 10, true)).toBe(false) // a quick frame
    expect(run(b, 20_000, 200, RUN - 1).some(Boolean)).toBe(false)
  })
})

describe('isSoftwareRenderer', () => {
  it('knows SwiftShader and Mesa’s software rasterizers', () => {
    expect(
      isSoftwareRenderer(
        'ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)',
      ),
    ).toBe(true)
    expect(isSoftwareRenderer('llvmpipe (LLVM 15.0.7, 256 bits)')).toBe(true)
    expect(isSoftwareRenderer('ANGLE (NVIDIA, NVIDIA GeForce RTX 3070 Direct3D11 vs_5_0 ps_5_0, D3D11)')).toBe(false)
    expect(isSoftwareRenderer('Apple M2')).toBe(false)
  })
})
