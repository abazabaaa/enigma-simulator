/**
 * What the Prologue's first scene and the home page share: the lid slider (the case opens under the learner's
 * hand, in 3D and in the 2D view) and the paper tape's round trip (type a word, rewind, type the ciphertext: the
 * word comes back).
 */

import { useEffect, useId, useState, type JSX } from 'react'
import { useStore } from 'zustand'
import { useShallow } from 'zustand/react/shallow'
import type { MachineStoreHook } from '../../../contracts/machine'
import type { StageDirective } from '../../../contracts/stage'
import { groups5 } from '../../../machine-ui/hooks'
import { isTextEntry, letterOf } from '../../../machine-ui/Keyboard'
import { usePlaybackStore } from '../../../state/playbackStore'
import { useStageStore } from '../../../state/stageStore'
import { roundtripDone, type Tape } from '../gates'

/**
 * While the stage draws no trace ('type-a-word': trace 'off'), a press has nothing to animate: finish its playback
 * at once, so the lamp lights as the key goes down instead of after the whole path's timing.
 */
export function useFinishWhenTraceOff(): void {
  useEffect(
    () =>
      usePlaybackStore.subscribe((s, prev) => {
        if (!s.playing || (prev.playing && prev.seq === s.seq && prev.source === s.source)) return
        if (useStageStore.getState().directive?.trace === 'off') usePlaybackStore.getState().finish()
      }),
    [],
  )
}

/** Bring a bet panel into view and put focus on its first option. */
export function showBet(bet: string, reducedMotion: boolean): void {
  const panel = document.querySelector<HTMLElement>(`[data-testid="bet-${bet}"]`)
  if (!panel) return
  panel.scrollIntoView({ block: 'center', behavior: reducedMotion ? 'auto' : 'smooth' })
  panel.querySelector<HTMLElement>(`[data-testid^="bet-option-${bet}-"], [data-testid="bet-input-${bet}"]`)?.focus({
    preventScroll: true,
  })
}

/** Where a bet panel sits against the window: in view, above it or below it (unknown until observed). */
type PanelPlace = 'in' | 'above' | 'below'

/**
 * Watch the bet panel against the window. The bottom 64 px do not count as in view: the pointer sits there.
 * Without IntersectionObserver (jsdom), the panel counts as below.
 */
function usePanelPlace(bet: string, active: boolean): PanelPlace {
  const [place, setPlace] = useState<PanelPlace>('below')
  useEffect(() => {
    if (!active || typeof IntersectionObserver === 'undefined') return
    let observer: IntersectionObserver | null = null
    let raf = 0
    const attach = () => {
      const panel = document.querySelector(`[data-testid="bet-${bet}"]`)
      if (!panel) {
        raf = requestAnimationFrame(attach)
        return
      }
      observer = new IntersectionObserver(
        ([e]) => {
          if (e) setPlace(e.isIntersecting ? 'in' : e.boundingClientRect.top < 0 ? 'above' : 'below')
        },
        { rootMargin: '0px 0px -64px 0px' },
      )
      observer.observe(panel)
    }
    attach()
    return () => {
      cancelAnimationFrame(raf)
      observer?.disconnect()
    }
  }, [bet, active])
  return place
}

/**
 * Until a bet is committed the keys are locked (G10) and the bet may sit out of view. While it does, a pointer
 * stays at the foot of the window; a letter typed on the locked keyboard (or a click on it) brings the bet into
 * view and focuses its first option.
 */
export function BetPointer(p: {
  bet: string
  pending: boolean
  text: string
  reducedMotion: boolean
}): JSX.Element | null {
  const { bet, pending, reducedMotion } = p
  const place = usePanelPlace(bet, pending)
  useEffect(() => {
    if (!pending) return
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || isTextEntry(e.target) || !letterOf(e)) return
      showBet(bet, reducedMotion)
    }
    const onPointer = (e: PointerEvent) => {
      const keys = document.querySelector('[data-testid="keyboard"]')?.getBoundingClientRect()
      if (
        keys &&
        e.clientX >= keys.left &&
        e.clientX <= keys.right &&
        e.clientY >= keys.top &&
        e.clientY <= keys.bottom
      ) {
        showBet(bet, reducedMotion)
      }
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('pointerdown', onPointer)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('pointerdown', onPointer)
    }
  }, [bet, pending, reducedMotion])
  if (!pending || place === 'in') return null
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-3 z-20 flex justify-center px-4">
      <button
        type="button"
        data-testid="bet-pointer"
        onClick={() => showBet(bet, reducedMotion)}
        className="pointer-events-auto rounded-full border border-violet-400/70 bg-violet-950/95 px-4 py-2 text-sm text-violet-100 shadow-lg hover:bg-violet-900"
      >
        <span aria-hidden="true">{place === 'above' ? '↑' : '↓'}</span> {p.text}
      </button>
    </div>
  )
}

