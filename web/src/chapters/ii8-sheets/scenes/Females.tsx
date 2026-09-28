/**
 * females: part of a day's traffic after the procedure change (the starting position in clear, then the doubled key
 * enciphered from it), each repeat at a distance of three marked. The Play reveal lays out the first female's sheet
 * and counts its holes: the share of positions where a female can occur. The bet's truth is that share over the 26
 * sheets of the day's wheel order, from the kit's femaleSheet (constant: the day is fixed).
 */

import { useEffect, useMemo, useRef, type JSX } from 'react'
import type { SceneProps } from '../../../contracts/lesson'
import { SHEET_SIZE } from '../../../crypto'
import { Mono, useRevealFired } from '../../../lesson'
import { createRng, shuffle } from '../../../lib/rng'
import { femalePlaces, holeShare, idx, plainMessages, sceneDay, sheetFor, surviveChoice, type Message } from '../gates'

const CELL = 8

/** One sheet's 26 × 26 square (middle position down, right position across); holes lit. */
export function SheetSquare({ sheet, label, testId }: { sheet: readonly boolean[]; label: string; testId: string }): JSX.Element {
  let d = ''
  let holes = 0
  for (let y = 0; y < 26; y++) {
    for (let x = 0; x < 26; x++) {
      if (!sheet[y * SHEET_SIZE + x]) continue
      holes++
      d += `M${x * CELL + 1} ${y * CELL + 1}h${CELL - 2}v${CELL - 2}h${2 - CELL}z`
    }
  }
  return (
    <figure className="m-0 flex flex-col gap-1" data-testid={testId} data-holes={holes}>
      <svg viewBox={`0 0 ${26 * CELL} ${26 * CELL}`} className="block w-full max-w-60" role="img" aria-label={label}>
        <rect width={26 * CELL} height={26 * CELL} className="fill-stone-800" />
        <path d={d} fill="var(--sym-signal)" />
      </svg>
    </figure>
  )
}

/** An indicator with its repeats at a distance of three marked. */
export function Indicator({ m }: { m: Message }): JSX.Element {
  const places = femalePlaces(m.indicator)
  return (
    <span className="font-mono">
      {[...m.indicator].map((c, k) => {
        const hit = places.includes(k % 3)
        return (
          <span key={k} data-female={hit ? 'true' : undefined} className={hit ? 'rounded bg-amber-300 px-px text-stone-950' : ''}>
            {c}
          </span>
        )
      })}
    </span>
  )
}

export function FemalesView(p: SceneProps): JSX.Element {
  const fired = useRevealFired('survive')
  const d = useMemo(sceneDay, [])
  const traffic = useMemo(() => shuffle(createRng(1509), [...d.females, ...plainMessages(d, 16)]), [d])
  const females = traffic.filter((m) => femalePlaces(m.indicator).length > 0).length
  const first = d.females[0]!
  const sheet = useMemo(() => sheetFor(d.day.rotors, (idx(first.setting[0]!) - idx(d.day.rings[0]!) + 26) % 26), [d, first])
  const share = useMemo(() => (fired ? holeShare(d.day.rotors) : null), [fired, d])
  const holes = useMemo(() => {
    let n = 0
    for (let y = 0; y < 26; y++) for (let x = 0; x < 26; x++) if (sheet[y * SHEET_SIZE + x]) n++
    return n
  }, [sheet])
  const resolved = useRef(false)
  const { bet } = p

  useEffect(() => {
    if (share === null || resolved.current) return
    resolved.current = true
    bet('survive').resolve(surviveChoice(share))
  }, [share, bet])

  return (
    <div className="flex flex-col gap-3 text-sm text-stone-300" data-testid="females-view">
      <p>
        Each message now opens with the operator&apos;s own starting position, in clear, then the doubled message key
        enciphered from it. Part of one day&apos;s traffic: the {females} messages whose letter repeats three places on (a
        female, marked) and {traffic.length - females} without one.
      </p>
      <ul className="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3" data-testid="females-traffic" data-females={females}>
        {traffic.map((m, k) => (
          <li key={k} className="flex gap-2">
            <Mono className="text-stone-400">{m.setting}</Mono>
            <Indicator m={m} />
          </li>
        ))}
      </ul>
      <p>
        A female at places 1 and 4 can only happen at a starting position where the machine&apos;s first and fourth key presses
        send some letter to the same place. Zygalski punched a sheet for every wheel order and left rotor position: one hole
        for each middle and right position where that can happen.
      </p>
      {fired && share !== null ? (
        <div className="flex flex-col gap-2" data-testid="females-sheet" aria-live="polite">
          <SheetSquare sheet={sheet} testId="females-sheet-square" label={`A sheet with ${holes} holes out of 676 positions`} />
          <p data-testid="females-share" data-share={share.toFixed(3)}>
            This sheet (wheel order <Mono>{d.day.rotors.join('-')}</Mono>, the first female&apos;s left rotor) has {holes} holes
            among its 676 positions, {Math.round((holes / 676) * 100)}%. Over all 26 sheets of the wheel order,{' '}
            {(share * 100).toFixed(1)}% of the positions are holes: each female keeps about that share of the candidates.
          </p>
        </div>
      ) : null}
    </div>
  )
}
