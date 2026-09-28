/**
 * symbols (worked): Rejewski's notation for one key press, E = S·H·N·M·L·U·L⁻¹·M⁻¹·N⁻¹·H⁻¹·S⁻¹, each symbol in its
 * part's colour. Focusing or hovering a symbol highlights its part on the stage (task hover-all). The bet asks what
 * applying E twice does; the Play reveal presses a key on the held machine (no stepping), then the key of the lamp it
 * lit, and the worked example explains why E undoes itself.
 */

import { useEffect, useRef, useState, type JSX } from 'react'
import type { SceneProps } from '../../../contracts/lesson'
import type { Letter } from '../../../engine'
import { Mono, useRevealFired } from '../../../lesson'
import { Sym } from '../../../lib/Sym'
import { usePlaybackStore } from '../../../state/playbackStore'
import { useStageStore } from '../../../state/stageStore'
import { COMPONENTS, COMPONENT_NAME, COMPONENT_PART, FACTORS, SYMBOLS_KEY, type ComponentSym } from '../gates'

/** E as a row of focusable symbols; focusing one highlights its part on the stage. */
export function Formula({ onVisit }: { onVisit?(sym: ComponentSym): void }): JSX.Element {
  const setHighlight = useStageStore((s) => s.setHighlight)
  const show = (sym: ComponentSym) => {
    setHighlight([{ part: COMPONENT_PART[sym], tone: 'hint' }])
    onVisit?.(sym)
  }
  return (
    <p className="flex flex-wrap items-center gap-1 font-mono text-lg" data-testid="formula" aria-label="E equals S H N M L U, then L M N H S inverted">
      <span className="text-stone-100">E =</span>
      {FACTORS.map((f, k) => (
        <span key={k} className="flex items-center gap-1">
          {k ? <span className="text-stone-500">·</span> : null}
          <button
            type="button"
            data-testid={`sym-${k}`}
            data-sym={f.sym}
            className="rounded px-1 hover:bg-stone-800 focus:bg-stone-800 focus:outline-none focus-visible:ring-1 focus-visible:ring-amber-300"
            title={`${COMPONENT_NAME[f.sym]}${f.inv ? ', on the way back' : ''}`}
            aria-label={`${f.sym}${f.inv ? ' inverse' : ''}: the ${COMPONENT_NAME[f.sym]}${f.inv ? ' on the way back' : ''}`}
            onFocus={() => show(f.sym)}
            onMouseEnter={() => show(f.sym)}
            onBlur={() => setHighlight([])}
            onMouseLeave={() => setHighlight([])}
          >
            <Sym s={f.sym} inv={f.inv} />
          </button>
        </span>
      ))}
    </p>
  )
}

type Play = { phase: 'idle' } | { phase: 'first'; lamp: Letter } | { phase: 'second'; lamp: Letter; back: Letter }

export function SymbolsView(p: SceneProps): JSX.Element {
  const fired = useRevealFired('inverse')
  const [visited, setVisited] = useState<ReadonlySet<ComponentSym>>(() => new Set())
  const [play, setPlay] = useState<Play>({ phase: 'idle' })
  const settled = usePlaybackStore((s) => !s.gated && !s.playing && s.t >= 1 + s.hops)
  const resolved = useRef(false)
  const { completeTask, bet, store } = p

  const visit = (sym: ComponentSym) => setVisited((v) => (v.has(sym) ? v : new Set(v).add(sym)))
  useEffect(() => {
    if (visited.size === COMPONENTS.length) completeTask('hover-all')
  }, [visited, completeTask])

  // The Play reveal: press the key, let the lamp light, then press the lamp's key (the rotors are held).
  useEffect(() => {
    if (!fired) return
    if (play.phase === 'idle') {
      const r = store.getState().pressKey(SYMBOLS_KEY)
      setPlay({ phase: 'first', lamp: r.output })
    } else if (play.phase === 'first' && settled) {
      const r = store.getState().pressKey(play.lamp)
      setPlay({ phase: 'second', lamp: play.lamp, back: r.output })
    }
  }, [fired, play, settled, store])

  useEffect(() => {
    if (play.phase !== 'second' || resolved.current) return
    resolved.current = true
    bet('inverse').resolve(play.back === SYMBOLS_KEY ? 'returns' : 'new')
  }, [play, bet])

  return (
    <div className="flex flex-col gap-3 text-sm text-stone-300" data-testid="symbols-view">
      <p>
        Rejewski wrote one key press as a product of permutations, read from left to right: the current meets each part in turn,
        then the same parts backwards. Each symbol has its part&apos;s colour; focus or point at one to find its part on the stage.
      </p>
      <Formula onVisit={visit} />
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs" aria-label="The symbols">
        {COMPONENTS.map((s) => (
          <li key={s} data-visited={String(visited.has(s))}>
            <Sym s={s} /> {COMPONENT_NAME[s]}
          </li>
        ))}
      </ul>
      <p>
        The machine is held: a key press does not turn the rotors here, so E stays the same permutation from press to press.
      </p>
      {play.phase !== 'idle' ? (
        <section data-testid="symbols-play" className="flex flex-col gap-2 rounded-lg border border-stone-700 bg-stone-900/60 p-3">
          <p>
            Key <Mono>{SYMBOLS_KEY}</Mono> lit <Mono>{play.lamp}</Mono>: E(<Mono>{SYMBOLS_KEY}</Mono>) = <Mono>{play.lamp}</Mono>.
          </p>
          {play.phase === 'second' ? (
            <>
              <p data-testid="symbols-back">
                Then key <Mono>{play.lamp}</Mono> lit <Mono>{play.back}</Mono>: E(E(<Mono>{SYMBOLS_KEY}</Mono>)) ={' '}
                <Mono>{play.back}</Mono>. E applied twice gives the letter back.
              </p>
              <h3 className="font-semibold text-stone-100">Worked example: why E undoes itself</h3>
              <ol className="list-decimal pl-5">
                <li>
                  Call the way in X = <Sym s="S" />·<Sym s="H" />·<Sym s="N" />·<Sym s="M" />·<Sym s="L" />. The way back is the same
                  parts in reverse, each inverted: X⁻¹ = <Sym s="L" inv />·<Sym s="M" inv />·<Sym s="N" inv />·<Sym s="H" inv />·
                  <Sym s="S" inv />. So E = X·<Sym s="U" />·X⁻¹.
                </li>
                <li>
                  Then E·E = X·<Sym s="U" />·X⁻¹·X·<Sym s="U" />·X⁻¹ = X·<Sym s="U" />·<Sym s="U" />·X⁻¹, and <Sym s="U" />·
                  <Sym s="U" /> is the identity: the reflector&apos;s wires join letters in pairs.
                </li>
                <li>What is left is X·X⁻¹, the identity: at any one setting, E is its own inverse, whatever the cables.</li>
              </ol>
            </>
          ) : null}
        </section>
      ) : null}
    </div>
  )
}
