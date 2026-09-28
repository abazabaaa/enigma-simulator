// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { STAGE_PRESETS, dimmedParts } from '../contracts/stage'
import { useMachineStore } from '../state/machineStore'
import { useStageStore } from '../state/stageStore'
import { StageHost } from './StageHost'
import { stageApi } from './stageApi'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
})

const stageEl = () => container.querySelector<HTMLElement>('[data-testid="stage"]')

describe('StageHost', () => {
  it('renders the 2D view and reports through window.__stage', async () => {
    await act(async () => root.render(<StageHost stage="pawls" />))
    // 'placeholder' while Stage2D is the 02 stub; 'svg' once 04's view lands.
    const renderer = stageEl()?.dataset.renderer
    expect(['placeholder', 'svg']).toContain(renderer)
    expect(stageEl()?.dataset.focus).toBe('pawls')
    const placeholder = container.querySelector('[data-testid="stage-placeholder"]')
    if (renderer === 'placeholder') expect(placeholder?.textContent).toContain('pawls')
    else expect(placeholder).toBeNull()
    expect(useStageStore.getState().directive).toEqual(STAGE_PRESETS.pawls)
    const info = stageApi.info()
    expect(info).toMatchObject({ renderer, focus: 'pawls', directive: STAGE_PRESETS.pawls })
    expect(info.litLamp).toBeNull()
    expect(info.dimmed).toEqual(dimmedParts('pawls', 'I'))
    expect(stageApi.stats()).toBeNull()
  })

  it('resolves overrides and follows the machine model', async () => {
    const rotors = ['Beta', 'I', 'II', 'III'] as const
    const m4 = { model: 'M4', reflector: 'B-thin', rotors, rings: 'AAAA', positions: 'AAAA' } as const
    await act(async () => useMachineStore.getState().setConfig(m4))
    await act(async () => root.render(<StageHost stage={{ preset: 'wire', with: { focus: 'rotor-greek' } }} />))
    expect(stageEl()?.dataset.focus).toBe('rotor-greek')
    expect(stageApi.info().dimmed).toEqual(dimmedParts('rotor-greek', 'M4'))
    expect(stageApi.info().windows).toBe('AAAA')
    const i = { model: 'I', reflector: 'B', rotors: ['I', 'II', 'III'], rings: 'AAA', positions: 'AAA' } as const
    await act(async () => useMachineStore.getState().setConfig(i))
  })

  it('renders nothing and clears the directive for a null stage', async () => {
    await act(async () => root.render(<StageHost stage="wire" />))
    await act(async () => root.render(<StageHost stage={null} />))
    expect(stageEl()).toBeNull()
    expect(useStageStore.getState().directive).toBeNull()
    expect(stageApi.info().directive).toBeNull()
  })
})
