/**
 * Chapter iv-capstone's ITEM_UI. Every prompt prints what its day needs (machine model, reflector, rotor set, the ring
 * convention, the indicator procedure of the era); the Answers are the workbenches, so each tool runs inside the answer
 * area on the day being asked about. The worked examples (L2 on another day, L3 on this one) are built from their own
 * instance only. L1 hints are text in the prompt as well as the stage highlight.
 */

import { useState, type JSX, type ReactNode } from 'react'
import type { MachineConfig } from '../../contracts/core'
import type { AnswerProps, CheckResult, HintLevel, ItemUiMap } from '../../contracts/lesson'
import { cycles } from '../../engine'
import { Mono, SubmitButton } from '../../lesson'
import { WIDGETS, type WidgetProps } from '../../lesson/kinds/widgets'
import { MachinePanel } from '../../machine-ui'
import { useMachineApi } from '../../state/activeMachine'
import { CribStrip, CycleDiagram, MenuGraph } from '../../viz'
import { menuFromEdges } from '../../crypto/menu'
import { crashes } from '../../crypto'
import {
  BRITISH_CABLES,
  MAX_LINKS,
  POLISH_CABLES,
  PRODUCTS,
  britishWalkthrough,
  cribLinks,
  cribOffset,
  polishWalkthrough,
  productsOf,
  readIntercept,
  type BritishKeyInstance,
  type BritishMenuInstance,
  type MenuAnswer,
  type PolishCardInstance,
  type PolishKeyInstance,
  type ReadInstance,
} from './gates'
import {
  BritishWorkbench,
  CribPlacer,
  EMPTY_KEY,
  IndicatorList,
  KeyFields,
  MenuBuilder,
  NO_PAIRING,
  PairingTool,
  PolishWorkbench,
  keyFromLists,
  type KeyLists,
  type Pairing,
} from './scenes'

const ring = (l: string): string => String(l.charCodeAt(0) - 64).padStart(2, '0')
const cablesText = (plugs: readonly string[]): string => plugs.map((p) => `${p[0]}–${p[1]}`).join(' ') || 'none'

function Hint({ level, children }: { level: HintLevel; children: ReactNode }): JSX.Element | null {
  if (level < 1) return null
  return (
    <p className="rounded-md border border-sky-800/60 bg-sky-950/30 p-2 text-sky-100" data-testid="item-hint">
      {children}
    </p>
  )
}

/** The procedure of the doubled-indicator era, as every Polish prompt states it. */
function PolishDayFacts(): JSX.Element {
  return (
    <p>
      A day of the doubled-indicator era: Enigma I with reflector A, rotors I, II and III in an order you must find, ring settings
      01 01 01 (the catalogue assumes them), 6 cables. Every operator typed his three-letter message key twice at the day&apos;s
      ground setting (the indicator), then set his rotors to the message key and typed the body.
    </p>
  )
}

/** The wartime procedure, as every British prompt states it. */
function BritishDayFacts({ orders }: { orders?: readonly (readonly string[])[] }): JSX.Element {
  return (
    <p>
      A wartime day: Enigma I with reflector B, three of rotors I–V
      {orders ? (
        <>
          {' '}
          (intelligence narrows the wheel order to {orders.map((o) => o.join('-')).join(', ')})
        </>
      ) : null}
      , ring settings 01 01 01 (worked out separately), {BRITISH_CABLES} cables. The operator chose a start position and sent it in
      clear, then his message key enciphered once there, then the body typed from the message key.
    </p>
  )
}

// ---------------------------------------------------------------------------
// polish-card
// ---------------------------------------------------------------------------

