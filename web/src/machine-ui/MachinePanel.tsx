/**
 * The DOM machine (PLAN §3.10): composes the panels named in `show` around one machine store
 * (`store`, else the provider's, else the default). The Announcer is always present when keys or
 * lamps are shown, since it is the accessible reading of the lamp. With `rings` shown the trace also
 * shows each rotor's offset and core contacts.
 *
 * Layout: the machine itself (settings, lamps, keys, plugboard) first; the trace, playback and tape
 * beside it on wide screens and below it on narrow ones.
 */

import type { JSX } from 'react'
import type { SceneDef } from '../contracts/lesson'
import type { MachineStoreHook } from '../contracts/machine'
import { AnnouncerFor } from './Announcer'
import { useApi } from './hooks'
import { Keyboard } from './Keyboard'
import { Lampboard } from './Lampboard'
import { ModelSelect } from './ModelSelect'
import { PaperTape } from './PaperTape'
import { PlaybackBar } from './PlaybackBar'
import { PlugboardEditor } from './PlugboardEditor'
import { RotorControls } from './RotorControls'
import { TracePanelFor } from './TracePanel'

export function MachinePanel(p: { store?: MachineStoreHook; show: NonNullable<SceneDef['panels']> }): JSX.Element {
  const store = useApi(p.store)
  const { show } = p
  const side = show.trace || show.playback || show.tape
  const card = 'rounded-xl border border-stone-800 bg-stone-900/40 p-3'

  const machine = (
    <div className="flex min-w-0 flex-col gap-4">
      {show.model ? (
        <div className="flex justify-center">
          <ModelSelect store={store} />
        </div>
      ) : null}
      {show.rotors || show.rings ? <RotorControls store={store} rings={!!show.rings} rotorSelect={!!show.rotors} /> : null}
      {show.lamps ? <Lampboard store={store} /> : null}
      {show.keyboard || show.lamps ? <AnnouncerFor store={store} /> : null}
      {show.keyboard ? <Keyboard store={store} /> : null}
      {show.plugboard ? (
        <div className={card}>
          <PlugboardEditor store={store} />
        </div>
      ) : null}
    </div>
  )

  return (
    <div data-testid="machine-panel" className={`grid min-w-0 gap-6 ${side ? 'lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]' : ''}`}>
      {machine}
      {side ? (
        <div className="flex min-w-0 flex-col gap-4">
          {show.playback ? <PlaybackBar /> : null}
          {show.trace ? (
            <div className={card}>
              <TracePanelFor store={store} showOffsets={!!show.rings} />
            </div>
          ) : null}
          {show.tape ? (
            <div className={card}>
              <PaperTape store={store} />
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
