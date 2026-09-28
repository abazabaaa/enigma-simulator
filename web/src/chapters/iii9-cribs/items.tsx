/**
 * Chapter iii9-cribs's ITEM_UI. Every Prompt prints what its instance needs (cipher text, crib, offset, the rule); the
 * crib rollbacks show a read-only CribStrip at the offset in question with the crash columns in red. Hints at L1 are
 * text in the Prompt (these items have no stage).
 */

import { useState, type JSX, type ReactNode } from 'react'
import type { CodeAnswer } from '../../contracts/code'
import type { AnswerProps, CheckResult, HintLevel, ItemUiMap } from '../../contracts/lesson'
import { crashes } from '../../crypto/cribs'
import { Mono, SubmitButton } from '../../lesson'
import { CribStrip } from '../../viz'
import { failingCase, isInRange, maxOffset, type CrashCountInstance, type CrashFreeInstance, type CribCodeInstance } from './gates'
import { AlignedRows } from './scenes'

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

function Hint({ level, children }: { level: HintLevel; children: ReactNode }): JSX.Element | null {
  if (level < 1) return null
  return (
    <p className="rounded-md border border-sky-800/60 bg-sky-950/30 p-2 text-sky-100" data-testid="item-hint">
      {children}
    </p>
  )
}

/** A read-only strip at an offset, with a sentence naming the crash columns. */
function CribAt({ cipher, crib, offset, testId }: { cipher: string; crib: string; offset: number; testId: string }): JSX.Element {
  const hits = crashes(cipher, crib, offset)
  return (
    <div className="flex flex-col gap-2">
      <CribStrip cipher={cipher} crib={crib} offset={offset} readOnly testId={testId} />
      <p>
        At offset {offset}:{' '}
        {hits.length === 0
          ? 'no crash.'
          : `${plural(hits.length, 'crash', 'crashes')}, at crib ${hits.length === 1 ? 'index' : 'indices'} ${hits.join(', ')} (counting from 0).`}
      </p>
    </div>
  )
}

function CribFeedback({ instance, result }: { instance: { cipher: string; crib: string }; result: CheckResult }) {
  if (result.rollback.kind !== 'crib') return null
  return (
    <div data-testid="crib-feedback">
      <CribAt cipher={instance.cipher} crib={instance.crib} offset={result.rollback.offset} testId="crib-rollback" />
    </div>
  )
}

// ---------------------------------------------------------------------------
// crash-free
// ---------------------------------------------------------------------------

function CrashFreePrompt({ instance, hintLevel }: { instance: CrashFreeInstance; hintLevel: HintLevel }): JSX.Element {
  return (
    <div className="flex flex-col gap-2">
      <p>
        A message of {instance.cipher.length} letters, enciphered on an Enigma I with the day’s key. Its plaintext contains the crib{' '}
        <Mono>{instance.crib}</Mono> ({instance.crib.length} letters) somewhere. Enigma never enciphers a letter to itself, so the crib
        cannot sit where one of its letters is under the same cipher letter (a crash).
      </p>
      <p>
        Slide the crib to an offset where it can sit (offsets 0 to {maxOffset(instance)}), then submit that offset. The strip shows the
        crashes of the offset you are at.
      </p>
      <Hint level={hintLevel}>
        A crash is a red column: the crib letter equals the cipher letter above it. Keep sliding, one letter at a time, until no
        column is red.
      </Hint>
    </div>
  )
}

function CrashFreeAnswer({ instance, disabled, submit }: AnswerProps<CrashFreeInstance, number>): JSX.Element {
  const [offset, setOffset] = useState(0)
  return (
    <div className="flex flex-col gap-3" data-testid="crash-free-answer">
      <CribStrip
        cipher={instance.cipher}
        crib={instance.crib}
        offset={offset}
        onOffset={setOffset}
        readOnly={disabled}
        testId="crash-free-strip"
      />
      <div>
        <SubmitButton disabled={disabled} onClick={() => submit(offset)}>
          Submit offset {offset}
        </SubmitButton>
      </div>
    </div>
  )
}

const crashFree = {
  Prompt: CrashFreePrompt,
  Answer: CrashFreeAnswer,
  Worked: ({ instance, solution }: { instance: CrashFreeInstance; solution: number }) => (
    <div className="flex flex-col gap-2 text-sm">
      <p>
        Crib <Mono>{instance.crib}</Mono> under a message of {instance.cipher.length} letters: slide from offset 0, and at every
        offset look for a column where the two letters are the same.
      </p>
      <CribAt cipher={instance.cipher} crib={instance.crib} offset={solution} testId="crash-free-worked" />
      <p>So the crib may sit at offset {solution}.</p>
    </div>
  ),
  Feedback: CribFeedback,
}

// ---------------------------------------------------------------------------
// crash-count
// ---------------------------------------------------------------------------

