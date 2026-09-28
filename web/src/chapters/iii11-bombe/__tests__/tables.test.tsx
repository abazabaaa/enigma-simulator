// @vitest-environment happy-dom
/**
 * The letter tables must never read as words to a text scan (the e2e answer-leak check reads a detached clone's
 * textContent, where table cells run together): a row like D H G A F E C B once "contained" the answer AFEC.
 */

import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { createRng, seedFor } from '../../../lib/rng'
import { trueToy } from '../gates'
import { CribLine, ScramblerTable, loopLabels } from '../scenes'

function textOf(html: string): string {
  const div = document.createElement('div')
  div.innerHTML = html
  return div.textContent ?? ''
}

describe('letter tables keep their letters apart', () => {
  it('ScramblerTable: no two table letters touch in the text (100 toys)', () => {
    for (let s = 0; s < 100; s++) {
      const { toy } = trueToy(createRng(seedFor('tables', s)), 4)
      const text = textOf(renderToStaticMarkup(<ScramblerTable labels={loopLabels(toy)} tables={toy.tables} />))
      expect(text, `toy ${s}`).not.toMatch(/[A-H]{2}/)
      for (const t of toy.tables) expect(text).toContain([...t].join(' '))
    }
  })

  it('CribLine: the message and the crib are spaced too', () => {
    const text = textOf(renderToStaticMarkup(<CribLine cipher="LTOSGUAQEL" crib="ATT" offset={4} />))
    expect(text).not.toMatch(/[A-Z]{2}/)
  })
})