function PolishCardAnswer({ instance, disabled, submit }: AnswerProps<PolishCardInstance, string>): JSX.Element {
  const [pairing, setPairing] = useState<Pairing>(NO_PAIRING)
  const [fields, setFields] = useState<KeyLists>(EMPTY_KEY)
  const ready = keyFromLists(fields) !== 'AD: BE: CF:'
  return (
    <form
      className="flex flex-col gap-3"
      data-testid="polish-card-answer"
      onSubmit={(e) => {
        e.preventDefault()
        if (ready && !disabled) submit(keyFromLists(fields))
      }}
    >
      <IndicatorList indicators={instance.indicators} />
      <PairingTool indicators={instance.indicators} pairing={pairing} onPairing={setPairing} view="table" disabled={disabled} />
      <KeyFields value={fields} onChange={setFields} disabled={disabled} />
      <div>
        <SubmitButton form disabled={disabled || !ready} />
      </div>
    </form>
  )
}

const polishCard = {
  Prompt: ({ hintLevel }: { instance: PolishCardInstance; hintLevel: HintLevel }) => (
    <div className="flex flex-col gap-2">
      <PolishDayFacts />
      <p>
        Below are the day&apos;s 70 indicators. Read the products AD, BE and CF off them, walk each one&apos;s cycles, and type the
        characteristic the catalogue files this day under: each product&apos;s cycle lengths, longest first. Choose which letters
        pair up, and the tool prints each product as a table (a letter above, its image below); counting the cycles is yours.
      </p>
      <Hint level={hintLevel}>
        AD pairs each indicator&apos;s 1st letter with its 4th (the same key letter, enciphered three presses apart), BE the 2nd with
        the 5th, CF the 3rd with the 6th. In a table, start at A and follow A → its image → … until you are back at A: that is one
        cycle. Carry on from the first letter not yet used. A letter sent to itself is a cycle of 1; every letter is in exactly one
        cycle, so the lengths add up to 26.
      </Hint>
    </div>
  ),
  Answer: PolishCardAnswer,
  Worked: ({ instance, solution }: { instance: PolishCardInstance; solution: string }) => {
    const p = productsOf(instance.indicators)
    return (
      <div className="flex flex-col gap-1 text-sm" data-testid="worked-polish-card">
        <p>
          From that day&apos;s indicators (the first is <Mono>{instance.indicators[0]}</Mono>):
        </p>
        <ul className="flex flex-col gap-1">
          {PRODUCTS.map((n) => (
            <li key={n}>
              <Mono>{n}</Mono> ={' '}
              <Mono className="break-all">
                {cycles(p[n])
                  .map((c) => `(${c.map((x) => String.fromCharCode(97 + x)).join('')})`)
                  .join('')}
              </Mono>
            </li>
          ))}
        </ul>
        <p>
          Sorted, longest first: <Mono>{solution}</Mono>.
        </p>
      </div>
    )
  },
  Feedback: ({ result }: { instance: PolishCardInstance; answer: string; result: CheckResult }) => {
    const rb = result.rollback
    if (rb.kind !== 'cycles') return null
    return (
      <div className="flex flex-col gap-2" data-testid="cycles-feedback">
        <p>
          The product&apos;s cycles, with the one to walk again highlighted. Its lengths, longest first: <Mono>{rb.expected.join(' ')}</Mono>
          ; you typed <Mono>{rb.got.join(' ') || '—'}</Mono>.
        </p>
        <CycleDiagram perm={rb.perm} highlightCycle={rb.cycle} testId="cycles-rollback" />
      </div>
    )
  },
}

// ---------------------------------------------------------------------------
// polish-key and polish-plugs
// ---------------------------------------------------------------------------

function PolishKeyAnswer({ instance, disabled, submit }: AnswerProps<PolishKeyInstance, MachineConfig>): JSX.Element {
  const api = useMachineApi()
  return (
    <div className="flex flex-col gap-3" data-testid="set-machine">
      <PolishWorkbench
        store={api}
        indicators={instance.indicators}
        message={instance.message}
        known={instance.known}
        maxCables={instance.maxPlugs}
        given={instance.ground ? { ground: instance.ground } : undefined}
        keys
      />
      <div>
        <SubmitButton disabled={disabled} onClick={() => submit(api.getState().snapshot())} />
      </div>
    </div>
  )
}