const crashCount = {
  Prompt: ({ instance, hintLevel }: { instance: CrashCountInstance; hintLevel: HintLevel }) => (
    <div className="flex flex-col gap-2">
      <p>
        The crib <Mono>{instance.crib}</Mono> written under a message of {instance.cipher.length} letters, starting under cipher letter{' '}
        {instance.offset} (offsets count from 0). How many crashes does it have there? A crash is a column where the crib letter is the
        same as the cipher letter above it.
      </p>
      <AlignedRows
        cipher={instance.cipher}
        crib={instance.crib}
        offset={instance.offset}
        testId="crash-count-rows"
        label={`The crib ${instance.crib} under the cipher text ${instance.cipher} at offset ${instance.offset}`}
      />
      <Hint level={hintLevel}>
        Go along the crib letter by letter and compare each one with the cipher letter directly above it (not one to the left or
        right). Count the columns where the two letters are the same.
      </Hint>
    </div>
  ),
  Worked: ({ instance, solution }: { instance: CrashCountInstance; solution: number[] }) => (
    <div className="flex flex-col gap-2 text-sm">
      <p>Compare the columns one by one; the red ones are the crashes.</p>
      <CribAt cipher={instance.cipher} crib={instance.crib} offset={instance.offset} testId="crash-count-worked" />
      <p>Answer: {solution[0]}.</p>
    </div>
  ),
  Feedback: CribFeedback,
}

// ---------------------------------------------------------------------------
// is-consistent-crib (code)
// ---------------------------------------------------------------------------

/**
 * The code item's rollback: the case the run failed on (its crib at its offset, or where it runs off the cipher
 * text); the prediction's strip only when every case passed and the prediction was the wrong part.
 */
function CodeFeedback({ instance, answer, result }: { instance: CribCodeInstance; answer: CodeAnswer; result: CheckResult }) {
  if (result.rollback.kind !== 'crib') return null
  const failing = failingCase(instance, answer)
  if (failing) {
    const [cipher, crib, offset] = failing.args as [string, string, number]
    return (
      <div className="flex flex-col gap-2" data-testid="crib-feedback" data-case={failing.label}>
        <p>
          Your function failed the case “{failing.label}”: <Mono>isConsistentCrib(&quot;{cipher}&quot;, &quot;{crib}&quot;, {offset})</Mono>{' '}
          should return <Mono>{String(failing.expect)}</Mono>, and returned <Mono>{answer.run.firstFailure?.actual ?? '?'}</Mono>.
        </p>
        {isInRange(cipher, crib, offset) ? (
          <CribAt cipher={cipher} crib={crib} offset={offset} testId="crib-rollback" />
        ) : (
          <p data-testid="crib-off-end">
            At offset {offset} the {crib.length}-letter crib runs off {offset < 0 ? 'the start' : 'the end'} of the{' '}
            {cipher.length}-letter cipher text: it does not fit, so the answer is false.
          </p>
        )}
      </div>
    )
  }
  if (answer?.run?.status === 'pass') {
    return (
      <div className="flex flex-col gap-2" data-testid="crib-feedback" data-case="prediction">
        <p>Every case passed; the prediction was the wrong part. The crib at offset {instance.offset}:</p>
        <CribAt cipher={instance.cipher} crib={instance.crib} offset={instance.offset} testId="crib-rollback" />
      </div>
    )
  }
  return null
}

const isConsistent = {
  Prompt: ({ instance, hintLevel }: { instance: CribCodeInstance; hintLevel: HintLevel }) => (
    <div className="flex flex-col gap-2">
      <p>
        Write the test the analysts ran by eye. For your prediction, use this message of {instance.cipher.length} letters (its letters
        numbered from 0) and the crib <Mono>{instance.crib}</Mono> ({instance.crib.length} letters, crib indices from 0):
      </p>
      <AlignedRows
        cipher={instance.cipher}
        testId="code-cipher-rows"
        label={`The cipher text ${instance.cipher}, letters numbered from 0`}
      />
      <p>
        Crib: <Mono>{instance.crib}</Mono>
      </p>
      <Hint level={hintLevel}>
        Return false when the crib runs off either end of the cipher text. Otherwise walk the crib: crib letter i sits under cipher
        letter offset + i, and one equal pair is enough to return false.
      </Hint>
    </div>
  ),
  // Never the reference source: the method, and the probe's value for the instance it is shown with.
  Worked: ({ instance, solution }: { instance: CribCodeInstance; solution: CodeAnswer }) => (
    <div className="flex flex-col gap-2 text-sm">
      <p>
        Place the crib's first letter under cipher letter {instance.offset}, then compare crib letter i with cipher letter{' '}
        {instance.offset} + i for i = 0, 1, 2, … The first equal pair is the first crash.
      </p>
      <CribAt cipher={instance.cipher} crib={instance.crib} offset={instance.offset} testId="code-worked" />
      <p>
        So the first crash at offset {instance.offset} has crib index {solution.probe}, and isConsistentCrib returns false there.
      </p>
    </div>
  ),
  Feedback: CodeFeedback,
}

export const ITEM_UI: ItemUiMap = {
  'crash-free': crashFree,
  'crash-count': crashCount,
  'is-consistent-crib': isConsistent,
}
