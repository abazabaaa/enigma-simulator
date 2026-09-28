// @vitest-environment happy-dom
/**
 * Review round 3 (from PR 10): on a set-machine item the locked keyboard comes before the item's own controls.
 * Its keys are aria-disabled inside an inert group (04's keyboard) or disabled (the stub): the focus must skip
 * them and land on the first control that works, and never drop to <body>.
 */

import { afterEach, describe, expect, it } from 'vitest'
import { ANSWER_CONTROL, firstUsable, focusSettled, usable } from '../ui/focus'

const frame = () => new Promise<void>((r) => requestAnimationFrame(() => r()))

function setMachineItem(keyboard: 'inert' | 'aria' | 'disabled' | 'open'): HTMLElement {
  const item = document.createElement('div')
  const keys = ['Q', 'W', 'E']
    .map((k) =>
      keyboard === 'disabled'
        ? `<button type="button" data-testid="key-${k}" disabled>${k}</button>`
        : `<button type="button" data-testid="key-${k}" ${keyboard === 'open' ? '' : 'aria-disabled="true"'}>${k}</button>`,
    )
    .join('')
  item.innerHTML = `
    <p data-testid="item-prompt" tabindex="-1">Set the machine.</p>
    <div data-role="answer">
      <div role="group" data-testid="keyboard" ${keyboard === 'inert' ? 'inert' : ''}>${keys}</div>
      <fieldset disabled><input data-testid="fieldset-input"></fieldset>
      <button type="button" data-testid="plug-A">A</button>
      <button type="button" data-testid="gate-submit">Submit</button>
    </div>`
  document.body.appendChild(item)
  return item
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('focus: a set-machine item whose locked keyboard comes first', () => {
  it.each(['inert', 'aria', 'disabled'] as const)('skips %s keys and lands on the first working control', (kb) => {
    const item = setMachineItem(kb)
    expect(item.querySelector(ANSWER_CONTROL.replace(':not([aria-disabled="true"])', ''))).not.toBeNull()
    const el = firstUsable(item, ANSWER_CONTROL)
    expect(el?.dataset.testid).toBe('plug-A')
  })

  it('an unlocked keyboard is a control like any other', () => {
    expect(firstUsable(setMachineItem('open'), ANSWER_CONTROL)?.dataset.testid).toBe('key-Q')
  })

  it('usable: disabled, fieldset-disabled, aria-disabled, inert and tabindex -1 are not', () => {
    const item = setMachineItem('inert')
    expect(usable(item.querySelector('[data-testid="key-Q"]')!)).toBe(false)
    expect(usable(item.querySelector('[data-testid="fieldset-input"]')!)).toBe(false)
    expect(usable(item.querySelector('[data-testid="item-prompt"]')!)).toBe(false)
    expect(usable(item.querySelector('[data-testid="plug-A"]')!)).toBe(true)
  })

  it('focusSettled puts the focus back when a lock lands after the first focus', async () => {
    const item = setMachineItem('open')
    focusSettled(() => firstUsable(item, ANSWER_CONTROL))
    expect(document.activeElement?.getAttribute('data-testid')).toBe('key-Q')
    // The item's setup locks the keyboard one render later (04: inert group, aria-disabled keys).
    item.querySelector('[data-testid="keyboard"]')!.setAttribute('inert', '')
    for (const b of item.querySelectorAll('[data-testid^="key-"]')) b.setAttribute('aria-disabled', 'true')
    ;(document.activeElement as HTMLElement).blur()
    await frame()
    await frame()
    expect(document.activeElement?.getAttribute('data-testid')).toBe('plug-A')
  })
})
