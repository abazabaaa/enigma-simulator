import { describe, expect, it } from 'vitest'
import { createMachine, encodeLetter } from '../engine'
import { ghostFromOutputs } from '../lesson/kinds/helpers'
import { DEMO_CONFIGS, DEMO_DIVERGE_AT, demoGhost } from './StageLabPage'

describe('demoGhost (#/lab/stage?ghost=demo)', () => {
  const reference = encodeLetter(createMachine(DEMO_CONFIGS.I), 'A').trace
  const ghost = demoGhost()

  it('divergeAt is the first hop that goes wrong: every earlier hop is the reference, that one is not', () => {
    expect(ghost.divergeAt).toBe(DEMO_DIVERGE_AT)
    expect(ghost.hops).toHaveLength(reference.length)
    for (let k = 0; k < ghost.divergeAt; k++) expect(ghost.hops[k], `hop ${k}`).toEqual(reference[k])
    const at = ghost.hops[ghost.divergeAt]!
    expect(at.input).toBe(reference[ghost.divergeAt]!.input)
    expect(at.output).not.toBe(reference[ghost.divergeAt]!.output)
    // The lessons' own definition (ghostFromOutputs) agrees.
    expect(ghostFromOutputs(reference, ghost.hops.map((h) => h.output)).divergeAt).toBe(ghost.divergeAt)
  })

  it('is a connected path: each hop starts where the previous one ended', () => {
    for (let k = 1; k < ghost.hops.length; k++) expect(ghost.hops[k]!.input, `hop ${k}`).toBe(ghost.hops[k - 1]!.output)
  })
})
