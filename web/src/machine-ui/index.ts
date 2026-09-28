/**
 * STUB (02 → 04). The DOM machine (PLAN §3.10) with the exact props 04 implements. `store` defaults
 * to useMachineApi(). Only the keyboard and lampboard work here (26 key buttons that call
 * store.pressKey, with the §3.12 test IDs); the other panels render a minimal placeholder.
 * Plain createElement (no JSX) keeps this file a .ts module, as the contract names it.
 */

import { createElement as h, type JSX, type ReactNode } from 'react'
import { useStore } from 'zustand'
import { useShallow } from 'zustand/react/shallow'
import type { SceneDef } from '../contracts/lesson'
import { isLit, type MachineStoreHook } from '../contracts/machine'
import {
  KEYBOARD_ROWS,
  normalizeConfig,
  positionsToString,
  validateConfig,
  type Letter,
  type MachineConfig,
  type ModelName,
  type ReflectorName,
  type RotorName,
} from '../engine'
import type { Sym } from '../lib/symbols'
import { useMachineApi } from '../state/activeMachine'
import { usePlaybackStore } from '../state/playbackStore'

function useApi(store?: MachineStoreHook): MachineStoreHook {
  const fallback = useMachineApi()
  return store ?? fallback
}

const stub = (name: string, text: ReactNode = null): JSX.Element =>
  h('div', { 'data-stub': name, className: 'font-mono text-xs text-stone-500' }, text ?? `${name} (on its way)`)

export function MachinePanel(p: { store?: MachineStoreHook; show: NonNullable<SceneDef['panels']> }): JSX.Element {
  const { show } = p
  return h(
    'div',
    { className: 'flex flex-col gap-3', 'data-stub': 'MachinePanel' },
    show.lamps ? h(Lampboard, { store: p.store }) : null,
    show.keyboard ? h(Keyboard, { store: p.store }) : null,
    show.rotors || show.rings ? h(RotorControls, { store: p.store, rings: show.rings }) : null,
    show.model ? h(ModelSelect, { store: p.store }) : null,
    show.plugboard ? h(PlugboardEditor, { store: p.store }) : null,
    show.trace ? h(TracePanel, {}) : null,
    show.playback ? h(PlaybackBar) : null,
    show.tape ? h(PaperTape, { store: p.store }) : null,
  )
}

/** key-A…Z in QWERTZ rows. */
export function Keyboard(p: { store?: MachineStoreHook }): JSX.Element {
  const api = useApi(p.store)
  const locked = useStore(api, (s) => !!s.locks.keyboard)
  return h(
    'div',
    { className: 'flex flex-col items-center gap-1', 'aria-label': 'Keyboard' },
    KEYBOARD_ROWS.map((row, r) =>
      h(
        'div',
        { key: r, className: 'flex gap-1' },
        row.map((letter) =>
          h(
            'button',
            {
              key: letter,
              type: 'button',
              'data-testid': `key-${letter}`,
              disabled: locked,
              className: 'h-8 w-8 rounded border border-stone-600 font-mono text-sm disabled:opacity-40',
              onClick: () => {
                if (!api.getState().locks.keyboard) api.getState().pressKey(letter)
              },
            },
            letter,
          ),
        ),
      ),
    ),
  )
}

/** lamp-A…Z; lit via playback. */
export function Lampboard(p: { store?: MachineStoreHook }): JSX.Element {
  const api = useApi(p.store)
  const { lamp, hidden } = useStore(
    api,
    useShallow((s) => ({ lamp: s.last?.output ?? null, hidden: !!s.locks.lampsHidden })),
  )
  const lit = usePlaybackStore((s) => s.source === 'machine' && isLit(s.t, s.hops))
  return h(
    'div',
    { className: 'flex flex-col items-center gap-1', 'aria-label': 'Lampboard' },
    KEYBOARD_ROWS.map((row, r) =>
      h(
        'div',
        { key: r, className: 'flex gap-1' },
        row.map((letter) => {
          const on = !hidden && lit && lamp === letter
          return h(
            'span',
            {
              key: letter,
              'data-testid': `lamp-${letter}`,
              'data-lit': String(on),
              className: `flex h-8 w-8 items-center justify-center rounded-full font-mono text-sm ${on ? 'bg-amber-300 text-stone-950' : 'bg-stone-800'}`,
            },
            letter,
          )
        }),
      ),
    ),
  )
}

export function RotorControls(p: { store?: MachineStoreHook; rings?: boolean; rotorSelect?: boolean }): JSX.Element {
  const windows = useStore(useApi(p.store), (s) => positionsToString(s.machine))
  return stub('RotorControls', `Windows ${windows}`)
}

export function ModelSelect(p: { store?: MachineStoreHook }): JSX.Element {
  const model = useStore(useApi(p.store), (s) => s.machine.config.model)
  return stub('ModelSelect', `Model ${model}`)
}

export function PlugboardEditor(p: { store?: MachineStoreHook; maxPairs?: number }): JSX.Element {
  const plugs = useStore(useApi(p.store), (s) => s.machine.config.plugboard.join(' '))
  return stub('PlugboardEditor', `Plugs ${plugs || 'none'}`)
}

export function TracePanel(_p: { source?: 'machine' | 'toy'; compact?: boolean; showOffsets?: boolean }): JSX.Element {
  return stub('TracePanel')
}

export function PlaybackBar(): JSX.Element {
  return stub('PlaybackBar')
}

export function Announcer(): JSX.Element {
  return h('div', { role: 'status', 'aria-live': 'polite', 'data-testid': 'announcer', className: 'sr-only' })
}

export function PaperTape(p: { store?: MachineStoreHook }): JSX.Element {
  const { input, output } = useStore(useApi(p.store), useShallow((s) => ({ input: s.input, output: s.output })))
  return stub('PaperTape', `${input || '—'} → ${output || '—'}`)
}

export function PermTable(p: {
  perm: readonly (number | null)[]
  n?: number
  sym?: Sym
  label?: ReactNode
  highlight?: readonly number[]
  editable?: boolean
  onEdit?(i: number, v: number | null): void
  testId?: string
}): JSX.Element {
  const letters = p.perm.map((v) => (v === null ? '?' : String.fromCharCode(65 + v))).join('')
  return h('div', { 'data-stub': 'PermTable', 'data-testid': p.testId, className: 'font-mono text-xs' }, p.label, ' ', letters)
}

const pad2 = (n: number) => String(n).padStart(2, '0')

/** e.g. 'I.B.I-II-III.01-01-01.ADU.AV-BS' */
export function encodeConfig(c: MachineConfig): string {
  const rings = c.rings.map((r) => pad2(r.charCodeAt(0) - 64)).join('-')
  return [c.model, c.reflector, c.rotors.join('-'), rings, c.positions.join(''), c.plugboard.join('-')].join('.')
}

/** null if invalid. */
export function decodeConfig(s: string): MachineConfig | null {
  const parts = s.split('.')
  if (parts.length !== 6) return null
  const [model, reflector, rotors, rings, positions, plugs] = parts as [string, string, string, string, string, string]
  const ringLetters = rings.split('-').map((r) => {
    const n = Number(r)
    return Number.isInteger(n) && n >= 1 && n <= 26 && /^\d\d$/.test(r) ? (String.fromCharCode(64 + n) as Letter) : '?'
  })
  const input = {
    model: model as ModelName,
    reflector: reflector as ReflectorName,
    rotors: rotors.split('-') as RotorName[],
    rings: ringLetters,
    positions,
    plugboard: plugs === '' ? [] : plugs.split('-'),
  }
  return validateConfig(input).length === 0 ? normalizeConfig(input) : null
}
