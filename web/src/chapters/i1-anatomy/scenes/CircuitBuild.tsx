/**
 * The circuit, built up in four steps (the worked example of toy-wire): a battery, a key and a bulb; six keys and six
 * bulbs, one wire each; the same wires scrambled (the toy's rotor); and the circuit folded back by a reflector, which
 * is the toy on the stage. In the first three steps the learner closes a key and its bulb lights.
 */

import { useState, type JSX } from 'react'
import type { ToySpec } from '../../../contracts/machine'
import { LETTERS } from '../../../engine'
import { QUIET_BUTTON } from '../../../lesson'
import { toyStagePerms } from '../gates'

export const BUILD_STEPS = 4

const CAPTION: Readonly<Record<number, string>> = {
  1: 'A battery, a key and a bulb. Press the key: the circuit closes and the bulb lights.',
  2: 'Six keys and six bulbs, one wire each. Each key lights its own letter: not much of a secret.',
  3: 'What if we scramble these wires? Now each key lights another letter. Put the scrambled wires in a wheel and you have a rotor.',
  4: 'Fold the circuit back: a reflector at the far end joins the contacts in pairs, so the current crosses the rotor, turns round and crosses it again, to a lamp beside the keys. That is the toy on the stage above: one rotor and a reflector.',
}

const W = 360
const H = 220
const ROW = (i: number) => 32 + i * 30
const KEY_X = 300
const BULB_X = 60
const ROTOR = { x0: 150, x1: 210 }

function Bulb({ x, y, lit, label }: { x: number; y: number; lit: boolean; label: string }): JSX.Element {
  return (
    <g data-bulb={label} data-lit={String(lit)}>
      <circle cx={x} cy={y} r={10} fill={lit ? 'var(--sym-signal)' : '#1c1917'} stroke={lit ? '#fef3c7' : '#78716c'} />
      <text x={x} y={y + 4} textAnchor="middle" fontSize={11} fill={lit ? '#0c0a09' : 'currentColor'}>
        {label}
      </text>
    </g>
  )
}

function Key({ x, y, label, down }: { x: number; y: number; label: string; down: boolean }): JSX.Element {
  return (
    <g>
      <rect x={x - 11} y={y - 11} width={22} height={22} rx={3} fill="#292524" stroke={down ? 'var(--sym-signal)' : '#78716c'} strokeWidth={down ? 2 : 1} />
      <text x={x} y={y + 4} textAnchor="middle" fontSize={11} fill="currentColor">
        {label}
      </text>
    </g>
  )
}

const wire = (lit: boolean) => ({ fill: 'none', stroke: lit ? 'var(--sym-signal)' : '#78716c', strokeWidth: lit ? 2.5 : 1.2 })

