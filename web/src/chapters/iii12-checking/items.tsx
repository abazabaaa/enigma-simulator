/**
 * Chapter iii12-checking's ITEM_UI. stop-verdict's Answer is the checking desk (the machine on the page, without its
 * plugboard); set-key uses the generic set-the-machine widget with its live decrypt preview, and its prompt gives what
 * the stop and the checking machine found. Worked examples render their own instance.
 */

import type { JSX, ReactNode } from 'react'
import type { AnswerProps, HintLevel, ItemUiMap } from '../../contracts/lesson'
import { Mono } from '../../lesson'
import { canonicalLog, keyScenario, type KeyInstance, type StopAnswer, type StopInstance } from './gates'
import { CheckingDesk } from './scenes'

function Hint({ level, children }: { level: HintLevel; children: ReactNode }): JSX.Element | null {
  if (level < 1) return null
  return (
    <p className="rounded-md border border-sky-800/60 bg-sky-950/30 p-2 text-sky-100" data-testid="item-hint">
      {children}
    </p>
  )
}

// ---------------------------------------------------------------------------
// stop-verdict
// ---------------------------------------------------------------------------

function StopPrompt({ instance, hintLevel }: { instance: StopInstance; hintLevel: HintLevel }): JSX.Element {
  return (
    <div className="flex flex-col gap-2">
      <p>
        The bombe stopped on wheel order <Mono>{instance.rotors.join(' ')}</Mono> (rings 01 01 01) at drum positions{' '}
        <Mono>{instance.stop.positions}</Mono>, with the crib <Mono>{instance.crib}</Mono> over the cipher letters{' '}
        <Mono>{instance.under}</Mono>. Its test register suggests{' '}
        <Mono>
          {instance.stop.testLetter}↔{instance.stop.stecker}
        </Mono>
        . Check the stop on the checking machine below: is it the key, or a false stop?
      </p>
      <Hint level={hintLevel}>
        Start with the columns that hold {instance.stop.testLetter} or {instance.stop.stecker} (amber). At such a column press the
        partner you know; the lamp is the partner of the column&apos;s other letter. Note it, and look for the next amber column. Blue
        columns have both partners noted: press one to see whether they agree.
      </Hint>
    </div>
  )
}

function StopAnswerWidget({ instance, disabled, submit }: AnswerProps<StopInstance, StopAnswer>): JSX.Element {
  return <CheckingDesk data={instance} mode="answer" disabled={disabled} submit={submit} />
}

function StopWorked({ instance, solution }: { instance: StopInstance; solution: StopAnswer }): JSX.Element {
  const c = canonicalLog(instance)
  return (
    <div className="flex flex-col gap-2 text-sm">
      <p>
        Stop <Mono>{instance.stop.positions}</Mono> on <Mono>{instance.rotors.join(' ')}</Mono>, crib <Mono>{instance.crib}</Mono> over{' '}
        <Mono>{instance.under}</Mono>, hypothesis {instance.stop.testLetter}↔{instance.stop.stecker}. Column by column:
      </p>
      <ol className="flex flex-col gap-0.5 font-mono text-xs">
        {solution.log.map((s, k) => (
          <li key={k}>
            column {s.pos} ({instance.crib[s.pos - 1]} over {instance.under[s.pos - 1]}): press {s.press}, lamp {s.partner}, so {s.letter}↔
            {s.partner}
          </li>
        ))}
      </ol>
      <p>
        {c.conflict
          ? `${c.conflict.letters[0]} would need two partners (${c.conflict.partners.slice(0, 2).join(' and ')}): a false stop. Answer: fails, ${solution.letter}.`
          : `Every column agrees: the stop survives. Answer: survives, ${instance.stop.testLetter}’s partner ${solution.letter}.`}
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// set-key
// ---------------------------------------------------------------------------

function KeyFacts({ instance }: { instance: KeyInstance }): JSX.Element | null {
  const sc = keyScenario(instance.seed)
  if (!sc) return null
  return (
    <>
      <p>
        The message is <Mono>{sc.cipher.length}</Mono> letters long. Its crib, <Mono>{sc.crib}</Mono>, starts at letter{' '}
        <Mono>{sc.offset + 1}</Mono>. The bombe&apos;s stop that survived the check: wheel order <Mono>{sc.day.rotors.join(' ')}</Mono>,
        drum positions <Mono>{sc.stop.positions}</Mono> at the crib&apos;s first letter, rings 01 01 01, reflector B.
      </p>
      <p>
        The checking machine found the cables <Mono>{sc.cables.join(' ')}</Mono>
        {sc.plainLetters.length ? (
          <>
            {' '}
            and no cable on <Mono>{sc.plainLetters.join(' ')}</Mono>
          </>
        ) : null}
        . The day used 10 cables.
      </p>
      <p className="font-mono text-xs break-all text-stone-400">{sc.cipher}</p>
    </>
  )
}

function KeyPrompt({ instance, hintLevel }: { instance: KeyInstance; hintLevel: HintLevel }): JSX.Element {
  return (
    <div className="flex flex-col gap-2">
      <KeyFacts instance={instance} />
      <p>
        Set the machine so that the whole message decrypts: the wheel order, the windows at the message&apos;s first letter, and every
        cable. The keyboard is locked; the preview below decrypts the message with your settings as you go. Where a cable is still
        missing, plain letters come out swapped with their partner (WETTER can read TEWWER).
      </p>
      <Hint level={hintLevel}>
        The stop gives the windows at the crib&apos;s first letter. The message started earlier: turn the right rotor back one place for
        each letter before the crib. Then add the cables the check found and read the preview for a pair of letters that keep
        trading places.
      </Hint>
    </div>
  )
}

function KeyWorked({ instance, solution }: { instance: KeyInstance; solution: { rotors: readonly string[]; positions: readonly string[]; plugboard: readonly string[] } }): JSX.Element {
  const sc = keyScenario(instance.seed)
  if (!sc) return <p className="text-sm">This example could not be rebuilt.</p>
  const missing = solution.plugboard.filter((p) => !sc.cables.includes([...p].sort().join('')))
  return (
    <div className="flex flex-col gap-2 text-sm">
      <KeyFacts instance={instance} />
      <p>
        Wheel order <Mono>{solution.rotors.join(' ')}</Mono>. The crib starts {sc.offset} letter{sc.offset === 1 ? '' : 's'} in, so the
        right rotor goes back {sc.offset} place{sc.offset === 1 ? '' : 's'} from <Mono>{sc.stop.positions}</Mono>: windows{' '}
        <Mono>{solution.positions.join('')}</Mono>. Cables: those the check found, plus <Mono>{missing.join(' ') || 'none'}</Mono> read
        from the swapped letters in the preview.
      </p>
    </div>
  )
}

export const ITEM_UI: ItemUiMap = {
  'stop-verdict': { Prompt: StopPrompt, Answer: StopAnswerWidget, Worked: StopWorked },
  'set-key': { Prompt: KeyPrompt, Worked: KeyWorked },
}