function PolishWorked({ instance }: { instance: PolishKeyInstance; solution: MachineConfig }): JSX.Element {
  const w = polishWalkthrough(instance.seed)
  return (
    <ol className="flex list-decimal flex-col gap-1 pl-5 text-sm" data-testid="worked-polish-key">
      <li>
        The indicators give the characteristic <Mono>{w.characteristic}</Mono>.
      </li>
      <li>
        Its card lists {w.card.length} settings. Read with no cables, the indicators agree best at one of them:{' '}
        {w.card.map((c) => `${c.setting} ${c.pairs} of ${w.total}`).join('; ')}.
      </li>
      <li>
        At {w.rotors.join('-')} with ground setting <Mono>{w.ground}</Mono>, the best single cable each time gives{' '}
        <Mono>{cablesText(w.cables)}</Mono>, and then every indicator reads as a key typed twice.
      </li>
      <li>
        The first indicator <Mono>{w.firstIndicator}</Mono> reads <Mono>{w.firstRead}</Mono>: the message key is{' '}
        <Mono>{w.messageKey}</Mono>, not the ground setting.
      </li>
      <li>
        Rotors {w.rotors.join('-')}, windows <Mono>{w.messageKey}</Mono>, those cables: the message reads{' '}
        <Mono className="break-all">{w.plain}</Mono>.
      </li>
    </ol>
  )
}

const polishKey = {
  Prompt: ({ instance, hintLevel }: { instance: PolishKeyInstance; hintLevel: HintLevel }) => (
    <div className="flex flex-col gap-2">
      <PolishDayFacts />
      <p>
        Break this day and read its first message: the first indicator belongs to it, and its body is below. The message is known to
        begin <Mono>{instance.known}</Mono>. Set the rotor order, turn the windows to the message key and plug in the cables, so that
        the preview reads the message; then submit. The keyboard is locked and the lamps are hidden: the preview deciphers without a
        key press. A wrong submission brings a fresh day.
      </p>
      <Hint level={hintLevel}>
        Work down the steps. The characteristic leads to a card of a few settings; the right one is where the indicators, deciphered
        with no cables, agree far more often than chance. There, add the best single cable until every indicator reads as a key typed
        twice. The first indicator then gives the message key: put it in the windows.
      </Hint>
    </div>
  ),
  Answer: PolishKeyAnswer,
  Worked: PolishWorked,
}

const polishPlugs = {
  Prompt: ({ instance, hintLevel }: { instance: PolishKeyInstance; hintLevel: HintLevel }) => (
    <div className="flex flex-col gap-2">
      <PolishDayFacts />
      <p>
        The rotor order and the day&apos;s ground setting <Mono>{instance.ground}</Mono> are known, and the windows already stand at the
        first message&apos;s key. Only the {POLISH_CABLES} cables are missing. Plug in cables until every indicator deciphered at the
        ground setting reads as a key typed twice and the message reads (it begins <Mono>{instance.known}</Mono>); then submit.
      </p>
      <Hint level={hintLevel}>
        A cable that joins the right letters makes more letter pairs of the indicators agree; the machine can try every single cable
        for you. Add the best one, and repeat.
      </Hint>
    </div>
  ),
  Answer: PolishKeyAnswer,
  Worked: PolishWorked,
}

// ---------------------------------------------------------------------------
// british-menu
// ---------------------------------------------------------------------------

