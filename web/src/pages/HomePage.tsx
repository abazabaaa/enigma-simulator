/**
 * #/ · the guided entry (PLAN §1 item 1, §2.3, brief 09): the whole machine on the stage ('type-a-word': 3D when
 * available, else 2D) with one thing to do, type a word. The keyboard, the lamps and the paper tape sit under it,
 * with a visible hint; typing the ciphertext back from the same start returns the word. The lid slider opens the
 * case, and in 3D a drag turns the machine. Below: Begin (the Prologue), resume where you left off, the machine
 * sandbox, and the course map.
 */

import { useLayoutEffect, useState, type JSX } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { START } from '../chapters/prologue/gates'
import {
  LidSlider,
  RoundtripNote,
  useFinishWhenTraceOff,
  useRoundtrip,
  type Lid,
} from '../chapters/prologue/scenes/shared'
import { CHAPTERS } from '../content/registry'
import type { ChapterMeta } from '../contracts/lesson'
import type { ProgressV1 } from '../contracts/progress'
import type { StageRef } from '../contracts/stage'
import { CourseMap, isLocked, useProgress } from '../lesson'
import { BUTTON, QUIET_BUTTON } from '../lesson/ui/controls'
import { MachinePanel } from '../machine-ui'
import { StageHost } from '../stage/StageHost'
import { useMachineStore } from '../state/machineStore'
import { usePlaybackStore } from '../state/playbackStore'
import { setPendingBet } from '../state/sync'

/**
 * Where the learner left off: the first chapter (by order) that is open and not complete, once anything has been
 * started; null for a new learner (Begin is the way in) or when every chapter is complete.
 */
export function resumeTarget(chapters: ProgressV1['chapters']): ChapterMeta | null {
  const p = { chapters } as ProgressV1
  if (!Object.keys(chapters).some((id) => CHAPTERS.some((c) => c.id === id))) return null
  const ordered = [...CHAPTERS].sort((a, b) => a.order - b.order)
  return ordered.find((c) => !c.optional && !isLocked(CHAPTERS, c.id, p) && chapters[c.id]?.completed !== true) ?? null
}

export function HomePage(): JSX.Element {
  const [lid, setLid] = useState<Lid>('closed')
  const chapters = useProgress(useShallow((s) => s.chapters))
  const resume = resumeTarget(chapters)
  const trip = useRoundtrip(useMachineStore)
  useFinishWhenTraceOff()

  // Before the first paint: no bet, no locks but the settings, a fresh machine at I II III, AAA (the Prologue's).
  useLayoutEffect(() => {
    setPendingBet(false)
    usePlaybackStore.getState().setGated(false)
    const m = useMachineStore.getState()
    m.setLocks({ model: true, rotors: true, reflector: true, rings: true, positions: true, plugboard: true })
    m.setConfig(START)
  }, [])

  const stage: StageRef = lid === 'closed' ? 'type-a-word' : { preset: 'type-a-word', with: { lid } }
  const resumeScene = resume ? chapters[resume.id]?.reached : undefined

  return (
    <main className="mx-auto flex w-full max-w-5xl min-w-0 flex-col gap-6 px-4 py-8" data-testid="home">
      <header className="flex flex-col gap-2">
        <p className="font-mono text-sm tracking-[0.3em] text-amber-400/80 uppercase">Interactive history</p>
        <h1 className="text-3xl font-semibold text-stone-100 sm:text-4xl">Enigma: how it worked, how it was broken</h1>
      </header>

      <section aria-labelledby="home-try" className="flex flex-col gap-3">
        <h2 id="home-try" className="text-xl text-stone-100" data-testid="home-hint">
          Type a word.
        </h2>
        <p className="text-sm text-stone-300">
          Use your keyboard or click the keys: every key lights a lamp. Then clear and rewind the tape and type what
          lit: your word comes back.
        </p>
        <StageHost stage={stage} className="min-w-0 overflow-hidden rounded-xl border border-stone-800 bg-stone-950" />
        <div className="flex flex-col gap-1">
          <LidSlider value={lid} onChange={setLid} />
          <p className="text-xs text-stone-400">In the 3D view, drag the machine to turn it.</p>
        </div>
        <MachinePanel show={{ keyboard: true, lamps: true, tape: true }} />
        <RoundtripNote trip={trip} testId="home-roundtrip" />
      </section>

      <nav aria-label="Start" className="flex flex-wrap items-center gap-3">
        <a data-testid="home-begin" href="#/c/prologue" className={BUTTON}>
          Begin
        </a>
        {resume ? (
          <a data-testid="home-resume" data-chapter={resume.id} href={`#/c/${resume.id}`} className={QUIET_BUTTON}>
            Resume: {resume.title}
            {resumeScene !== undefined ? ` (scene ${resumeScene + 1})` : ''}
          </a>
        ) : null}
        <a data-testid="home-sandbox" href="#/machine" className={QUIET_BUTTON}>
          The machine, to play with
        </a>
      </nav>

      <CourseMap />
    </main>
  )
}
