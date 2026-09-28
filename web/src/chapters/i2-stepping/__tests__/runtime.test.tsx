// @vitest-environment happy-dom
/**
 * The [contracts-v2] runtime behaviours I.2 relies on (review m9), exercised through the real components:
 *  - reveal gating in SceneFrame (05's ordered isAllowed with the pilot's repeat-Step rule), on the double-step scene;
 *  - the windows rollback replays the first wrong press on the machine (replayPress);
 *  - a set-machine item's machine rollback shows the learner's submitted setting on the machine.
 */

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { CheckResult } from '../../../contracts/lesson'
import { positionsToString, type MachineConfig } from '../../../engine'
import { useProgress } from '../../../lesson/progress'
import { RollbackView, replayPress } from '../../../lesson/ui/RollbackView'
import { SceneFrame, commitBet } from '../../../lesson/ui/SceneFrame'
import { MachineProvider } from '../../../state/activeMachine'
import { createMachineStore, useMachineStore } from '../../../state/machineStore'
import { createRng, seedFor } from '../../../lib/rng'
import chapter from '../index'
import { DOUBLE_START, READ_ONLY, middleSteps, stepsFrom, windows, type StepsInstance, type WindowsInstance } from '../gates'
import { ITEM_UI } from '../items'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  useProgress.getState().reset(Date.now())
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  useProgress.getState().reset(Date.now())
})

/** Let queued microtasks (the rollback's deferred machine writes) run. */
const flush = () => act(async () => await Promise.resolve())

describe('reveal gating on the double-step scene (SceneFrame, merged isAllowed)', () => {
  const scene = chapter.scenes.find((s) => s.id === 'double-step')!
  const button = (bet: string) => container.querySelector<HTMLButtonElement>(`[data-testid="reveal-${bet}"]`)!
  const windowsNow = () => positionsToString(useMachineStore.getState().machine)
  const click = (bet: string) => act(async () => button(bet).click())
  const commit = (bet: string, v: string) => act(async () => void commitBet('i2-stepping', bet, v))

  it('Steps fire in order; a fired Step waits while the next bet is open, and repeats once no bet is open', async () => {
    await act(async () =>
      root.render(
        <SceneFrame chapter="i2-stepping" def={chapter} scene={scene} index={2} canNext={false} isLast={false} recallUi={{}} onNext={() => {}} onBack={() => {}} />,
      ),
    )
    expect(windowsNow()).toBe('ADU')
    expect(['adu', 'adv', 'aew'].map((b) => button(b).disabled)).toEqual([true, true, true])
    expect(button('adv').textContent).toBe('Second step (bet first)')

    // The third bet first: its Step still waits for the first two.
    await commit('aew', 'all')
    expect(button('aew').disabled).toBe(true)
    expect(button('aew').textContent).toContain('(after the earlier reveal)')

    await commit('adu', 'right')
    expect(button('adu').disabled).toBe(false)
    await click('adu')
    expect(windowsNow()).toBe('ADV')

    // The second bet is open: the first Step cannot press again (a click does nothing).
    expect(button('adu').disabled).toBe(true)
    expect(button('adu').textContent).toContain('(bet on the next one first)')
    await click('adu')
    expect(windowsNow()).toBe('ADV')
    expect(button('aew').disabled).toBe(true)

    await commit('adv', 'right-middle')
    await click('adv')
    expect(windowsNow()).toBe('AEW')
    await click('aew')
    expect(windowsNow()).toBe('BFX')
    expect(useMachineStore.getState().last!.stepping.doubleStep).toBe(true)

    // Every reveal has fired: a Step is now a repeat press.
    expect(button('adu').disabled).toBe(false)
    await click('adu')
    expect(windowsNow()).toBe('BFY')
    expect(container.querySelector('[data-testid="task-reach-bfx"]')!.getAttribute('data-done')).toBe('true')
    const bets = useProgress.getState().bets
    expect([bets['i2-stepping/adu']?.correct, bets['i2-stepping/adv']?.correct, bets['i2-stepping/aew']?.correct]).toEqual([
      true,
      true,
      true,
    ])
  })
})

describe('rollbacks that move the machine (RollbackView)', () => {
  it('replayPress: the press before the first wrong window, on the machine, with the item locks restored', () => {
    const store = createMachineStore({ config: DOUBLE_START, locks: READ_ONLY })
    replayPress(store, DOUBLE_START, 'AEW')
    const s = store.getState()
    expect(positionsToString(s.machine)).toBe('BFX')
    expect(s.last!.stepping.doubleStep).toBe(true)
    expect(s.locks).toEqual(READ_ONLY)
    expect(() => s.pressKey('A')).toThrow()
  })

  it('the windows rollback shows the first wrong press on the stage machine', async () => {
    const store = createMachineStore({ config: DOUBLE_START, locks: READ_ONLY })
    const i = windows.generate(createRng(seedFor('runtime', 1)), {
      key: 'i2-stepping/stepping/windows',
      attempt: 1,
      purpose: 'instance',
      previous: [],
    }) as WindowsInstance
    const good = windows.solve(i) as string
    const wrong = good.slice(0, 4) + (good[4] === 'A' ? 'B' : 'A') + good.slice(5)
    const result = windows.check(i, wrong) as CheckResult
    await act(async () =>
      root.render(
        <MachineProvider store={store}>
          <RollbackView result={result} answer={wrong} instance={i} logic={windows} ui={ITEM_UI.windows!} passed={false} gatePassed={false} onContinue={() => {}} />
        </MachineProvider>,
      ),
    )
    await flush()
    const press = stepsFrom(i.config, 3)[1]!
    const last = store.getState().last!
    expect(last.stepping.before.map((x) => String.fromCharCode(65 + x)).join('')).toBe(press.before)
    expect(positionsToString(store.getState().machine)).toBe(press.after)
    expect(container.querySelector('[data-testid="stepping-preview"]')!.getAttribute('data-press')).toBe('1')
  })

  it("a set-machine rollback holds the learner's submitted setting on the machine", async () => {
    const i = middleSteps.generate(createRng(seedFor('runtime', 2)), {
      key: 'i2-stepping/stepping/middle-steps',
      attempt: 1,
      purpose: 'instance',
      previous: [],
    }) as StepsInstance
    const store = createMachineStore({ config: i.setup.machine, locks: { ...READ_ONLY, positions: false } })
    const solved = middleSteps.solve(i) as MachineConfig
    const answer = middleSteps.mutate(i, solved, createRng(3)) as MachineConfig
    const result = middleSteps.check(i, answer)
    expect(result.rollback.kind).toBe('machine')
    await act(async () =>
      root.render(
        <MachineProvider store={store}>
          <RollbackView
            result={result}
            answer={answer}
            instance={i}
            logic={middleSteps}
            ui={ITEM_UI['middle-steps']!}
            passed={false}
            gatePassed={false}
            onContinue={() => {}}
          />
        </MachineProvider>,
      ),
    )
    await flush()
    expect(positionsToString(store.getState().machine)).toBe(answer.positions.join(''))
    expect(store.getState().locks.keyboard).toBe(true)
  })
})
