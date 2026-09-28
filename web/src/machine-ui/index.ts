/**
 * The DOM machine (PLAN §3.10), built by PR 04. Every component takes an optional `store`, which
 * defaults to useMachineApi() (the provider's store, else the default useMachineStore). All of them
 * render from the same (last press, playback t), so the lamps, trace, windows, announcer and stage
 * cannot drift apart (§2.5).
 */

export { MachinePanel } from './MachinePanel'
export { Keyboard } from './Keyboard'
export { Lampboard } from './Lampboard'
export { RotorControls } from './RotorControls'
export { ModelSelect } from './ModelSelect'
export { PlugboardEditor } from './PlugboardEditor'
export { TracePanel } from './TracePanel'
export { PlaybackBar } from './PlaybackBar'
export { Announcer } from './Announcer'
export { PaperTape } from './PaperTape'
export { PermTable } from './PermTable'
export { encodeConfig, decodeConfig } from './urlCodec'