export function CircuitBuild({ spec }: { spec: ToySpec }): JSX.Element {
  const [step, setStep] = useState(1)
  const [down, setDown] = useState<number | null>(null)
  const n = spec.n
  const perms = toyStagePerms(spec)
  const rotor = perms[1]!
  const back = perms[3]!
  const map = step === 2 ? LETTERS.slice(0, n).map((_, k) => k) : rotor
  const rows = Array.from({ length: n }, (_, i) => i)

  const go = (s: number) => {
    setStep(Math.max(1, Math.min(BUILD_STEPS, s)))
    setDown(null)
  }

  let drawing: JSX.Element
  if (step === 1) {
    const lit = down === 0
    drawing = (
      <>
        <path d={`M ${KEY_X} 150 L ${KEY_X} 60 L ${BULB_X} 60 L ${BULB_X} 150`} {...wire(lit)} />
        <path d={`M ${BULB_X} 150 L 160 150 M 200 150 L ${KEY_X} 150`} {...wire(lit)} />
        <g data-part="battery">
          <line x1={172} y1={136} x2={172} y2={164} stroke="currentColor" strokeWidth={3} />
          <line x1={188} y1={142} x2={188} y2={158} stroke="currentColor" strokeWidth={3} />
          <text x={180} y={185} textAnchor="middle" fontSize={11} fill="currentColor">
            battery
          </text>
        </g>
        <Key x={KEY_X} y={60} label="key" down={lit} />
        <Bulb x={BULB_X} y={60} lit={lit} label="" />
      </>
    )
  } else if (step <= 3) {
    drawing = (
      <>
        {step === 3 ? (
          <rect x={ROTOR.x0} y={14} width={ROTOR.x1 - ROTOR.x0} height={ROW(n - 1) + 4} rx={6} fill="none" stroke="var(--sym-N)" />
        ) : null}
        {rows.map((i) => {
          const j = map[i]!
          const lit = down === i
          const d =
            step === 2
              ? `M ${KEY_X} ${ROW(i)} L ${BULB_X} ${ROW(j)}`
              : `M ${KEY_X} ${ROW(i)} L ${ROTOR.x1} ${ROW(i)} L ${ROTOR.x0} ${ROW(j)} L ${BULB_X} ${ROW(j)}`
          return <path key={i} d={d} {...wire(lit)} />
        })}
        {rows.map((i) => (
          <Key key={`k${i}`} x={KEY_X} y={ROW(i)} label={LETTERS[i]!} down={down === i} />
        ))}
        {rows.map((j) => (
          <Bulb key={`b${j}`} x={BULB_X} y={ROW(j)} lit={down !== null && map[down] === j} label={LETTERS[j]!} />
        ))}
      </>
    )
  } else {
    const reflector = perms[2]!
    drawing = (
      <>
        <rect x={ROTOR.x0} y={14} width={ROTOR.x1 - ROTOR.x0} height={ROW(n - 1) + 4} rx={6} fill="none" stroke="var(--sym-N)" />
        <rect x={40} y={14} width={50} height={ROW(n - 1) + 4} rx={6} fill="none" stroke="var(--sym-U)" />
        {rows.map((i) => (
          <path key={`r${i}`} d={`M ${ROTOR.x1} ${ROW(i)} L ${ROTOR.x0} ${ROW(rotor[i]!)}`} {...wire(false)} />
        ))}
        {rows
          .filter((a) => reflector[a]! > a)
          .map((a) => {
            const b = reflector[a]!
            const x = 84 - ((a * 9) % 36)
            return <path key={`u${a}`} d={`M 90 ${ROW(a)} L ${x} ${ROW(a)} L ${x} ${ROW(b)} L 90 ${ROW(b)}`} fill="none" stroke="var(--sym-U)" strokeWidth={1.4} />
          })}
        {rows.map((i) => (
          <path key={`w${i}`} d={`M ${ROTOR.x0} ${ROW(i)} L 90 ${ROW(i)} M ${ROTOR.x1} ${ROW(i)} L ${KEY_X - 14} ${ROW(i)}`} {...wire(false)} />
        ))}
        {rows.map((i) => (
          <Key key={`k${i}`} x={KEY_X} y={ROW(i)} label={LETTERS[i]!} down={false} />
        ))}
        {rows.map((i) => (
          <Bulb key={`b${i}`} x={KEY_X + 34} y={ROW(i)} lit={false} label={LETTERS[i]!} />
        ))}
        <text x={65} y={H - 6} textAnchor="middle" fontSize={10} fill="currentColor">
          reflector
        </text>
        <text x={(ROTOR.x0 + ROTOR.x1) / 2} y={H - 6} textAnchor="middle" fontSize={10} fill="currentColor">
          rotor
        </text>
      </>
    )
  }

  return (
    <section data-testid="circuit-build" data-step={step} className="flex flex-col gap-2 rounded-lg border border-stone-700 bg-stone-900/40 p-3">
      <h3 className="text-sm font-semibold text-stone-100">
        Worked example: build the circuit ({step} of {BUILD_STEPS})
      </h3>
      <p data-testid="circuit-caption">{CAPTION[step]}</p>
      <svg viewBox={`0 0 ${W} ${H}`} className="mx-auto h-auto w-full max-w-md font-mono text-stone-300" aria-hidden="true">
        {drawing}
      </svg>
      {step < 4 ? (
        <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Close a key">
          {(step === 1 ? [0] : rows).map((i) => (
            <button
              key={i}
              type="button"
              data-testid={`build-key-${step === 1 ? 'key' : LETTERS[i]}`}
              aria-pressed={down === i}
              className={`${QUIET_BUTTON} font-mono`}
              onClick={() => setDown(down === i ? null : i)}
            >
              {step === 1 ? 'Press the key' : LETTERS[i]}
            </button>
          ))}
          <span className="ml-2 text-xs text-stone-400" data-testid="build-lamp">
            {down === null ? '' : step === 1 ? 'The bulb lights.' : `${LETTERS[down]} lights ${LETTERS[map[down]!]}.`}
          </span>
        </div>
      ) : (
        <p className="text-xs text-stone-400">
          On the way back the current crosses the rotor&apos;s wires in the other direction: from {LETTERS[0]}&apos;s contact on the left it
          comes out where the wire that lands on {LETTERS[0]} started, {LETTERS[back[0]!]}.
        </p>
      )}
      <div className="flex gap-2">
        <button type="button" className={QUIET_BUTTON} data-testid="build-prev" disabled={step === 1} onClick={() => go(step - 1)}>
          Back
        </button>
        <button type="button" className={QUIET_BUTTON} data-testid="build-next" disabled={step === BUILD_STEPS} onClick={() => go(step + 1)}>
          Next step
        </button>
      </div>
    </section>
  )
}
