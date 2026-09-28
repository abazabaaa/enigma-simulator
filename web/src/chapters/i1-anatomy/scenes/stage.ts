/**
 * While a reveal is bound to one key, the stage's keys are switched off (its directive becomes non-interactive), so
 * only the scene's own key buttons can press, and they offer that one key. The override goes through the same
 * item-stage store a gate item uses; the scene's stage (and its focus) is otherwise unchanged.
 */

import { useEffect } from 'react'
import type { StagePresetId } from '../../../contracts/stage'
import { useItemStage } from '../../../lesson/ui/itemStage'

export function useStageKeysOff(preset: StagePresetId, off: boolean): void {
  const set = useItemStage((s) => s.set)
  useEffect(() => {
    set({ stage: off ? { preset, with: { interactive: false } } : undefined })
  }, [preset, off, set])
  useEffect(() => () => set({ stage: undefined }), [set])
}
