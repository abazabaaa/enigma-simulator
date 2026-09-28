import { type JSX } from 'react'
import type { LockKey } from '../../../contracts/machine'
import { createMachine, encipher } from '../../../engine'
import { MachinePanel } from '../../../machine-ui'
import { useMachine, useMachineApi } from '../../../state/activeMachine'
import { SubmitButton } from '../../ui/controls'
import type { WidgetProps } from './types'

interface SetMachineInstance {
  readonly unlocked: readonly LockKey[]
  readonly trial: 'locked' | 'preview'
  readonly maxPlugs?: number
  /** For trial 'preview': the ciphertext whose live decrypt is shown. */
  readonly message?: string
}

/**
 * Set the machine with its own controls, then Submit: the answer is store.snapshot(). The keyboard is locked
 * and the lamps hidden (the item's setup), so no trial press is possible. With trial 'preview' a live decrypt
 * of the item's message follows the settings; it never presses a key.
 */
export function SetMachineAnswer({
  instance,
  disabled,
  submit,
}: WidgetProps<SetMachineInstance, unknown>): JSX.Element {
  const api = useMachineApi()
  const unlocked = instance.unlocked
  const config = useMachine((s) => s.machine.config)
  const windows = useMachine((s) => s.machine.positions.map((p) => String.fromCharCode(65 + p)).join(''))
  let preview: string | null = null
  if (instance.trial === 'preview' && instance.message) {
    try {
      preview = encipher(createMachine({ ...config, positions: windows }), instance.message).output
    } catch {
      preview = null
    }
  }
  return (
    <div className="flex flex-col gap-3" data-testid="set-machine">
      <p className="text-sm text-stone-400">
        The keyboard is locked and the lamps are hidden: set the machine
        {unlocked.length ? ` (${unlocked.join(', ')})` : ''}, then submit.
        {instance.maxPlugs !== undefined
          ? ` At most ${instance.maxPlugs} cable${instance.maxPlugs === 1 ? '' : 's'}.`
          : ''}
      </p>
      <MachinePanel
        store={api}
        show={{
          keyboard: true,
          lamps: true,
          rotors: unlocked.includes('positions') || unlocked.includes('rotors'),
          rings: unlocked.includes('rings'),
          plugboard: unlocked.includes('plugboard'),
          model: unlocked.includes('model'),
        }}
      />
      <p className="font-mono text-xs text-stone-400" data-testid="set-machine-state">
        Windows {windows} · rings {config.rings.map((r) => String(r.charCodeAt(0) - 64).padStart(2, '0')).join(' ')} ·
        plugs {config.plugboard.join(' ') || 'none'}
      </p>
      {preview !== null ? (
        <div className="rounded-md border border-stone-700 p-2" data-testid="trial-preview">
          <div className="text-xs text-stone-400">Decrypt preview with these settings</div>
          <div className="font-mono break-all text-stone-200">{preview}</div>
        </div>
      ) : null}
      <div>
        <SubmitButton disabled={disabled} onClick={() => submit(api.getState().snapshot())} />
      </div>
    </div>
  )
}
