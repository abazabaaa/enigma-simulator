/**
 * tables (worked, free presses): the components S, H, N, M, L and U as tables at the machine's current windows (N, M
 * and L at their offsets window − ring), and E composed from them factor by factor, left to right. The rotors are
 * held and the windows are the learner's: turning a rotor redraws every table. When all 11 factors are in, the
 * product is E, and a key press lights the letter below the key in E (task compose-all).
 */

import { useEffect, useMemo, useState, type JSX } from 'react'
import { useStore } from 'zustand'
import type { SceneProps } from '../../../contracts/lesson'
import { LETTERS, machinePermutation, positionsToString } from '../../../engine'
import { BUTTON, Mono, QUIET_BUTTON } from '../../../lesson'
import { Sym } from '../../../lib/Sym'
import { PermTable } from '../../../machine-ui'
import { useStageStore } from '../../../state/stageStore'
import { COMPONENTS, COMPONENT_NAME, COMPONENT_PART, FACTORS, componentPerm, partialProduct } from '../gates'

const ring = (r: string) => String(r.charCodeAt(0) - 64).padStart(2, '0')

function FactorList({ k }: { k: number }): JSX.Element {
  return (
    <span className="inline-flex flex-wrap items-center gap-0.5 font-mono">
      {k === 0 ? 'identity' : null}
      {FACTORS.slice(0, k).map((f, j) => (
        <span key={j}>
          {j ? '·' : ''}
          <Sym s={f.sym} inv={f.inv} />
        </span>
      ))}
    </span>
  )
}

export function TablesView(p: SceneProps): JSX.Element {
  const machine = useStore(p.store, (s) => s.machine)
  const last = useStore(p.store, (s) => s.last)
  const [k, setK] = useState(0)
  const setHighlight = useStageStore((s) => s.setHighlight)
  const { completeTask } = p

  const product = useMemo(() => partialProduct(machine, k), [machine, k])
  const e = useMemo(() => [...machinePermutation(machine)], [machine])
  const done = k === FACTORS.length
  useEffect(() => {
    if (done) completeTask('compose-all')
  }, [done, completeTask])

  const next = () => {
    const f = FACTORS[k]
    if (!f) return
    setK(k + 1)
    setHighlight([{ part: COMPONENT_PART[f.sym], tone: 'hint' }])
  }

  const config = machine.config
  const agrees = done && product.every((x, i) => x === e[i])
  const pressed = last && done ? { key: last.trace[0]!.input, lamp: last.output } : null
  return (
    <div className="flex flex-col gap-3 text-sm text-stone-300" data-testid="tables-view">
      <p>
        Rotors <Mono>{config.rotors.join(' ')}</Mono>, rings <Mono>{config.rings.map(ring).join(' ')}</Mono>, windows{' '}
        <Mono>{positionsToString(machine)}</Mono>, cables <Mono>{config.plugboard.join(' ')}</Mono>. The rotors are held, so these
        tables stay put when you press a key; turn a rotor and they change. Each rotor&apos;s table is its wiring at its offset
        (window − ring).
      </p>
      <div className="grid gap-3 lg:grid-cols-2" data-testid="component-tables">
        {COMPONENTS.map((s) => (
          <PermTable key={s} perm={componentPerm(machine, s)} sym={s} label={COMPONENT_NAME[s]} testId={`table-${s}`} />
        ))}
      </div>
      <section className="flex flex-col gap-2 rounded-lg border border-stone-700 bg-stone-900/60 p-3" data-testid="compose-steps" data-k={k}>
        <h3 className="font-semibold text-stone-100">Worked example: E, one factor at a time</h3>
        <p>
          Composing left to right, each new factor is looked up after everything before it. So far: <FactorList k={k} />
        </p>
        <PermTable perm={product} label={done ? 'E, the whole key press' : `The product of the first ${k} factor${k === 1 ? '' : 's'}`} testId="compose-product" />
        <div className="flex flex-wrap gap-2">
          <button type="button" className={BUTTON} data-testid="compose-next" disabled={done} onClick={next}>
            {done ? 'All 11 factors composed' : (
              <>
                Compose the next factor: <Sym s={FACTORS[k]!.sym} inv={FACTORS[k]!.inv} />
              </>
            )}
          </button>
          <button type="button" className={QUIET_BUTTON} data-testid="compose-reset" disabled={k === 0} onClick={() => setK(0)}>
            Start again
          </button>
        </div>
        {done ? (
          <p data-testid="compose-result">
            {agrees ? 'This product is E: exactly the machine at these windows. ' : ''}Every letter goes to a different letter and the
            letters come in pairs (E is its own inverse). Everything between the two plugboard factors, H·N·M·L·U·L⁻¹·M⁻¹·N⁻¹·H⁻¹,
            is the scrambler E₀ of the previous chapter, so E = S·E₀·S⁻¹: the cables relabel E₀&apos;s letters on the way in and
            again on the way out. Press a key: the lamp is the letter below the key.
            {pressed ? (
              <>
                {' '}
                You pressed <Mono>{pressed.key}</Mono>; E sends it to <Mono>{LETTERS[e[LETTERS.indexOf(pressed.key)]!]}</Mono>, and lamp{' '}
                <Mono>{pressed.lamp}</Mono> lit.
              </>
            ) : null}
          </p>
        ) : null}
      </section>
    </div>
  )
}