function BritishMenuAnswer({ instance, disabled, submit }: AnswerProps<BritishMenuInstance, MenuAnswer>): JSX.Element {
  const [offset, setOffset] = useState(instance.window[0])
  const [chosen, setChosen] = useState<readonly number[]>([])
  return (
    <div className="flex flex-col gap-3" data-testid="british-menu-answer">
      <CribPlacer cipher={instance.cipher} crib={instance.crib} window={instance.window} offset={offset} onOffset={setOffset} disabled={disabled} />
      <MenuBuilder
        cipher={instance.cipher}
        crib={instance.crib}
        offset={offset}
        chosen={chosen}
        onChosen={(c) => setChosen(c)}
        disabled={disabled}
      />
      <div>
        <SubmitButton
          disabled={disabled || chosen.length === 0}
          onClick={() => submit({ offset, links: [...chosen].sort((a, b) => a - b) })}
        >
          Submit the crib position and this menu
        </SubmitButton>
      </div>
    </div>
  )
}

const britishMenu = {
  Prompt: ({ instance, hintLevel }: { instance: BritishMenuInstance; hintLevel: HintLevel }) => (
    <div className="flex flex-col gap-2">
      <BritishDayFacts />
      <p>
        The crib <Mono>{instance.crib}</Mono> stands in this body at an offset from {instance.window[0]} to {instance.window[1]} (the
        offset counts the body&apos;s letters before the crib; the strip numbers them). Slide it to the offset where no crib letter
        sits under the same cipher letter, then build a menu for the bombe from its links: at most {MAX_LINKS} links, in one connected
        piece, with at least 2 closures. The middle rotor does not move during the crib, so every link may be used.
      </p>
      <p className="font-mono break-all text-stone-300" data-testid="intercept-body">
        {instance.cipher}
      </p>
      <Hint level={hintLevel}>
        Enigma never enciphers a letter to itself: an offset where some crib letter stands under the same cipher letter is
        impossible, and only one offset in the range survives. For the menu, keep the piece of links that holds the loops, whole: its
        branches narrow the bombe&apos;s stops once the diagonal board joins the letters. Leave out links in other pieces, and if the
        piece has more than {MAX_LINKS} links, drop links that hang off it (a letter with a single link).
      </Hint>
    </div>
  ),
  Answer: BritishMenuAnswer,
  Worked: ({ instance, solution }: { instance: BritishMenuInstance; solution: MenuAnswer }) => {
    const offsets = Array.from({ length: instance.window[1] - instance.window[0] + 1 }, (_, k) => instance.window[0] + k)
    const edges = cribLinks(instance.cipher, instance.crib, solution.offset).filter((e) => solution.links.includes(e.pos))
    return (
      <div className="flex flex-col gap-2 text-sm" data-testid="worked-british-menu">
        <p>
          Crib <Mono>{instance.crib}</Mono>, offsets {instance.window[0]} to {instance.window[1]}:{' '}
          {offsets.map((o) => `offset ${o}: ${crashes(instance.cipher, instance.crib, o).length} crash(es)`).join('; ')}. Only offset{' '}
          {cribOffset(instance)} is free of crashes.
        </p>
        <MenuGraph menu={menuFromEdges(edges)} testId="worked-menu" />
        <p>
          Links {solution.links.join(', ')}: the piece that holds the loops, branches included, at most {MAX_LINKS} links.
        </p>
      </div>
    )
  },
  Feedback: ({ instance, answer, result }: { instance: BritishMenuInstance; answer: MenuAnswer; result: CheckResult }) => {
    const rb = result.rollback
    if (rb.kind === 'crib') {
      return (
        <div className="flex flex-col gap-2" data-testid="crib-feedback" data-offset={rb.offset}>
          <p>Your crib position, with its crashes in red:</p>
          <CribStrip cipher={instance.cipher} crib={instance.crib} offset={rb.offset} readOnly testId="crib-rollback" />
        </div>
      )
    }
    if (rb.kind === 'menu') {
      const edges = cribLinks(instance.cipher, instance.crib, Number(answer?.offset) || 0).filter((e) =>
        (answer?.links ?? []).includes(e.pos),
      )
      return (
        <div className="flex flex-col gap-2" data-testid="menu-feedback" data-break-at={rb.breakAt}>
          <p>Your menu:</p>
          <MenuGraph menu={menuFromEdges(edges)} highlightLoop={rb.loop} testId="menu-rollback" />
        </div>
      )
    }
    return null
  },
}

