/**
 * #/lab/stage?preset=<id>&locks=<csv>&model=<I|M3|M4>&ghost=demo&toy=6|8 (PLAN §2.3; owner 02)
 * Every stage preset on a demo machine, for 04, 06 and 11 and the reviewers:
 *  - preset: a StagePresetId (default overview), rendered through StageHost;
 *  - locks: MachineLocks keys applied to the default store (e.g. keyboard,positions,hold);
 *  - model: loads a demo configuration of that model (default I);
 *  - ghost=demo: a fixed ghost path whose hop 4 (the left rotor) is the first to go wrong;
 *  - toy=6|8: the toy store gets randomToy(seed 1) and the stage source becomes 'toy'.
 */

import { useEffect, useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { isLit, type LockKey, type MachineLocks } from '../contracts/machine'
import { STAGE_PRESET_IDS, isStagePresetId, type Ghost, type PathHop, type StageRef } from '../contracts/stage'
import { LETTERS, createMachine, encodeLetter, type Letter, type MachineConfigInput, type ModelName } from '../engine'
import { formatSci, keyspace } from '../lib/keyspace'
import { createRng } from '../lib/rng'
import { randomToy, toyLetters } from '../lib/toy'
import { MachinePanel } from '../machine-ui'
import { hrefFor, useRoute } from '../router'
import { StageHost } from '../stage/StageHost'
import { useMachineStore } from '../state/machineStore'
import { usePlaybackStore } from '../state/playbackStore'
import { useStageStore } from '../state/stageStore'
import { useToyStore } from '../state/toyStore'

export const DEMO_CONFIGS: Readonly<Record<ModelName, MachineConfigInput>> = {
  I: { model: 'I', reflector: 'B', rotors: ['I', 'II', 'III'], rings: 'AAA', positions: 'ADU', plugboard: 'AV BS CG' },
  M3: {
    model: 'M3',
    reflector: 'B',
    rotors: ['III', 'VI', 'VIII'],
    rings: 'AHM',
    positions: 'UZV',
    plugboard: 'AN EZ HK',
  },
  M4: {
    model: 'M4',
    reflector: 'B-thin',
    rotors: ['Beta', 'II', 'IV', 'I'],
    rings: 'AAAV',
    positions: 'VJNA',
    plugboard: 'AT BL DF',
  },
}

const LOCK_KEYS: readonly (keyof MachineLocks)[] = [
  'model',
  'rotors',
  'reflector',
  'rings',
  'positions',
  'plugboard',
  'keyboard',
  'hold',
  'lampsHidden',
] satisfies readonly (LockKey | 'hold' | 'lampsHidden')[]

export function parseLocks(csv: string | undefined): { locks: MachineLocks; unknown: string[] } {
  const locks: Partial<Record<keyof MachineLocks, boolean>> = {}
  const unknown: string[] = []
  for (const k of (csv ?? '').split(',').map((s) => s.trim()).filter(Boolean)) {
    if ((LOCK_KEYS as readonly string[]).includes(k)) locks[k as keyof MachineLocks] = true
    else unknown.push(k)
  }
  return { locks, unknown }
}

/** The hop where demoGhost leaves the reference (the left rotor, forward). */
export const DEMO_DIVERGE_AT = 4

/**
 * A fixed learner path for key A on the default key that leaves the reference at hop DEMO_DIVERGE_AT: it follows
 * the reference up to that hop's entry, that hop's output is 7 letters past the reference's (so it is wrong there,
 * not one hop later), and from then on each hop continues from the ghost's own previous output.
 */
export function demoGhost(): Ghost {
  const reference = encodeLetter(createMachine(DEMO_CONFIGS.I), 'A').trace
  const hops: PathHop[] = []
  reference.forEach((hop, i) => {
    if (i < DEMO_DIVERGE_AT) {
      hops.push(hop)
      return
    }
    const inputIndex = i === DEMO_DIVERGE_AT ? hop.inputIndex : hops[i - 1]!.outputIndex
    const outputIndex = ((i === DEMO_DIVERGE_AT ? hop.outputIndex : inputIndex) + 7) % 26
    hops.push({ ...hop, input: LETTERS[inputIndex]!, output: LETTERS[outputIndex]!, inputIndex, outputIndex })
  })
  return { hops, divergeAt: DEMO_DIVERGE_AT }
}

export function StageLabPage() {
  const { query } = useRoute()
  const preset = query.preset ?? 'overview'
  const validPreset = isStagePresetId(preset) ? preset : 'overview'
  const model: ModelName = query.model === 'M3' || query.model === 'M4' ? query.model : 'I'
  const toyN = query.toy === '6' ? 6 : query.toy === '8' ? 8 : null
  const { locks, unknown } = useMemo(() => parseLocks(query.locks), [query.locks])
  const lockKey = JSON.stringify(locks)
  const ghost = query.ghost === 'demo'

  // Demo machine and locks (the setup path ignores locks). Locks are released on leaving the page.
  useEffect(() => {
    const store = useMachineStore.getState()
    store.setLocks({})
    store.setConfig(DEMO_CONFIGS[model])
    store.setLocks(JSON.parse(lockKey) as MachineLocks)
    return () => useMachineStore.getState().setLocks({})
  }, [model, lockKey])

  useEffect(() => {
    if (toyN) useToyStore.getState().setSpec(randomToy(createRng(1), toyN, toyN === 6 ? 2 : 3))
  }, [toyN])

  useEffect(() => {
    useStageStore.getState().setGhost(ghost ? demoGhost() : null)
    return () => useStageStore.getState().setGhost(null)
  }, [ghost])

  const stage: StageRef = toyN ? { preset: validPreset, with: { source: 'toy' } } : validPreset
  const link = (p: string) => hrefFor('/lab/stage', { ...query, preset: p })

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-stone-100">Stage lab</h1>
        <p data-testid="keyspace" className="font-mono text-sm text-stone-400">
          Key space (5 rotors, 10 plugs): {formatSci(keyspace())}
        </p>
        {preset !== validPreset || unknown.length ? (
          <p role="alert" className="text-sm text-amber-300">
            {preset !== validPreset ? `Unknown preset "${preset}", showing overview. ` : ''}
            {unknown.length ? `Unknown locks ignored: ${unknown.join(', ')}.` : ''}
          </p>
        ) : null}
      </header>

      <nav aria-label="Stage presets" className="flex flex-wrap gap-2 font-mono text-xs">
        {STAGE_PRESET_IDS.map((id) => (
          <a
            key={id}
            href={link(id)}
            data-testid={`preset-${id}`}
            aria-current={id === validPreset ? 'page' : undefined}
            className={`rounded border px-2 py-1 ${
              id === validPreset ? 'border-amber-400 text-amber-300' : 'border-stone-700 text-stone-400'
            }`}
          >
            {id}
          </a>
        ))}
      </nav>

      <StageHost stage={stage} className="min-h-48" />

      {toyN ? (
        <ToyKeys n={toyN} />
      ) : (
        <MachinePanel show={{ keyboard: true, lamps: true, rotors: true, trace: true, playback: true }} />
      )}
    </main>
  )
}

function ToyKeys({ n }: { n: 6 | 8 }) {
  const locked = useMachineStore((s) => !!s.locks.keyboard)
  const { lamp } = useToyStore(useShallow((s) => ({ lamp: s.last?.lamp ?? null })))
  // Like every lamp view, the readout waits for the playback clock to reach the lamp.
  const lit = usePlaybackStore((s) => s.source === 'toy' && isLit(s.t, s.hops))
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex gap-1" aria-label="Toy keyboard">
        {toyLetters(n).map((letter: Letter) => (
          <button
            key={letter}
            type="button"
            data-testid={`toy-key-${letter}`}
            disabled={locked}
            onClick={() => useToyStore.getState().press(letter)}
            className="h-8 w-8 rounded border border-stone-600 font-mono text-sm disabled:opacity-40"
          >
            {letter}
          </button>
        ))}
      </div>
      <p data-testid="toy-lamp" className="font-mono text-sm text-stone-400">
        Toy lamp: {(lit && lamp) || '—'}
      </p>
    </div>
  )
}
