/**
 * Hidden engine dev page (#/engine): the machine as plain text. Type A–Z on the keyboard to
 * press keys. Exists so Playwright can drive the engine end-to-end in a real browser.
 */

import { useLayoutEffect } from 'react'
import { KEYBOARD_ROWS, MODELS, positionsToString, type MachineConfigInput, type TraceStep } from '../engine'
import { useMachineStore } from '../state/machineStore'

const PRESETS: Record<string, MachineConfigInput> = {
  'Default key (I II III, AAA)': { model: 'I', reflector: 'B', rotors: ['I', 'II', 'III'], rings: 'AAA', positions: 'AAA' },
  'Barbarossa 1941 (at BLA)': {
    model: 'I',
    reflector: 'B',
    rotors: ['II', 'IV', 'V'],
    rings: 'BUL',
    positions: 'BLA',
    plugboard: 'AV BS CG DL FU HZ IN KM OW RX',
  },
  'Scharnhorst 1943 (M3)': {
    model: 'M3',
    reflector: 'B',
    rotors: ['III', 'VI', 'VIII'],
    rings: 'AHM',
    positions: 'UZV',
    plugboard: 'AN EZ HK IJ LR MQ OT PV SW UX',
  },
  'U-264 1942 (M4)': {
    model: 'M4',
    reflector: 'B-thin',
    rotors: ['Beta', 'II', 'IV', 'I'],
    rings: 'AAAV',
    positions: 'VJNA',
    plugboard: 'AT BL DF GJ HM NW OP QY RZ VX',
  },
}

function isEditable(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
}

function describeStep(t: TraceStep): string {
  const arrow = `${t.input} → ${t.output}`
  switch (t.kind) {
    case 'plugboard':
      return `${t.stage.padEnd(17)} ${arrow}${t.plugged ? '  (plugged)' : ''}`
    case 'rotor':
      return `${t.stage.padEnd(17)} ${arrow}  ${t.rotor.padEnd(5)} window ${t.window} ring ${String.fromCharCode(65 + t.ring)} offset ${String(t.offset).padStart(2)}  core ${t.entryContact}→${t.exitContact}`
    case 'reflector':
      return `${t.stage.padEnd(17)} ${arrow}  UKW ${t.reflector}`
    default:
      return `${t.stage.padEnd(17)} ${arrow}`
  }
}

export function EngineDevPage() {
  const { machine, input, output, last, pressKey, setConfig, reset } = useMachineStore()
  const { config } = machine
  const lamp = last?.output ?? null

  // Layout effect (not useEffect) so the listener is attached in the same task as the first
  // commit: once the page is visible, key presses are guaranteed to be heard.
  useLayoutEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.repeat || isEditable(e.target)) return
      if (!/^[a-z]$/i.test(e.key)) return
      e.preventDefault()
      pressKey(e.key)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [pressKey])

  const stepped = last
    ? (['left', 'middle', 'right'] as const).filter((k) => last.stepping.stepped[k]).join(', ') +
      (last.stepping.doubleStep ? ' (double step)' : '')
    : ''

  return (
    <main className="mx-auto max-w-4xl space-y-6 px-4 py-8 font-mono text-sm">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg text-amber-300">Engine dev page</h1>
        <div className="flex gap-2">
          <select
            aria-label="Preset"
            className="rounded border border-stone-700 bg-stone-900 px-2 py-1"
            defaultValue=""
            onChange={(e) => {
              const preset = PRESETS[e.target.value]
              if (preset) setConfig(preset)
              e.target.blur()
            }}
          >
            <option value="" disabled>
              Load preset…
            </option>
            {Object.keys(PRESETS).map((name) => (
              <option key={name}>{name}</option>
            ))}
          </select>
          <button
            type="button"
            className="rounded border border-stone-700 px-3 py-1 hover:bg-stone-800"
            onClick={(e) => {
              reset()
              e.currentTarget.blur()
            }}
          >
            Reset
          </button>
        </div>
      </header>

      <p className="text-stone-500">Type A–Z to press keys. The machine state is also exposed as window.__enigma.</p>

      <section aria-label="Configuration" className="rounded border border-stone-800 p-3">
        <dl data-testid="config" className="grid grid-cols-[8rem_1fr] gap-x-4 gap-y-1">
          <dt className="text-stone-500">model</dt>
          <dd data-testid="config-model">{MODELS[config.model].label}</dd>
          <dt className="text-stone-500">reflector</dt>
          <dd data-testid="config-reflector">{config.reflector}</dd>
          <dt className="text-stone-500">rotors (L→R)</dt>
          <dd data-testid="config-rotors">{config.rotors.join(' ')}</dd>
          <dt className="text-stone-500">rings</dt>
          <dd data-testid="config-rings">{config.rings.join('')}</dd>
          <dt className="text-stone-500">start</dt>
          <dd data-testid="config-start">{config.positions.join('')}</dd>
          <dt className="text-stone-500">plugboard</dt>
          <dd data-testid="config-plugboard">{config.plugboard.join(' ') || '—'}</dd>
        </dl>
      </section>

      <section aria-label="Rotor windows" className="flex items-center gap-4">
        <span className="text-stone-500">windows</span>
        <span data-testid="positions" className="rounded bg-stone-100 px-3 py-1 text-2xl tracking-[0.4em] text-stone-900">
          {positionsToString(machine)}
        </span>
        <span data-testid="stepping" className="text-stone-500">
          {stepped && `stepped: ${stepped}`}
        </span>
      </section>

      <section aria-label="Lampboard" className="space-y-2">
        <div className="flex items-center gap-3">
          <span className="text-stone-500">lamp</span>
          <span data-testid="lamp" className="text-2xl text-amber-300">
            {lamp ?? ''}
          </span>
        </div>
        <div className="inline-flex flex-col items-center gap-2 rounded bg-stone-900 p-3">
          {KEYBOARD_ROWS.map((row) => (
            <div key={row.join('')} className="flex gap-2">
              {row.map((l) => (
                <span
                  key={l}
                  data-testid={`lamp-${l}`}
                  data-lit={l === lamp}
                  className={`flex h-8 w-8 items-center justify-center rounded-full border ${
                    l === lamp
                      ? 'border-amber-300 bg-amber-300 text-stone-900 shadow-[0_0_12px_var(--color-amber-300)]'
                      : 'border-stone-700 text-stone-500'
                  }`}
                >
                  {l}
                </span>
              ))}
            </div>
          ))}
        </div>
      </section>

      <section aria-label="Tape" className="grid gap-1">
        <div>
          <span className="inline-block w-16 text-stone-500">in</span>
          <span data-testid="input-tape" className="break-all">
            {input}
          </span>
        </div>
        <div>
          <span className="inline-block w-16 text-stone-500">out</span>
          <span data-testid="output-tape" className="break-all text-amber-200">
            {output}
          </span>
        </div>
      </section>

      <section aria-label="Signal trace">
        <h2 className="mb-2 text-stone-500">trace of the last key press</h2>
        <pre data-testid="trace" className="overflow-x-auto rounded border border-stone-800 p-3 leading-relaxed">
          {last ? last.trace.map(describeStep).join('\n') : '(press a key)'}
        </pre>
      </section>
    </main>
  )
}
