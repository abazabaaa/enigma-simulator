/**
 * align: CF of the 65 indicators is two cycles of 13. Writing one under the other pairs their letters: each column is
 * a swap of C, and F = C·CF follows. Read forwards the split fails; read backwards every one of the 13 offsets gives
 * a C and an F made only of swaps. The learner finds three of them (task try3).
 */

import { useEffect, useMemo, useState, type JSX } from 'react'
import type { SceneProps } from '../../../contracts/lesson'
import { factorizationCount } from '../../../crypto'
import { formatCycles } from '../../../engine'
import { Mono } from '../../../lesson'
import { CycleAlign } from '../../../viz'
import { CF65, CF_PAIR, cycleText, splitFromAlignment } from '../gates'

const [A, B] = CF_PAIR
const SPLITS = factorizationCount(CF65)

export function AlignView(p: SceneProps): JSX.Element {
  const [offset, setOffset] = useState(0)
  const [reversed, setReversed] = useState(false)
  const [found, setFound] = useState<ReadonlySet<number>>(() => new Set())
  const { completeTask } = p
  const split = useMemo(() => splitFromAlignment(CF65, A, B, offset, reversed), [offset, reversed])

  useEffect(() => {
    if (split.valid && reversed && !found.has(offset)) setFound((f) => new Set(f).add(offset))
  }, [split.valid, reversed, offset, found])
  useEffect(() => {
    if (found.size >= 3) completeTask('try3')
  }, [found.size, completeTask])

  return (
    <div className="flex flex-col gap-3 text-sm text-stone-300" data-testid="align-view">
      <p>
        CF from the 65 indicators is two cycles of 13 letters, <Mono>{cycleText(A)}</Mono> and{' '}
        <Mono>{cycleText(B)}</Mono>. CF is C followed by F, and each of them only swaps letters, so C swaps every letter of
        one cycle with a letter of the other. Write the second cycle under the first: each column is a guess at a swap of
        C, and F follows from C and CF. Slide the lower cycle, and try reading it backwards.
      </p>
      <CycleAlign
        a={A}
        b={B}
        offset={offset}
        reversed={reversed}
        onChange={(o, r) => {
          setOffset(o)
          setReversed(r)
        }}
        testId="cf-align"
      />
      <div aria-live="polite" data-testid="cf-split" data-valid={String(split.valid)} className="flex flex-col gap-1">
        <p className="font-mono break-all">C = {formatCycles(split.x)}</p>
        <p className="font-mono break-all">F = {formatCycles(split.y)}</p>
        <p className={split.valid ? 'text-emerald-200' : 'text-red-200'}>
          {split.valid
            ? 'C and F both consist of swaps only: a possible split of CF.'
            : 'This F does not only swap letters, so no machine position could produce it.'}
        </p>
      </div>
      <p data-testid="cf-found" data-count={found.size}>
        Possible splits found: {found.size} of {SPLITS}.
        {found.size >= SPLITS
          ? ' That is every one: a pair of 13-cycles splits in exactly 13 ways.'
          : found.size
            ? ' Keep sliding.'
            : ' Try both directions.'}
      </p>
      <p>
        Rejewski&apos;s theorem 4 says why: if a swap of C joins two letters of the two cycles, then their neighbours, one to
        the right and the other to the left, are joined too. So one known swap fixes all 13.
      </p>
    </div>
  )
}
