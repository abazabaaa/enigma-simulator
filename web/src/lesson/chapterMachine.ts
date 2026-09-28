/**
 * A chapter's scene flow (PLAN §2.2 item 7): an XState v5 machine with one flat state per scene (s0, s1, …),
 * no history states and no persisted snapshots (xstate#5178). It is rebuilt from ProgressV1 on every mount:
 * `start` is the scene to open and `reached` the furthest scene entered so far.
 *  - NEXT is guarded by canAdvance(index); on the last scene it runs `complete` instead of moving.
 *  - BACK moves one scene back (always allowed).
 *  - GOTO(i) is allowed for i ≤ reached.
 */

import { assign, createActor, setup, type Actor, type AnyStateMachine } from 'xstate'

export interface ChapterContext {
  readonly index: number
  readonly reached: number
  readonly count: number
}

export type ChapterEvent = { type: 'NEXT' } | { type: 'BACK' } | { type: 'GOTO'; index: number }

export interface ChapterMachineOptions {
  readonly count: number
  readonly start: number
  readonly reached: number
  canAdvance(index: number): boolean
  onComplete(): void
}

export function createChapterMachine(o: ChapterMachineOptions): AnyStateMachine {
  if (o.count < 1) throw new Error('A chapter needs at least one scene')
  const clamp = (i: number) => Math.max(0, Math.min(o.count - 1, i))
  const start = clamp(o.start)
  const reached = clamp(Math.max(o.reached, start))
  const base = setup({
    types: { context: {} as ChapterContext, events: {} as ChapterEvent },
    guards: { canAdvance: ({ context }) => o.canAdvance(context.index) },
    actions: { complete: () => o.onComplete() },
  })
  const states: Record<string, object> = {}
  for (let i = 0; i < o.count; i++) {
    states[`s${i}`] = {
      entry: assign({ index: i, reached: ({ context }: { context: ChapterContext }) => Math.max(context.reached, i) }),
      on: {
        NEXT:
          i < o.count - 1 ? { target: `s${i + 1}`, guard: 'canAdvance' } : { guard: 'canAdvance', actions: 'complete' },
        ...(i > 0 ? { BACK: { target: `s${i - 1}` } } : {}),
      },
    }
  }
  return base.createMachine({
    id: 'chapter',
    context: { index: start, reached, count: o.count },
    initial: `s${start}`,
    on: {
      GOTO: Array.from({ length: o.count }, (_, i) => ({
        guard: ({ context, event }: { context: ChapterContext; event: ChapterEvent }) =>
          event.type === 'GOTO' && event.index === i && i <= context.reached,
        target: `.s${i}`,
      })),
    },
    states,
  } as never) as unknown as AnyStateMachine
}

export type ChapterActor = Actor<AnyStateMachine>

export function startChapter(o: ChapterMachineOptions): ChapterActor {
  const actor = createActor(createChapterMachine(o))
  actor.start()
  return actor
}

export function chapterContext(actor: ChapterActor): ChapterContext {
  return actor.getSnapshot().context as ChapterContext
}
