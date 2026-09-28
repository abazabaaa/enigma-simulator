/**
 * Chapter iii10-menus's ITEM_UI. Prompts print what each instance needs (the crib's columns with the turnover
 * flagged, the menu's links, the scrambler tables); the menu rollbacks draw a read-only MenuGraph of the learner's
 * menu or of the instance, with the loop in question highlighted. L1 hints are text in the Prompt (no stage).
 */

import { useState, type JSX, type ReactNode } from 'react'
import type { Letter } from '../../contracts/core'
import type { AnswerProps, CheckResult, HintLevel, ItemUiMap } from '../../contracts/lesson'
import { closures, menuFromCrib, menuFromEdges, type MenuEdge } from '../../crypto/menu'
import { LetterTable, Mono, SubmitButton } from '../../lesson'
import { MenuGraph } from '../../viz'
import {
  MAX_LINKS,
  flagged,
  loopChain,
  pieces,
  type ClosuresInstance,
  type LoopReturnInstance,
  type MenuInstance,
} from './gates'
import { CribColumns, LinkDrawing, LinkList } from './scenes'

function Hint({ level, children }: { level: HintLevel; children: ReactNode }): JSX.Element | null {
  if (level < 1) return null
  return (
    <p className="rounded-md border border-sky-800/60 bg-sky-950/30 p-2 text-sky-100" data-testid="item-hint">
      {children}
    </p>
  )
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

// ---------------------------------------------------------------------------
// build-menu
// ---------------------------------------------------------------------------

function BuildMenuPrompt({ instance, hintLevel }: { instance: MenuInstance; hintLevel: HintLevel }): JSX.Element {
  return (
    <div className="flex flex-col gap-2">
      <p>
        A crib of {instance.crib.length} letters placed under its cipher text (no crash). Each column is a link: plaintext letter and
        cipher letter, joined by the machine at that key press, numbered by its crib position. The middle rotor stepped at the
        key press of position {instance.turnover}: the links from {instance.turnover} on (marked !) were made with a different middle
        rotor.
      </p>
      <CribColumns crib={instance.crib} cipher={instance.cipher} turnover={instance.turnover} />
      <p>
        Build a menu for the bombe: at least 2 closures, all in one connected piece, at most {MAX_LINKS} links, and no link from
        position {instance.turnover} on. The counter under the graph shows the closures of the links you have added.
      </p>
      <Hint level={hintLevel}>
        Start from a letter that appears in several links before the turnover, add the links that close loops around it, and drop
        any link that leaves the menu in two pieces.
      </Hint>
    </div>
  )
}

function BuildMenuAnswer({ instance, disabled, submit }: AnswerProps<MenuInstance, number[]>): JSX.Element {
  const [chosen, setChosen] = useState<readonly number[]>([])
  const all = menuFromCrib(instance.cipher, instance.crib, 0)
  const menu = menuFromEdges(all.edges.filter((e) => chosen.includes(e.pos)))
  return (
    <div className="flex flex-col gap-3" data-testid="build-menu-answer" data-chosen={[...chosen].sort((a, b) => a - b).join(',')}>
      <MenuGraph
        menu={menu}
        available={all.edges}
        warnings={flagged(instance)}
        onAddEdge={disabled ? undefined : (pos) => setChosen((c) => (c.includes(pos) ? c : [...c, pos]))}
        onRemoveEdge={disabled ? undefined : (pos) => setChosen((c) => c.filter((x) => x !== pos))}
        testId="build-menu-graph"
      />
      <p className="text-sm text-stone-300">
        Your menu: {plural(menu.edges.length, 'link')}.
      </p>
      <div>
        <SubmitButton disabled={disabled || chosen.length === 0} onClick={() => submit([...chosen].sort((a, b) => a - b))}>
          Submit this menu
        </SubmitButton>
      </div>
    </div>
  )
}

function MenuSummary({ edges }: { edges: readonly MenuEdge[] }): JSX.Element {
  const m = menuFromEdges(edges)
  const c = closures(m)
  return (
    <p>
      {plural(edges.length, 'link')}, {plural(m.letters.length, 'letter')}, {plural(pieces(edges).length, 'piece')}: {edges.length} −{' '}
      {m.letters.length} + {pieces(edges).length} = {c} closure{c === 1 ? '' : 's'}.
    </p>
  )
}

const buildMenu = {
  Prompt: BuildMenuPrompt,
  Answer: BuildMenuAnswer,
  Worked: ({ instance, solution }: { instance: MenuInstance; solution: number[] }) => {
    const edges = menuFromCrib(instance.cipher, instance.crib, 0).edges.filter((e) => solution.includes(e.pos))
    return (
      <div className="flex flex-col gap-2 text-sm">
        <p>
          Crib <Mono>{instance.crib}</Mono>, turnover at position {instance.turnover}. Only links 1 to {instance.turnover - 1} may be
          used. Among them, keep the piece with the loops and drop the links that hang off it:
        </p>
        <MenuGraph menu={menuFromEdges(edges)} testId="build-menu-worked" />
        <MenuSummary edges={edges} />
        <p>Links {solution.join(', ')}.</p>
      </div>
    )
  },
  Feedback: ({ instance, answer, result }: { instance: MenuInstance; answer: number[]; result: CheckResult }) => {
    if (result.rollback.kind !== 'menu') return null
    const all = menuFromCrib(instance.cipher, instance.crib, 0).edges
    const edges = all.filter((e) => Array.isArray(answer) && answer.includes(e.pos))
    return (
      <div className="flex flex-col gap-2" data-testid="menu-feedback" data-break-at={result.rollback.breakAt}>
        <p>Your menu, with the links from position {instance.turnover} on flagged:</p>
        <MenuGraph
          menu={menuFromEdges(edges)}
          warnings={flagged(instance)}
          highlightLoop={result.rollback.loop}
          testId="menu-rollback"
        />
        {edges.length ? <MenuSummary edges={edges} /> : null}
      </div>
    )
  },
}

// ---------------------------------------------------------------------------
// closures
// ---------------------------------------------------------------------------

const closuresUi = {
  Prompt: ({ instance, hintLevel }: { instance: ClosuresInstance; hintLevel: HintLevel }) => (
    <div className="flex flex-col gap-2">
      <p>A menu of {instance.edges.length} links. How many closures does it have?</p>
      <LinkList edges={instance.edges} />
      <LinkDrawing edges={instance.edges} label="The menu's links drawn as a graph" />
      <Hint level={hintLevel}>
        Closures = links − letters + pieces. Count the links, the different letters, and the pieces that are not joined to each
        other.
      </Hint>
    </div>
  ),
  Worked: ({ instance, solution }: { instance: ClosuresInstance; solution: number[] }) => (
    <div className="flex flex-col gap-2 text-sm">
      <LinkList edges={instance.edges} />
      <MenuSummary edges={instance.edges} />
      <p>Answer: {solution[0]}.</p>
    </div>
  ),
  Feedback: ({ instance, result }: { instance: ClosuresInstance; answer: number[]; result: CheckResult }) =>
    result.rollback.kind === 'menu' ? (
      <div className="flex flex-col gap-2" data-testid="menu-feedback" data-break-at={result.rollback.breakAt}>
        <MenuGraph menu={menuFromEdges(instance.edges)} highlightLoop={result.rollback.loop} testId="menu-rollback" />
        <MenuSummary edges={instance.edges} />
      </div>
    ) : null,
}

// ---------------------------------------------------------------------------
// loop-return
// ---------------------------------------------------------------------------

const loopText = (loop: readonly Letter[]) => [...loop, loop[0]!].join(' → ')

function LoopTables({ instance }: { instance: LoopReturnInstance }): JSX.Element {
  const k = instance.loop.length
  return (
    <div className="flex flex-col gap-2">
      {instance.tables.map((t, j) => (
        <LetterTable
          key={j}
          images={t}
          n={8}
          label={`Link ${j + 1}, ${instance.loop[j]}–${instance.loop[(j + 1) % k]}: a partner above becomes the partner below`}
        />
      ))}
    </div>
  )
}

function Chain({ instance }: { instance: LoopReturnInstance }): JSX.Element {
  const chain = loopChain(instance)
  const k = instance.loop.length
  return (
    <ol className="flex flex-wrap gap-x-3 gap-y-1 font-mono text-sm" aria-label="The partners round the loop">
      {chain.map((w, j) => (
        <li key={j}>
          {instance.loop[j % k]}↔{w}
          {j < k ? ' →' : ''}
        </li>
      ))}
    </ol>
  )
}

const loopReturn = {
  Prompt: ({ instance, hintLevel }: { instance: LoopReturnInstance; hintLevel: HintLevel }) => (
    <div className="flex flex-col gap-2">
      <p>
        A toy menu on the letters A–H with one loop, <Mono>{loopText(instance.loop)}</Mono>. Each link&apos;s scrambler pairs the eight
        letters (its table is below). Assume <Mono>{instance.loop[0]}</Mono> is steckered to <Mono>{instance.hypothesis}</Mono>. Going
        once round the loop in this order, which letter comes back as {instance.loop[0]}&apos;s partner?
      </p>
      <LoopTables instance={instance} />
      <Hint level={hintLevel}>
        Look up {instance.hypothesis} in the top row of link 1: the letter under it is {instance.loop[1]}&apos;s partner. Look that
        letter up in link 2, and so on, through every link in order.
      </Hint>
    </div>
  ),
  Worked: ({ instance, solution }: { instance: LoopReturnInstance; solution: Letter }) => (
    <div className="flex flex-col gap-2 text-sm">
      <p>
        Loop <Mono>{loopText(instance.loop)}</Mono>, assuming {instance.loop[0]}↔{instance.hypothesis}: one table per link.
      </p>
      <Chain instance={instance} />
      <p>
        {instance.loop[0]} comes back with partner <Mono>{solution}</Mono>
        {solution === instance.hypothesis ? ': no contradiction.' : `, not ${instance.hypothesis}: a contradiction.`}
      </p>
    </div>
  ),
  Feedback: ({ instance, answer, result }: { instance: LoopReturnInstance; answer: Letter; result: CheckResult }) => {
    if (result.rollback.kind !== 'menu') return null
    const k = instance.loop.length
    const edges = instance.loop.map((a, j) => ({ a, b: instance.loop[(j + 1) % k]!, pos: j + 1 }))
    return (
      <div className="flex flex-col gap-2" data-testid="menu-feedback" data-break-at={result.rollback.breakAt}>
        <MenuGraph menu={menuFromEdges(edges)} highlightLoop={result.rollback.loop} testId="menu-rollback" />
        <p>
          You answered <Mono>{String(answer)}</Mono>. The partners link by link:
        </p>
        <Chain instance={instance} />
      </div>
    )
  },
}

export const ITEM_UI: ItemUiMap = {
  'build-menu': buildMenu,
  closures: closuresUi,
  'loop-return': loopReturn,
}