export type Lid = StageDirective['lid']
export const LIDS: readonly Lid[] = ['closed', 'open', 'cutaway']
const LID_TEXT: Readonly<Record<Lid, string>> = {
  closed: 'Lid closed',
  open: 'Lid open: the rotors show',
  cutaway: 'Cut away: the wiring shows',
}

/** A range over closed → open → cut away (data-testid lid-slider). */
export function LidSlider({ value, onChange }: { value: Lid; onChange(lid: Lid): void }): JSX.Element {
  const id = useId()
  const k = LIDS.indexOf(value)
  return (
    <div className="flex flex-wrap items-center gap-3 text-sm text-stone-300">
      <label htmlFor={id}>Open the case</label>
      <input
        id={id}
        type="range"
        min={0}
        max={LIDS.length - 1}
        step={1}
        value={k}
        data-testid="lid-slider"
        data-lid={value}
        aria-valuetext={LID_TEXT[value]}
        onChange={(e) => onChange(LIDS[Number(e.target.value)] ?? 'closed')}
        className="w-40 accent-amber-300"
      />
      <span aria-hidden="true" className="text-stone-400">
        {LID_TEXT[value]}
      </span>
    </div>
  )
}

export interface Roundtrip {
  /** The word came back: an earlier tape's output was typed and lit that tape's input. */
  readonly done: boolean
  /** The word that came back first (kept while the learner types on). */
  readonly word: string | null
  /** Tapes cleared since the view mounted, oldest first. */
  readonly earlier: readonly Tape[]
  readonly current: Tape
}

/** Watch `store`'s paper tape: every cleared tape is remembered, and the current one is compared with them. */
export function useRoundtrip(store: MachineStoreHook): Roundtrip {
  const current = useStore(
    store,
    useShallow((s) => ({ input: s.input, output: s.output })),
  )
  const [earlier, setEarlier] = useState<readonly Tape[]>([])
  const [word, setWord] = useState<string | null>(null)
  useEffect(
    () =>
      store.subscribe((s, prev) => {
        if (s.input === '' && prev.input !== '')
          setEarlier((e) => [...e, { input: prev.input, output: prev.output }].slice(-8))
      }),
    [store],
  )
  const now = roundtripDone(earlier, current)
  const back = now ? (earlier.find((t) => t.output === current.input)?.input ?? current.output) : null
  useEffect(() => {
    if (back !== null) setWord((w) => w ?? back)
  }, [back])
  return { done: word !== null || back !== null, word: word ?? back, earlier, current }
}

/** What the round trip asks for next, and (once done) the word that came back. */
export function RoundtripNote({ trip, testId = 'roundtrip' }: { trip: Roundtrip; testId?: string }): JSX.Element {
  const last = trip.earlier.at(-1)
  let text: string
  if (trip.done) {
    text = `You typed the ciphertext and got ${groups5(trip.word ?? '')} back: from the same start, the machine undoes itself.`
  } else if (last && last.input.length > 0 && trip.current.input === '') {
    text = `Now type the ciphertext ${groups5(last.output)}, and watch the output.`
  } else if (trip.current.input.length > 0) {
    text = 'When your word is on the tape, press “Clear and rewind” to start the machine from the same windows again.'
  } else {
    text = 'Type a word: the tape keeps what you typed (in) and what lit (out).'
  }
  return (
    <p
      data-testid={testId}
      data-done={String(trip.done)}
      aria-live="polite"
      className={trip.done ? 'text-emerald-300' : 'text-stone-300'}
    >
      {text}
    </p>
  )
}
