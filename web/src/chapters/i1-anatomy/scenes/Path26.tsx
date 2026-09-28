/**
 * path-26: the full machine with its lamps, the trace and the playback bar (rotors held). A bet on the lamp of Q
 * gates the key; until Q has been pressed it is the only key offered (the stage's keys are off), then the whole
 * keyboard appears and the learner slows the playback down and scrubs through a press.
 */

import { useEffect, useRef, type JSX } from 'react'
import { useStore } from 'zustand'
import type { SceneProps } from '../../../contracts/lesson'
import { Mono, useRevealFired } from '../../../lesson'
import { Keyboard } from '../../../machine-ui'
import { isTextEntry, letterOf } from '../../../machine-ui/Keyboard'
import { usePlaybackStore } from '../../../state/playbackStore'
import { PATH_KEY, PATH_LAMP, PATH_TRACE, changesOf } from '../gates'
import { useStageKeysOff } from './stage'

export function Path26View(p: SceneProps): JSX.Element {
  const fired = useRevealFired('q-lamp')
  const resolved = useRef(false)
  const { completeTask, bet, store } = p
  const locked = useStore(store, (s) => !!s.locks.keyboard)
  useStageKeysOff('wire-noplug', !fired)

  // Before the reveal only Q is offered, on screen and on the physical keyboard (the whole keyboard comes after).
  useEffect(() => {
    if (fired) return
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || e.repeat || isTextEntry(e.target)) return
      if (letterOf(e) !== PATH_KEY || store.getState().locks.keyboard) return
      e.preventDefault()
      store.getState().pressKey(PATH_KEY)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [fired, store])

  useEffect(() => {
    if (!fired || resolved.current) return
    resolved.current = true
    bet('q-lamp').resolve(PATH_LAMP)
  }, [fired, bet])

  // speed: the playback speed changed; scrub: a machine press stopped by the learner part-way.
  useEffect(() => {
    const speed = usePlaybackStore.getState().speed
    return usePlaybackStore.subscribe((s, prev) => {
      if (s.speed !== speed && s.speed !== prev.speed) completeTask('speed')
      const m = store.getState()
      const scrubbed =
        s.t !== prev.t && !s.playing && !s.gated && s.source === 'machine' && s.hops > 0 && s.t < 1 + s.hops
      if (scrubbed && m.last && s.seq === m.seq) completeTask('scrub')
    })
  }, [store, completeTask])

  return (
    <div className="flex flex-col gap-3 text-sm text-stone-300" data-testid="path-26-view">
      <p>
        The same machine, now with its lamps and the trace. The rotors are still held, so a key lights the same lamp
        every time.
      </p>
      <div aria-live="polite">
        {fired ? (
          <>
            <Keyboard store={store} />
            <p data-testid="path-26-result" className="rounded-md border border-stone-700 bg-stone-900/60 p-2">
              <Mono>{PATH_KEY}</Mono> lights <Mono>{PATH_LAMP}</Mono>; on the way the letter changed{' '}
              {changesOf(PATH_TRACE)} times, as the trace shows hop by hop. Now slow the playback down with the speed
              menu, press keys of your own, and drag the bar to stop the current anywhere on its path.
            </p>
          </>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              data-testid={`key-${PATH_KEY}`}
              disabled={locked}
              onClick={() => {
                if (!store.getState().locks.keyboard) store.getState().pressKey(PATH_KEY)
              }}
              className="h-9 w-9 rounded-md border border-stone-600 bg-stone-800 font-mono text-sm text-stone-100 shadow-sm hover:bg-stone-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {PATH_KEY}
            </button>
            <span>
              {locked ? 'Bet first, then press ' : 'Press '}
              <Mono>{PATH_KEY}</Mono> (here or on your keyboard): the other keys come after it.
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