// ---------------------------------------------------------------------------
// british-key and british-plugs
// ---------------------------------------------------------------------------

function BritishKeyAnswer({ instance, disabled, submit }: AnswerProps<BritishKeyInstance, MachineConfig>): JSX.Element {
  const api = useMachineApi()
  return (
    <div className="flex flex-col gap-3" data-testid="set-machine">
      <BritishWorkbench
        store={api}
        crib={instance.crib}
        message={instance.message}
        window={instance.window}
        orders={instance.orders}
        start={instance.start}
        encKey={instance.encKey}
        maxCables={instance.maxPlugs}
        given={instance.stop && instance.offset !== undefined ? { offset: instance.offset, stop: instance.stop } : undefined}
        keys
      />
      <div>
        <SubmitButton disabled={disabled} onClick={() => submit(api.getState().snapshot())} />
      </div>
    </div>
  )
}

function BritishWorked({ instance }: { instance: BritishKeyInstance; solution: MachineConfig }): JSX.Element {
  const w = britishWalkthrough(instance.seed)
  return (
    <ol className="flex list-decimal flex-col gap-1 pl-5 text-sm" data-testid="worked-british-key">
      <li>
        The crib <Mono>{w.crib}</Mono> is crash-free only at offset {w.offset}. Menu: links{' '}
        {w.links.map((e) => e.pos).join(', ')} ({w.closures} closures).
      </li>
      <li>
        The bombe stops on {w.rotors.join('-')} with the drums at <Mono>{w.stop.positions}</Mono>, test letter {w.stop.testLetter}{' '}
        steckered to {w.stop.stecker.toLowerCase()}; the checking machine confirms it and derives <Mono>{cablesText(w.checked)}</Mono>.
      </li>
      <li>
        With those rotors and cables, the enciphered key <Mono>{w.encKey}</Mono> read at the start position <Mono>{w.start}</Mono> gives
        the message key <Mono>{w.messageKey}</Mono> (the drums at <Mono>{w.stop.positions}</Mono> stood {w.offset} letters into the
        body).
      </li>
      <li>
        The partial decrypt shows where words fail; the cables {w.read.length ? <Mono>{cablesText(w.read)}</Mono> : 'none'} complete
        it: <Mono className="break-all">{w.plain}</Mono>.
      </li>
    </ol>
  )
}

const britishKey = {
  Prompt: ({ instance, hintLevel }: { instance: BritishKeyInstance; hintLevel: HintLevel }) => (
    <div className="flex flex-col gap-2">
      <BritishDayFacts orders={instance.orders} />
      <p>
        Break this day and read the intercept: its crib <Mono>{instance.crib}</Mono> stands in the body at an offset from{' '}
        {instance.window[0]} to {instance.window[1]} (the body&apos;s letters before the crib). Set the rotor order, turn the windows
        to the message key and plug in the cables, so that the preview reads the body; then submit. The keyboard is locked and the
        lamps are hidden: the preview deciphers without a key press. A wrong submission brings a fresh day.
      </p>
      <Hint level={hintLevel}>
        Place the crib, build the menu from the whole piece of links that holds the loops (up to {MAX_LINKS} links: a longer menu
        stops less often), and run the bombe on the three orders. Check the stops: only a true stop gives consistent cables. Use it;
        the enciphered key at the start position then reads as the message key. Turn the windows to it, and fix the words that almost
        read with one more cable each.
      </Hint>
    </div>
  ),
  Answer: BritishKeyAnswer,
  Worked: BritishWorked,
}

