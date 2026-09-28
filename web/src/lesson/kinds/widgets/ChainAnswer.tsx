import { useState, type JSX } from 'react'
import type { TraceStage } from '../../../contracts/core'
import { Sym } from '../../../lib/Sym'
import { symForStage } from '../../../lib/symbols'
import { INPUT, SubmitButton } from '../../ui/controls'
import type { WidgetProps } from './types'

const STAGES = new Set<string>([
  'plugboard-in',
  'etw-in',
  'rotor-right-fwd',
  'rotor-middle-fwd',
  'rotor-left-fwd',
  'rotor-greek-fwd',
  'reflector',
  'rotor-greek-bwd',
  'rotor-left-bwd',
  'rotor-middle-bwd',
  'rotor-right-bwd',
  'etw-out',
  'plugboard-out',
])

/** One letter per stage, each labelled with its stage and the symbol of the part it passes. */
export function ChainAnswer({
  instance,
  disabled,
  submit,
}: WidgetProps<{ stages: readonly { id: string; label: string }[]; alphabet?: number }, string[]>): JSX.Element {
  const [tokens, setTokens] = useState<string[]>(() => instance.stages.map(() => ''))
  const last = String.fromCharCode(64 + (instance.alphabet ?? 26))
  const valid = tokens.every((t) => t.length === 1 && t <= last)
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault()
        if (valid && !disabled) submit(tokens)
      }}
    >
      <ol className="flex flex-wrap gap-2">
        {instance.stages.map((s, k) => (
          <li key={s.id} className="flex flex-col items-center gap-1 rounded-md border border-stone-700 p-2">
            <label className="flex flex-col items-center gap-1 text-xs text-stone-400">
              <span>
                {STAGES.has(s.id) ? <Sym s={symForStage(s.id as TraceStage)} inv={s.id.endsWith('-bwd')} /> : null} {s.label}
              </span>
              <input
                data-testid={`answer-chain-${s.id}`}
                className={`${INPUT} w-10 text-center uppercase`}
                value={tokens[k]}
                disabled={disabled}
                autoComplete="off"
                onChange={(e) => {
                  const v = e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(-1)
                  setTokens((t) => t.map((x, j) => (j === k ? v : x)))
                }}
              />
            </label>
          </li>
        ))}
      </ol>
      <div>
        <SubmitButton disabled={disabled || !valid} onClick={() => valid && submit(tokens)} />
      </div>
    </form>
  )
}
