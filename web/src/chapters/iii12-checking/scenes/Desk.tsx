/**
 * The checking desk: a stop, the crib's columns, the checking machine (the Enigma on the page, without its plugboard,
 * drums held) and the notes of partners. Pick a column where one letter's partner is known: the drums turn to that
 * column; press the known partner; the lamp is the other letter's partner; record it. A letter with two partners ends
 * the check (a false stop); when every column agrees the stop survives. In 'explore' mode the desk says so and offers
 * the machine's own next move; in 'answer' mode the learner gives the verdict and submits the log.
 */

import { useEffect, useMemo, useState, type JSX } from 'react'
import type { Letter } from '../../../contracts/core'
import { LETTERS } from '../../../engine'
import { INPUT, Mono, QUIET_BUTTON, SubmitButton } from '../../../lesson'
import { MachinePanel } from '../../../machine-ui'
import { useMachineApi } from '../../../state/activeMachine'
import {
  closure,
  columnStates,
  columnWindows,
  nextDeduction,
  notesCables,
  replay,
  type CheckData,
  type CheckStep,
  type StopAnswer,
} from '../gates'

interface Press {
  readonly pos: number | null
  readonly key: string
  readonly lamp: string
}

const STATE_STYLE: Record<string, string> = {
  open: 'border-amber-400/80 text-amber-100',
  check: 'border-sky-500/80 text-sky-100',
  idle: 'border-stone-700 text-stone-400',
}

