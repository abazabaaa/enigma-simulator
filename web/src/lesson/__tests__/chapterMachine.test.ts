import { describe, expect, it, vi } from 'vitest'
import { chapterContext, startChapter } from '../chapterMachine'

function make(o: { count?: number; start?: number; reached?: number; can?: (i: number) => boolean } = {}) {
  const onComplete = vi.fn()
  const canAdvance = vi.fn(o.can ?? (() => true))
  const actor = startChapter({ count: o.count ?? 4, start: o.start ?? 0, reached: o.reached ?? 0, canAdvance, onComplete })
  return { actor, onComplete, canAdvance, ctx: () => chapterContext(actor) }
}

describe('chapterMachine', () => {
  it('starts at the requested scene and never below reached', () => {
    expect(make({ start: 2, reached: 1 }).ctx()).toMatchObject({ index: 2, reached: 2, count: 4 })
    expect(make({ start: 9, reached: 9 }).ctx()).toMatchObject({ index: 3, reached: 3 })
  })

  it('NEXT is guarded by canAdvance', () => {
    const blocked = make({ can: () => false })
    blocked.actor.send({ type: 'NEXT' })
    expect(blocked.ctx()).toMatchObject({ index: 0, reached: 0 })
    expect(blocked.canAdvance).toHaveBeenCalledWith(0)

    const open = make()
    open.actor.send({ type: 'NEXT' })
    open.actor.send({ type: 'NEXT' })
    expect(open.ctx()).toMatchObject({ index: 2, reached: 2 })
  })

  it('NEXT on the last scene completes the chapter without moving', () => {
    const m = make({ start: 3, reached: 3 })
    m.actor.send({ type: 'NEXT' })
    expect(m.onComplete).toHaveBeenCalledTimes(1)
    expect(m.ctx().index).toBe(3)
    const blocked = make({ start: 3, reached: 3, can: () => false })
    blocked.actor.send({ type: 'NEXT' })
    expect(blocked.onComplete).not.toHaveBeenCalled()
  })

  it('BACK is always allowed and keeps reached', () => {
    const m = make({ start: 2, reached: 2, can: () => false })
    m.actor.send({ type: 'BACK' })
    m.actor.send({ type: 'BACK' })
    m.actor.send({ type: 'BACK' })
    expect(m.ctx()).toMatchObject({ index: 0, reached: 2 })
  })

  it('GOTO(i) is allowed only for i ≤ reached', () => {
    const m = make({ start: 0, reached: 2 })
    m.actor.send({ type: 'GOTO', index: 3 })
    expect(m.ctx().index).toBe(0)
    m.actor.send({ type: 'GOTO', index: 2 })
    expect(m.ctx().index).toBe(2)
    m.actor.send({ type: 'GOTO', index: 1 })
    expect(m.ctx()).toMatchObject({ index: 1, reached: 2 })
    m.actor.send({ type: 'GOTO', index: -1 })
    expect(m.ctx().index).toBe(1)
  })

  it('reached grows as NEXT enters new scenes', () => {
    const m = make({ start: 1, reached: 1 })
    m.actor.send({ type: 'NEXT' })
    m.actor.send({ type: 'BACK' })
    expect(m.ctx()).toMatchObject({ index: 1, reached: 2 })
    m.actor.send({ type: 'GOTO', index: 2 })
    m.actor.send({ type: 'NEXT' })
    expect(m.ctx()).toMatchObject({ index: 3, reached: 3 })
  })
})
