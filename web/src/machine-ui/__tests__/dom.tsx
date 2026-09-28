/**
 * A tiny React DOM harness for happy-dom unit tests (the project has no testing-library):
 * mount a tree with act(), query by data-testid, and fire the events React listens to.
 */

import { act, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { DEFAULT_CONFIG, type MachineConfigInput } from '../../engine'
import { useMachineStore } from '../../state/machineStore'
import { usePlaybackStore } from '../../state/playbackStore'
import { useStageStore } from '../../state/stageStore'
import { installSync } from '../../state/sync'

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true

export interface Mounted {
  readonly container: HTMLElement
  rerender(ui: ReactNode): void
  unmount(): void
}

const mounted: Mounted[] = []

export function mount(ui: ReactNode): Mounted {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  act(() => root.render(ui))
  const m: Mounted = {
    container,
    rerender: (next) => act(() => root.render(next)),
    unmount: () => {
      act(() => root.unmount())
      container.remove()
    },
  }
  mounted.push(m)
  return m
}

/** Unmount everything mounted so far (call in afterEach). */
export function cleanup(): void {
  while (mounted.length) mounted.pop()!.unmount()
}

export function byTestId(id: string, root: ParentNode = document): HTMLElement {
  const el = root.querySelector<HTMLElement>(`[data-testid="${id}"]`)
  if (!el) throw new Error(`No element with data-testid="${id}"`)
  return el
}

export function allByTestId(prefix: RegExp, root: ParentNode = document): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>('[data-testid]')].filter((el) => prefix.test(el.dataset.testid ?? ''))
}

export function click(el: Element): void {
  act(() => {
    el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
  })
}

export function keyDown(el: EventTarget, key: string, init: KeyboardEventInit = {}): KeyboardEvent {
  const e = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init })
  act(() => {
    el.dispatchEvent(e)
  })
  return e
}

/** Set a text input's value the way a user does (React tracks the native setter), then fire input. */
export function typeInto(input: HTMLInputElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
  act(() => {
    setter.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

export function selectValue(select: HTMLSelectElement, value: string): void {
  act(() => {
    select.value = value
    select.dispatchEvent(new Event('change', { bubbles: true }))
  })
}

export function submit(form: HTMLFormElement): void {
  act(() => {
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
  })
}

/** Run a store action inside act() so subscribed components re-render. */
export function run<T>(fn: () => T): T {
  let out: T
  act(() => {
    out = fn()
  })
  return out!
}

/** Fresh default machine (optionally configured), no locks, instant playback, sync installed. */
export function resetStores(config: MachineConfigInput = DEFAULT_CONFIG): void {
  installSync()
  act(() => {
    const s = useMachineStore.getState()
    s.setLocks({})
    s.setConfig(config)
    const pb = usePlaybackStore.getState()
    pb.setGated(false)
    pb.setSpeed('instant')
    useStageStore.getState().setHighlight([])
    useStageStore.getState().setGhost(null)
  })
}
