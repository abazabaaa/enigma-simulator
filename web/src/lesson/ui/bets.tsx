import { createContext, useContext, useState, type JSX } from 'react'
import type { BetSpec, RevealSpec } from '../../contracts/lesson'
import type { BetRecord } from '../../contracts/progress'
import { BUTTON, INPUT, QUIET_BUTTON } from './controls'

/** The reveal state of the scene on screen (RevealButton and useRevealFired read it). */
export interface SceneRuntime {
  readonly fired: ReadonlySet<string>
  isCommitted(bet: string): boolean
  /** Committed, and every earlier reveal of the scene has fired (reveals fire in order). */
  isAllowed(bet: string): boolean
  fire(bet: string): void
}

export const SceneRuntimeContext = createContext<SceneRuntime | null>(null)

/** Whether a reveal has fired in this visit of the scene (chapter Views react to 'play', 'run' and 'toggle'). */
export function useRevealFired(bet: string): boolean {
  return useContext(SceneRuntimeContext)?.fired.has(bet) ?? false
}

const TRIGGER_LABEL: Record<RevealSpec['trigger'], string> = {
  press: 'Press',
  step: 'Step',
  run: 'Run',
  toggle: 'Toggle',
  play: 'Play',
}

/** The trigger of a reveal (reveal-<bet>): disabled until its bet is committed. */
export function RevealButton({ reveal, label }: { reveal: RevealSpec; label?: string }): JSX.Element {
  const rt = useContext(SceneRuntimeContext)
  const committed = rt?.isCommitted(reveal.bet) ?? false
  const allowed = rt?.isAllowed(reveal.bet) ?? false
  return (
    <button
      type="button"
      data-testid={`reveal-${reveal.bet}`}
      data-fired={String(rt?.fired.has(reveal.bet) ?? false)}
      className={BUTTON}
      disabled={!allowed}
      onClick={() => rt?.fire(reveal.bet)}
    >
      {label ?? TRIGGER_LABEL[reveal.trigger]}
      {!committed ? ' (bet first)' : !allowed ? ' (after the earlier reveal)' : ''}
    </button>
  )
}

/** One bet (G10): recorded and resolved, never scored. */
export function BetPanel(p: {
  bet: BetSpec
  record: BetRecord | undefined
  alphabet: number
  onEngage(): void
  onCommit(value: string): void
}): JSX.Element {
  const { bet, record } = p
  const [value, setValue] = useState<string>('')
  const committed = record !== undefined
  const choose = (v: string) => {
    setValue(v)
    p.onEngage()
  }
  const options =
    bet.kind === 'choice'
      ? (bet.options ?? []).map((o) => ({ id: o.id, label: o.label }))
      : bet.kind === 'letter'
        ? Array.from({ length: p.alphabet }, (_, k) => ({
            id: String.fromCharCode(65 + k),
            label: String.fromCharCode(65 + k),
          }))
        : []
  const label = (id: string) => options.find((o) => o.id === id)?.label ?? id
  return (
    <fieldset
      data-testid={`bet-${bet.id}`}
      data-committed={String(committed)}
      className="rounded-lg border border-violet-700/60 bg-violet-950/20 p-3"
    >
      <legend className="px-1 text-sm font-semibold text-violet-200">Your bet</legend>
      <p className="mb-2 text-sm text-stone-200">{bet.prompt}</p>
      {committed ? (
        <p className="text-sm text-stone-300" data-testid={`bet-result-${bet.id}`}>
          You bet <strong>{label(record.value)}</strong>.
          {record.correct === true
            ? ' You were right.'
            : record.correct === false
              ? ' Not this time: see what happened.'
              : ''}
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {bet.kind === 'number' ? (
            <input
              data-testid={`bet-input-${bet.id}`}
              aria-label={bet.prompt}
              inputMode="numeric"
              className={`${INPUT} w-28`}
              value={value}
              onChange={(e) => choose(e.target.value.replace(/[^\d.-]/g, ''))}
            />
          ) : (
            <div
              role="radiogroup"
              aria-label={bet.prompt}
              className={bet.kind === 'letter' ? 'flex flex-wrap gap-1' : 'flex flex-col gap-1'}
            >
              {options.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  role="radio"
                  aria-checked={value === o.id}
                  data-testid={`bet-option-${bet.id}-${o.id}`}
                  className={`${QUIET_BUTTON} text-left ${value === o.id ? 'border-violet-400 text-violet-100' : ''} ${bet.kind === 'letter' ? 'w-9 px-0 text-center font-mono' : ''}`}
                  onClick={() => choose(o.id)}
                >
                  {o.label}
                </button>
              ))}
            </div>
          )}
          <div>
            <button
              type="button"
              data-testid={`bet-commit-${bet.id}`}
              className={BUTTON}
              disabled={value === ''}
              onClick={() => value !== '' && p.onCommit(value)}
            >
              Commit my bet
            </button>
          </div>
        </div>
      )}
    </fieldset>
  )
}
