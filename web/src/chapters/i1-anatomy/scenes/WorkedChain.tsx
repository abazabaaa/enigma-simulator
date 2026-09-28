/**
 * worked-chain (worked, free presses): the full machine, held, with every component's strip at its current offset.
 * "Next hop" follows key K one stage at a time: the stage outlines the part it is crossing, the playback stops the
 * path at that hop (2D now, the 3D signal once it lands: both read the same playback clock), the strip marks the
 * column read, and the chain fills in. Eleven hops later the letter reaches its lamp.
 */

import { useEffect, useState, type JSX } from 'react'
import type { SceneProps } from '../../../contracts/lesson'
import type { PartId } from '../../../contracts/stage'
import { REFLECTOR_PERMS, LETTERS } from '../../../engine'
import { Mono, QUIET_BUTTON, BUTTON } from '../../../lesson'
import { partForStage } from '../../../lesson/kinds/helpers'
import { Sym } from '../../../lib/Sym'
import { symForStage } from '../../../lib/symbols'
import { usePlaybackStore } from '../../../state/playbackStore'
import { useStageStore } from '../../../state/stageStore'
import { CHAIN, CHAIN_KEY, MACHINE, STAGE_LABEL, changesOf } from '../gates'
import { Strips } from '../items'

/** How each hop is read. */
function howRead(stage: string): string {
  if (stage.startsWith('plugboard')) return 'no cable: straight through'
  if (stage.startsWith('etw')) return 'wired in order: straight through'
  if (stage === 'reflector') return 'swapped with its partner'
  return stage.endsWith('-bwd') ? 'strip read upwards' : 'strip read downwards'
}

/** The pairs of a reflector, e.g. AY BR CU … (13 pairs). */
export function reflectorPairs(perm: readonly number[]): string[] {
  return perm.flatMap((b, a) => (b > a ? [`${LETTERS[a]}${LETTERS[b]}`] : []))
}

export function WorkedChainView(p: SceneProps): JSX.Element {
  const [shown, setShown] = useState(0)
  const setHighlight = useStageStore((s) => s.setHighlight)
  const { completeTask, store } = p

  // Keep the machine on K's press and the playback at the hop just reached.
  const show = (count: number) => {
    const m = store.getState()
    if (count > 0 && m.last?.trace[0]?.input !== CHAIN_KEY) {
      try {
        m.pressKey(CHAIN_KEY)
      } catch {
        return
      }
    }
    setShown(count)
    const hops = CHAIN.length
    if (count === 0) {
      setHighlight([])
      return
    }
    usePlaybackStore.getState().scrub(count >= hops ? 1 + hops : 1 + count - 0.001)
    // The plugboard is hidden on this stage and the entry wheel passes letters straight through: nothing to outline.
    const hop = CHAIN[count - 1]!
    setHighlight(
      hop.kind === 'rotor' || hop.kind === 'reflector' ? [{ part: partForStage(hop.stage), tone: 'hint' }] : [],
    )
  }

  useEffect(() => () => setHighlight([]), [setHighlight])
  useEffect(() => {
    if (shown >= CHAIN.length) completeTask('all-hops')
  }, [shown, completeTask])

  const current = shown > 0 ? CHAIN[shown - 1]! : null
  const mark: Partial<Record<PartId, number>> = {}
  if (current && current.kind !== 'plugboard' && current.kind !== 'etw') {
    mark[partForStage(current.stage)] = current.stage.endsWith('-bwd') ? current.outputIndex : current.inputIndex
  }
  const changes = changesOf(CHAIN)
  const lamp = CHAIN.at(-1)!.output

  return (
    <div className="flex flex-col gap-3 text-sm text-stone-300" data-testid="worked-chain-view">
      <p>
        The full machine, 26 letters: rotors <Mono>{MACHINE.rotors.join(' ')}</Mono>, rings <Mono>01 01 01</Mono>,
        windows <Mono>{MACHINE.positions.join('')}</Mono>, no cables, the rotors held still. Follow key{' '}
        <Mono>{CHAIN_KEY}</Mono> through all eleven stages, one hop at a time. You may press other keys on the stage
        too.
      </p>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Strips config={MACHINE} highlight={mark} testId="chain-strip" />
        <div className="flex flex-col gap-2">
          <ol className="flex flex-col gap-1 font-mono" data-testid="chain" data-shown={shown}>
            {CHAIN.map((h, k) => (
              <li
                key={k}
                data-testid={`chain-hop-${k}`}
                data-shown={String(k < shown)}
                className={`flex flex-wrap items-center gap-2 rounded px-1.5 py-0.5 ${k === shown - 1 ? 'bg-amber-300/15 ring-1 ring-amber-300/60' : ''} ${
                  k < shown ? 'text-stone-100' : 'text-stone-400'
                }`}
              >
                <span className="w-6 text-center">
                  <Sym s={symForStage(h.stage)} inv={h.stage.endsWith('-bwd')} />
                </span>
                <span className="min-w-36 font-sans">{STAGE_LABEL[h.stage]}</span>
                <span>{k < shown ? `${h.input} → ${h.output}` : '· → ·'}</span>
                {k < shown ? (
                  <span className="basis-full pl-8 font-sans text-xs text-stone-400">{howRead(h.stage)}</span>
                ) : null}
              </li>
            ))}
          </ol>
          <p role="status" aria-live="polite" data-testid="chain-status" className="min-h-5 font-sans text-stone-200">
            {current
              ? `Hop ${shown} of ${CHAIN.length}, ${STAGE_LABEL[current.stage]}: ${current.input} → ${current.output} (${howRead(current.stage)}).`
              : ''}
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={BUTTON}
              data-testid="chain-next"
              disabled={shown >= CHAIN.length}
              onClick={() => show(shown + 1)}
            >
              Next hop
            </button>
            <button
              type="button"
              className={QUIET_BUTTON}
              data-testid="chain-reset"
              disabled={shown === 0}
              onClick={() => show(0)}
            >
              Start again
            </button>
          </div>
          {shown >= CHAIN.length ? (
            <p data-testid="chain-summary" className="rounded-md border border-stone-700 bg-stone-900/60 p-2 font-sans">
              <Mono>{CHAIN_KEY}</Mono> lights <Mono>{lamp}</Mono>. On the way the letter changed {changes} times: at the
              three rotors on the way in, at the reflector, and at the three rotors on the way back. The plugboard and
              the entry wheel are crossed twice too, and change nothing here: the plugboard has no cables, and the entry
              wheel is wired in order (A to A, B to B…). The reflector joins the 26 contacts in 13 pairs:{' '}
              <Mono>{reflectorPairs(REFLECTOR_PERMS[MACHINE.reflector]).join(' ')}</Mono>.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  )
}