const britishPlugs = {
  Prompt: ({ hintLevel }: { instance: BritishKeyInstance; hintLevel: HintLevel }) => (
    <div className="flex flex-col gap-2">
      <BritishDayFacts />
      <p>
        The rotor order and the message key are known (the windows show it). Only the cables are missing: at most {BRITISH_CABLES}.
        Check the bombe&apos;s stop along the crib, plug in the cables it gives, then find the rest from the words that almost read;
        submit when the body reads.
      </p>
      <Hint level={hintLevel}>
        Where the preview shows a letter X and the word needs p, try the cable X–p: it is right whenever the cipher letter there has no
        cable of its own.
      </Hint>
    </div>
  ),
  Answer: BritishKeyAnswer,
  Worked: BritishWorked,
}

// ---------------------------------------------------------------------------
// read-intercepts
// ---------------------------------------------------------------------------

function ReadAnswer(props: AnswerProps<ReadInstance, string>): JSX.Element {
  const api = useMachineApi()
  const Letters = WIDGETS.letters
  return (
    <div className="flex flex-col gap-3" data-testid="read-answer">
      <MachinePanel store={api} show={{ keyboard: true, lamps: true, rotors: true, tape: true }} />
      <p className="text-sm text-stone-300">The first 10 letters of the plaintext:</p>
      <Letters {...(props as unknown as WidgetProps)} />
    </div>
  )
}

const readIntercepts = {
  Prompt: ({ instance, hintLevel }: { instance: ReadInstance; hintLevel: HintLevel }) => {
    const k = instance.key
    return (
      <div className="flex flex-col gap-2">
        <p>
          A broken day key: Enigma I, reflector B, rotors <Mono>{k.rotors.join(' ')}</Mono> (left to right), rings{' '}
          <Mono>{[...k.rings].map(ring).join(' ')}</Mono>, cables <Mono>{cablesText(k.plugboard)}</Mono>. The machine below is set
          to it: only the windows are yours to turn, and the keyboard works.
        </p>
        <p>
          Three intercepts of that day, sent the wartime way: the start position in clear, the message key enciphered once at it, then
          the body typed from the message key. Read intercept {instance.which + 1}: type the first 10 letters of its plaintext.
        </p>
        <table className="font-mono text-sm" data-testid="intercepts">
          <thead>
            <tr className="text-left text-xs text-stone-400">
              <th className="pr-3 font-sans font-normal">Intercept</th>
              <th className="pr-3 font-sans font-normal">Start</th>
              <th className="pr-3 font-sans font-normal">Key</th>
              <th className="font-sans font-normal">Body</th>
            </tr>
          </thead>
          <tbody>
            {instance.intercepts.map((m, j) => (
              <tr key={j} className={j === instance.which ? 'text-amber-200' : 'text-stone-300'}>
                <td className="pr-3">{j + 1}</td>
                <td className="pr-3">{m.start}</td>
                <td className="pr-3">{m.encKey}</td>
                <td className="break-all">{m.body}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <Hint level={hintLevel}>
          Two settings, in order: turn the windows to the start position and type the three key letters; the lamps give the message
          key. Then turn the windows to the message key and type the body.
        </Hint>
      </div>
    )
  },
  Answer: ReadAnswer,
  Worked: ({ instance, solution }: { instance: ReadInstance; solution: string }) => {
    const m = instance.intercepts[instance.which]!
    const { messageKey } = readIntercept(instance.key, m)
    return (
      <p className="text-sm" data-testid="worked-read">
        Intercept {instance.which + 1}: at the start position <Mono>{m.start}</Mono>, typing <Mono>{m.encKey}</Mono> lights{' '}
        <Mono>{messageKey}</Mono>, the message key. From <Mono>{messageKey}</Mono> the body begins <Mono>{solution}</Mono>.
      </p>
    )
  },
}

export const ITEM_UI: ItemUiMap = {
  'polish-card': polishCard,
  'polish-key': polishKey,
  'polish-plugs': polishPlugs,
  'british-menu': britishMenu,
  'british-key': britishKey,
  'british-plugs': britishPlugs,
  'read-intercepts': readIntercepts,
}
