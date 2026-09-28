import type { ItemKey } from '../../../contracts/core'
import type { AnswerProps, ItemLogic } from '../../../contracts/lesson'

/** What the gate passes a generic widget: the Answer props plus the item's logic and key. */
export interface WidgetProps<I = any, A = any> extends AnswerProps<I, A> {
  readonly logic: ItemLogic
  readonly itemKey: ItemKey
}