export function CheckingDesk(p: {
  data: CheckData
  mode: 'explore' | 'answer'
  disabled?: boolean
  submit?(a: StopAnswer): void
  onFinished?(result: 'consistent' | 'contradiction'): void
}): JSX.Element {
  const { data } = p
  const api = useMachineApi()
  const [log, setLog] = useState<readonly CheckStep[]>([])
  const [press, setPress] = useState<Press | null>(null)
  const [problem, setProblem] = useState('')
  const [call, setCall] = useState<'consistent' | 'contradiction' | null>(null)
  const [letter, setLetter] = useState('')
  const r = useMemo(() => replay(data, log), [data, log])
  const states = columnStates(data, r.partner)
  const done = r.conflict ? 'contradiction' : closure(data, r.partner).closed ? 'consistent' : null
  const { cables, plain } = notesCables(r.partner)
  const n = data.crib.length

  // A new stop: fresh notes.
  useEffect(() => {
    setLog([])
    setPress(null)
    setProblem('')
    setCall(null)
    setLetter('')
  }, [data])

  // Each key press on the checking machine: which column the drums stand at, the key and the lamp.
  useEffect(
    () =>
      api.subscribe((s, prev) => {
        if (s.seq === prev.seq || !s.last) return
        const windows = s.machine.positions.map((x) => LETTERS[x]).join('')
        let pos: number | null = null
        for (let k = 1; k <= n; k++) if (columnWindows(data, k) === windows) pos = k
        setPress({ pos, key: s.input.at(-1) ?? '?', lamp: s.last.output })
        setProblem('')
      }),
    [api, data, n],
  )

  const onFinished = p.onFinished
  useEffect(() => {
    if (done && p.mode === 'explore') onFinished?.(done)
  }, [done, p.mode, onFinished])

  const locked = !!p.disabled || (p.mode === 'explore' && done !== null) || !!r.conflict

  const goTo = (pos: number) => {
    if (p.disabled) return
    try {
      api.getState().setPositions(columnWindows(data, pos))
      setPress(null)
      setProblem('')
    } catch {
      setProblem('The drums cannot be turned now.')
    }
  }

  const record = (to: string) => {
    if (!press || press.pos === null || locked) return
    const pos = press.pos
    const [a, b] = [data.crib[pos - 1]!, data.under[pos - 1]!]
    const from = to === a ? b : a
    if (r.partner[from] !== press.key) {
      setProblem(
        r.partner[from]
          ? `To learn ${to}'s partner at column ${pos}, press ${r.partner[from]}, the partner of ${from} in your notes.`
          : `Your notes give no partner for ${from} yet, so this press says nothing about ${to}.`,
      )
      return
    }
    setLog((l) => [...l, { pos, press: press.key, letter: to, partner: press.lamp }])
    setPress(null)
  }

  const auto = () => {
    const s = nextDeduction(data, r.partner)
    if (!s) return
    try {
      api.getState().setPositions(columnWindows(data, s.pos))
      api.getState().pressKey(s.press)
    } catch {
      // A locked machine: the notes still follow the checking machine's move.
    }
    setLog((l) => [...l, s])
    setPress(null)
  }

  const col = press?.pos ?? null
  const colLetters = col ? [data.crib[col - 1]!, data.under[col - 1]!] : []

  return (
    <div
      className="flex flex-col gap-3 text-sm text-stone-300"
      data-testid="checking-desk"
      data-stop={data.stop.positions}
      data-steps={log.length}
      data-status={done ?? 'open'}
    >
      {p.mode === 'explore' ? (
        <p>
          Stop at drum positions <Mono>{data.stop.positions}</Mono>, wheel order <Mono>{data.rotors.join(' ')}</Mono>: the register
          read {data.stop.live} live wire{data.stop.live === 1 ? '' : 's'} with the partner{' '}
          <Mono>
            {data.stop.testLetter}↔{data.stop.stecker}
          </Mono>
          . That is the hypothesis to check.
        </p>
      ) : null}

      <div className="max-w-full overflow-x-auto" role="region" aria-label="The crib’s columns" tabIndex={0}>
        <ol className="flex gap-1 pb-1" aria-label="Crib columns: pick one to turn the drums to it">
          {Array.from({ length: n }, (_, j) => {
            const pos = j + 1
            const st = states[j]!
            const here = press?.pos === pos
            return (
              <li key={pos}>
                <button
                  type="button"
                  disabled={p.disabled}
                  onClick={() => goTo(pos)}
                  data-testid={`check-col-${pos}`}
                  data-state={st}
                  aria-label={`Column ${pos}: ${data.crib[j]} over ${data.under[j]}, ${st === 'open' ? 'one partner known' : st === 'check' ? 'both partners known' : 'no partner known'}`}
                  className={`flex w-9 flex-col items-center rounded border px-0.5 py-1 font-mono ${STATE_STYLE[st]} ${here ? 'bg-stone-800' : ''}`}
                >
                  <span className="text-[10px] text-stone-400">{pos}</span>
                  <span>{data.crib[j]}</span>
                  <span>{data.under[j]}</span>
                </button>
              </li>
            )
          })}
        </ol>
      </div>
      <p className="text-xs text-stone-400">
        Crib letters on top, cipher letters below. Amber: one letter&apos;s partner is in your notes. Blue: both are, so the column
        can be checked.
      </p>

      <MachinePanel show={{ rotors: true, lamps: true, keyboard: true }} />

      <div aria-live="polite" className="flex flex-col gap-2 rounded-lg border border-stone-700 p-3" data-testid="check-press">
        {press ? (
          press.pos === null ? (
            <p>The drums are not at a crib column: pick a column first.</p>
          ) : (
            <>
              <p>
                Column {press.pos} ({colLetters[0]} over {colLetters[1]}): you pressed <Mono>{press.key}</Mono>, lamp{' '}
                <Mono>{press.lamp}</Mono> lit.
              </p>
              <div className="flex flex-wrap gap-2">
                {[...new Set(colLetters)].map((l) => (
                  <button
                    key={l}
                    type="button"
                    className={QUIET_BUTTON}
                    disabled={locked}
                    data-testid={`check-record-${l}`}
                    onClick={() => record(l)}
                  >
                    Note {l}↔{press.lamp}
                  </button>
                ))}
              </div>
            </>
          )
        ) : (
          <p className="text-stone-400">Pick a column, then press the partner you know on the keyboard.</p>
        )}
        {problem ? (
          <p className="text-red-300" data-testid="check-problem">
            {problem}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-1" data-testid="check-notes" data-notes={Object.keys(r.partner).sort().map((x) => x + r.partner[x]).join(' ')}>
        <span className="text-stone-400">Your notes</span>
        <ul className="flex flex-wrap gap-1 font-mono">
          <li className="rounded border border-stone-600 px-1">
            {data.stop.testLetter}↔{data.stop.stecker} (stop)
          </li>
          {log.slice(0, r.conflict ? r.conflict.at : log.length).map((s, k) => (
            <li key={k} className="rounded border border-stone-700 px-1">
              {s.letter}↔{s.partner} ({s.pos})
            </li>
          ))}
          {r.conflict ? (
            <li className="rounded border border-red-500 px-1 text-red-200" data-testid="check-conflict">
              {r.conflict.letters[0]}: {r.conflict.partners[0]} and {r.conflict.partners[1]}!
            </li>
          ) : null}
        </ul>
      </div>

      {p.mode === 'explore' ? (
        <div className="flex flex-col gap-2">
          <div>
            <button type="button" className={QUIET_BUTTON} disabled={done !== null} onClick={auto} data-testid="check-auto">
              Show me the machine&apos;s next move
            </button>
          </div>
          <p aria-live="polite" data-testid="check-result" className="text-stone-200">
            {done === 'contradiction'
              ? `${r.conflict!.letters[0]} would need two partners, ${r.conflict!.partners[0]} and ${r.conflict!.partners[1]}: no plugboard does that, so this stop is false.`
              : done === 'consistent'
                ? `Every column agrees. The stop survives, and the check found the cables ${cables.join(' ') || 'none'}${plain.length ? ` and no cable on ${plain.join(' ')}` : ''}.`
                : ''}
          </p>
        </div>
      ) : (
        <form
          className="flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (call && letter && !p.disabled) p.submit?.({ verdict: call, letter, log: [...log] })
          }}
        >
          <div role="radiogroup" aria-label="Your verdict on the stop" className="flex flex-wrap gap-2">
            {(['contradiction', 'consistent'] as const).map((v) => (
              <button
                key={v}
                type="button"
                role="radio"
                aria-checked={call === v}
                disabled={p.disabled}
                data-testid={`check-verdict-${v}`}
                onClick={() => setCall(v)}
                className={`${QUIET_BUTTON} ${call === v ? 'border-amber-400 bg-amber-400/25 text-amber-100' : ''}`}
              >
                {v === 'contradiction' ? 'The stop fails: a letter needs two partners' : 'The stop survives: every column agrees'}
              </button>
            ))}
          </div>
          <label className="flex flex-wrap items-center gap-2">
            {call === 'consistent' ? `The partner of ${data.stop.testLetter}:` : 'The letter with two partners:'}
            <select value={letter} disabled={p.disabled} onChange={(e) => setLetter(e.target.value)} className={INPUT} data-testid="check-letter">
              <option value="">–</option>
              {LETTERS.map((l: Letter) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </label>
          <div>
            <SubmitButton form disabled={p.disabled || !call || !letter} />
          </div>
        </form>
      )}
    </div>
  )
}
