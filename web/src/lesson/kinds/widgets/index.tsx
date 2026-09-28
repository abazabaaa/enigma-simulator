/** The generic Answer widget for each item kind (PLAN §3.6); custom items bring their own Answer. */

import type { ComponentType, JSX } from 'react'
import type { ItemKind } from '../../../contracts/lesson'
import { CodeItem } from '../../../code/CodeItem'
import { codeTaskOf } from '..'
import { ChainAnswer } from './ChainAnswer'
import { ChoiceAnswer } from './ChoiceAnswer'
import { GhostPickAnswer } from './GhostPickAnswer'
import { LetterAnswer } from './LetterAnswer'
import { LettersAnswer } from './LettersAnswer'
import { NumbersAnswer } from './NumbersAnswer'
import { OrderAnswer } from './OrderAnswer'
import { SetMachineAnswer } from './SetMachineAnswer'
import type { WidgetProps } from './types'

export type { WidgetProps } from './types'
export { partName } from './GhostPickAnswer'

function CodeWidget(p: WidgetProps<{ seed: number }, never>): JSX.Element {
  const task = codeTaskOf(p.logic)
  if (!task) return <p className="text-sm text-red-300">This code item has no task.</p>
  return <CodeItem task={task} instance={p.instance} itemKey={p.itemKey} disabled={p.disabled} submit={p.submit as never} />
}

export const WIDGETS: Readonly<Record<Exclude<ItemKind, 'custom'>, ComponentType<WidgetProps>>> = {
  letter: LetterAnswer,
  letters: LettersAnswer,
  numbers: NumbersAnswer,
  choice: ChoiceAnswer,
  order: OrderAnswer,
  chain: ChainAnswer,
  'set-machine': SetMachineAnswer,
  'ghost-pick': GhostPickAnswer,
  code: CodeWidget,
}
