/**
 * catalogue: the Run reveal builds Rejewski's catalogue live (getCatalogue('A') in a worker, with its progress), then
 * shows how the 105,456 settings spread over their characteristics (CatalogueHistogram) and the card of the day the
 * cyclometer measured. The bet's truth is the card size of the median day (the catalogue is fixed, so it is constant).
 */

import { useEffect, useMemo, useRef, type JSX } from 'react'
import type { SceneProps } from '../../../contracts/lesson'
import { catalogueStats } from '../../../crypto/catalogue'
import { Mono, useRevealFired } from '../../../lesson'
import { CatalogueHistogram } from '../../../viz'
import {
  CATALOGUE_SETTINGS,
  CYCLE_TYPES,
  CYCLO_CHARACTERISTIC,
  CYCLO_DAY,
  POSSIBLE_CHARACTERISTICS,
  bucketChoice,
  weightedMedian,
} from '../gates'
import { useCatalogue } from './useCatalogue'

const fmt = (n: number) => n.toLocaleString('en-US')

export function CatalogueView(p: SceneProps): JSX.Element {
  const fired = useRevealFired('bucket')
  const cat = useCatalogue(fired)
  const stats = useMemo(() => (cat.catalogue ? catalogueStats(cat.catalogue) : null), [cat.catalogue])
  const median = stats ? weightedMedian(stats.histogram) : null
  const card = cat.catalogue?.get(CYCLO_CHARACTERISTIC) ?? null
  const resolved = useRef(false)
  const { completeTask, bet } = p

  useEffect(() => {
    if (median === null) return
    completeTask('built')
    if (!resolved.current) {
      resolved.current = true
      bet('bucket').resolve(bucketChoice(median))
    }
  }, [median, completeTask, bet])

  const state = !fired ? 'idle' : cat.failed ? 'failed' : stats ? 'done' : 'building'
  return (
    <div className="flex flex-col gap-3 text-sm text-stone-300" data-testid="catalogue-view">
      <p>
        The catalogue has a card for every rotor order and ground setting: 6 orders × 17,576 ={' '}
        {fmt(CATALOGUE_SETTINGS)} settings, each filed under its characteristic. Each product can have {CYCLE_TYPES} cycle
        types (thirteen split into pairs), so {CYCLE_TYPES}³ = {fmt(POSSIBLE_CHARACTERISTICS)} characteristics are possible,
        about 1.03 million: almost ten for every setting.
      </p>
      <p className="text-stone-400">
        Every ring stays at <Mono>01</Mono> in this chapter. A card cannot tell a ring setting from a rotor position, so the
        rings need a separate step, which this chapter leaves out.
      </p>
      <div
        className="flex flex-wrap items-center gap-3"
        data-testid="catalogue-build"
        data-state={state}
        data-ms={cat.ms ?? undefined}
      >
        <progress
          max={cat.total}
          value={stats ? cat.total : cat.done}
          aria-label="Settings filed"
          className="w-56 max-w-full accent-amber-400"
        />
        <span className="font-mono" aria-live="polite" data-testid="catalogue-progress">
          {state === 'idle'
            ? 'Bet first, then run the build.'
            : state === 'failed'
              ? 'The build failed.'
              : `${fmt(stats ? cat.total : cat.done)} of ${fmt(cat.total)} settings filed`}
        </span>
      </div>
      {stats && median !== null ? (
        <div className="flex flex-col gap-3" data-testid="catalogue-result" aria-live="polite">
          <p data-testid="catalogue-summary" data-distinct={stats.distinct} data-median={median}>
            Only {fmt(stats.distinct)} of the {fmt(POSSIBLE_CHARACTERISTICS)} possible characteristics occur, and the settings
            crowd onto the big cards: half of all days fall on a card of {fmt(median)} settings or more.
          </p>
          <CatalogueHistogram stats={stats} highlight={card ? String(card.length) : undefined} />
          {card ? (
            <div className="flex flex-col gap-1" data-testid="catalogue-day-card" data-count={card.length}>
              <p>
                The day from the cyclometer, ground setting <Mono>{CYCLO_DAY.positions.join('')}</Mono>, has the key{' '}
                <Mono>{CYCLO_CHARACTERISTIC}</Mono>. Its card lists {card.length} settings (marked in the histogram):
              </p>
              <ol className="flex flex-wrap gap-1 font-mono">
                {card.map((e, k) => (
                  <li key={k} className="rounded border border-stone-700 px-1.5 text-stone-200">
                    {e.rotors.join('-')} · {e.positions}
                  </li>
                ))}
              </ol>
              <p>Only a test decrypt tells them apart: that is the gate&apos;s work.</p>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
