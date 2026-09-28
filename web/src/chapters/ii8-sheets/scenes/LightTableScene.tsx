/**
 * light-table: the day's females, each with its sheet (the kit's femaleSheet for the wheel order and the female's left
 * rotor), laid on the light table shifted by its starting position. The learner stacks sheets until at most two
 * settings are lit. The Play reveal then scales up: how many females until one setting of all 105,456 survives, with
 * the share of holes measured on the day's sheets (the bet's truth, constant for the fixed day).
 */

import { useEffect, useMemo, useRef, useState, type JSX } from 'react'
import type { SceneProps } from '../../../contracts/lesson'
import { Mono, useRevealFired } from '../../../lesson'
import { LightTable } from '../../../viz'
import {
  ALL_SETTINGS,
  alignedSheets,
  expected,
  femalesNeeded,
  holeShare,
  idx,
  litSettings,
  sceneDay,
  settingName,
} from '../gates'
import { Indicator } from './Females'

const fmt = (x: number) => (x >= 10 ? Math.round(x).toLocaleString('en-US') : x.toFixed(1))

export function LightTableView(p: SceneProps): JSX.Element {
  const fired = useRevealFired('isolate')
  const d = useMemo(sceneDay, [])
  const sheets = useMemo(() => alignedSheets(d.day.rotors, idx(d.day.rings[0]!), d.females), [d])
  const [shown, setShown] = useState(0)
  const first = d.females[0]!
  const lit = useMemo(() => litSettings(first, sheets, shown), [first, sheets, shown])
  const share = useMemo(() => (fired ? holeShare(d.day.rotors) : null), [fired, d])
  const needed = share === null ? null : femalesNeeded(ALL_SETTINGS, share)
  const resolved = useRef(false)
  const { completeTask, bet } = p

  const converged = shown >= 1 && lit.length <= 2
  useEffect(() => {
    if (converged) completeTask('converge')
  }, [converged, completeTask])

  useEffect(() => {
    if (needed === null || resolved.current) return
    resolved.current = true
    bet('isolate').resolve(String(needed))
  }, [needed, bet])

  return (
    <div className="flex flex-col gap-3 text-sm text-stone-300" data-testid="light-table-view">
      <p>
        The day&apos;s wheel order <Mono>{d.day.rotors.join('-')}</Mono> and left ring are taken as known here: these are its
        right sheets. Each of the {d.females.length} females below has its sheet; the first lies still, and every later one is
        shifted by how far its starting position is from the first. Where every stacked sheet has a hole, light passes: at the
        day&apos;s middle and right ring settings, and at impostors that stacking weeds out.
      </p>
      <ol className="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-4" data-testid="light-table-females">
        {d.females.map((m, k) => (
          <li key={k} className={`flex gap-2 ${k < shown ? 'text-stone-100' : 'text-stone-500'}`}>
            <span className="w-5 text-right text-xs text-stone-400">{k + 1}.</span>
            <Mono>{m.setting}</Mono>
            <Indicator m={m} />
          </li>
        ))}
      </ol>
      <LightTable sheets={sheets} size={51} shown={shown} onShown={setShown} />
      <p aria-live="polite" data-testid="light-table-settings" data-count={lit.length}>
        {shown === 0
          ? 'No sheet stacked yet: all 676 settings of the middle and right rings are possible.'
          : `Settings still lit: ${lit.length}${lit.length <= 4 ? ` (${lit.map(settingName).join('; ')})` : ''}.`}{' '}
        A sheet repeats its square a–z, a–y, so each lit setting shows up to four times on the table.
      </p>
      {fired && share !== null && needed !== null ? (
        <div className="flex flex-col gap-2" data-testid="light-table-scale" data-needed={needed} aria-live="polite">
          <p>
            Without knowing the wheel order or the left ring, the Poles faced all {ALL_SETTINGS.toLocaleString('en-US')}{' '}
            settings. Each female keeps a share of about {share.toFixed(3)} of them (the holes of this wheel order&apos;s
            sheets), so after k females about {ALL_SETTINGS.toLocaleString('en-US')} × {share.toFixed(3)}
            <sup>k</sup> are left:
          </p>
          <div className="max-w-full overflow-x-auto">
            <table className="font-mono text-xs">
              <thead>
                <tr className="text-stone-400">
                  <th className="pr-3 text-left font-normal">females</th>
                  {Array.from({ length: 14 }, (_, k) => (
                    <th key={k} className={`px-1 font-normal ${k + 1 === needed ? 'text-amber-200' : ''}`}>
                      {k + 1}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th className="pr-3 text-left font-normal text-stone-400">left</th>
                  {Array.from({ length: 14 }, (_, k) => (
                    <td key={k} className={`px-1 text-right ${k + 1 === needed ? 'text-amber-200' : ''}`}>
                      {fmt(expected(ALL_SETTINGS, share, k + 1))}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
          <p>
            About {needed} females bring it down to one or two settings: the day&apos;s own wheel order, left sheet and ring
            settings, and perhaps one impostor.
          </p>
        </div>
      ) : null}
    </div>
  )
}
