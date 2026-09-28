// @vitest-environment happy-dom
import { act, useState, type ReactElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { formatCycles, fromCycles, fromPairs, conjugate } from '../engine'
import { createRng } from '../lib/rng'
import { propagate, toyBombe } from '../crypto/bombe'
import { buildCatalogue, catalogueStats } from '../crypto/catalogue'
import { menuFromCrib, menuFromEdges, type Menu } from '../crypto/menu'
import { REJEWSKI_65, alignmentPairs, pairedCycles, products } from '../crypto/rejewski'
import { histogramBins } from './CatalogueHistogram'
import { menuPieces } from './MenuGraph'
import { stackedApertures } from './LightTable'
import { CatalogueHistogram, CribStrip, CycleAlign, CycleDiagram, LightTable, MenuGraph, TestRegister, WireGrid } from '.'

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

const render = (el: ReactElement) => act(async () => root.render(el))
const q = (testId: string) => container.querySelector<HTMLElement>(`[data-testid="${testId}"]`)!
const key = (el: Element, k: string) =>
  act(async () => void el.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true })))
const click = (el: Element) => act(async () => void (el as HTMLElement).click())

const AD = products(REJEWSKI_65).AD as number[]

describe('CycleDiagram', () => {
  it('shows the cycles and lengths, highlights a cycle and reports picked letters', async () => {
    const pick = vi.fn()
    await render(<CycleDiagram perm={AD} highlightCycle={[3]} onPickLetter={pick} />)
    const root = q('cycle-diagram')
    expect(root.dataset.cycles).toBe('(a)(bc)(dvpfkxgzyo)(eijmunqlht)(rw)(s)')
    expect(root.dataset.lengths).toBe('10.10.2.2.1.1')
    expect(root.querySelector('[data-highlight="true"]')?.getAttribute('data-cycle')).toBe('dvpfkxgzyo')
    expect(root.querySelectorAll('[data-letter]')).toHaveLength(26)
    await key(q('cycle-diagram-letter-K'), 'Enter')
    expect(pick).toHaveBeenCalledWith(10)
  })

  it('relabels in place: the drawing shows conjugate(perm, relabelBy)', async () => {
    const S = [...fromPairs('AB DE')]
    await render(<CycleDiagram perm={AD} relabelBy={S} />)
    expect(q('cycle-diagram').dataset.cycles).toBe(formatCycles(conjugate(AD, S)))
    expect(q('cycle-diagram').dataset.lengths).toBe('10.10.2.2.1.1')
    expect(q('cycle-diagram').querySelector('svg')?.getAttribute('role')).toBe('img')
  })

  it('draws the toy hexagon', async () => {
    const hexagon = [...fromCycles('(ace)(bfd)', 6)]
    await render(<CycleDiagram perm={hexagon} testId="hex" />)
    expect(q('hex').dataset.cycles).toBe('(ace)(bfd)')
  })
})

describe('CycleAlign', () => {
  it('lists the pairs of the alignment and moves with the keys', async () => {
    const [a, b] = pairedCycles(AD)[0]!
    const change = vi.fn()
    await render(<CycleAlign a={a!} b={b!} offset={3} reversed onChange={change} />)
    const pairs = alignmentPairs(a!, b!, 3, true).map(([x, y]) => String.fromCharCode(65 + x, 65 + y)).join(' ')
    expect(q('cycle-align').dataset.pairs).toBe(pairs)
    await key(q('cycle-align-strip'), 'ArrowRight')
    expect(change).toHaveBeenLastCalledWith(4, true)
    await key(q('cycle-align-strip'), 'ArrowLeft')
    expect(change).toHaveBeenLastCalledWith(2, true)
    await key(q('cycle-align-strip'), 'r')
    expect(change).toHaveBeenLastCalledWith(3, false)
    await click(q('cycle-align-left'))
    expect(change).toHaveBeenLastCalledWith(2, true)
  })

  it('wraps the offset modulo the cycle length', async () => {
    const change = vi.fn()
    await render(<CycleAlign a={[0, 2, 4]} b={[5, 3, 1]} offset={2} reversed={false} onChange={change} />)
    await key(q('cycle-align-strip'), 'ArrowRight')
    expect(change).toHaveBeenLastCalledWith(0, false)
  })
})

describe('CatalogueHistogram', () => {
  it('bins bucket sizes in powers of two and marks the highlighted bucket', async () => {
    const stats = catalogueStats(buildCatalogue({ reflector: 'B', orders: [['I', 'II', 'III']] }))
    const bins = histogramBins(stats.histogram, stats.maxBucket)
    expect(bins.reduce((s, b) => s + b.settings, 0)).toBe(17576)
    expect(bins.reduce((s, b) => s + b.characteristics, 0)).toBe(stats.distinct)
    await render(<CatalogueHistogram stats={stats} highlight="3" />)
    const el = q('catalogue-histogram')
    expect(el.dataset.entries).toBe('17576')
    expect(el.dataset.distinct).toBe(String(stats.distinct))
    expect(el.dataset.highlightBin).toBe('3–4')
    expect(q('catalogue-histogram-table').querySelectorAll('tbody tr')).toHaveLength(bins.length)
    const regions = [...q('catalogue-histogram').querySelectorAll<HTMLElement>('[role="region"]')]
    expect(regions.map((r) => [r.getAttribute('aria-label'), r.tabIndex])).toEqual([
      ['Catalogue histogram', 0],
      ['Catalogue histogram table', 0],
    ])
  })
})

describe('LightTable', () => {
  it('lets light through only where every stacked sheet has a hole', async () => {
    const size = 51
    const a = Array.from({ length: size * size }, (_, i) => i % 2 === 0)
    const b = Array.from({ length: size * size }, (_, i) => i % 3 === 0)
    expect(stackedApertures([a, b], size, 0).filter(Boolean)).toHaveLength(size * size)
    expect(stackedApertures([a, b], size, 2).filter(Boolean)).toHaveLength(Math.ceil((size * size) / 6))
    const onShown = vi.fn()
    await render(<LightTable sheets={[a, b]} size={51} shown={1} onShown={onShown} />)
    expect(q('light-table').dataset.apertures).toBe(String(a.filter(Boolean).length))
    await click(q('light-table-add'))
    expect(onShown).toHaveBeenLastCalledWith(2)
    await key(q('light-table-table'), 'ArrowDown')
    expect(onShown).toHaveBeenLastCalledWith(0)
  })
})

describe('CribStrip', () => {
  it('marks crashes and moves with the arrow keys', async () => {
    const onOffset = vi.fn()
    await render(<CribStrip cipher="ABCDEFAB" crib="XBC" offset={0} onOffset={onOffset} />)
    const el = q('crib-strip')
    expect(el.dataset.crashes).toBe('1,2')
    expect(el.querySelectorAll('[data-crash="true"]')).toHaveLength(2)
    await key(q('crib-strip-slider'), 'ArrowRight')
    expect(onOffset).toHaveBeenLastCalledWith(1)
    await key(q('crib-strip-slider'), 'End')
    expect(onOffset).toHaveBeenLastCalledWith(5)
    await key(q('crib-strip-slider'), 'ArrowLeft')
    expect(onOffset).toHaveBeenLastCalledWith(0) // clamped
  })

  it('is display-only when readOnly', async () => {
    await render(<CribStrip cipher="WSNPNLKLSTCS" crib="ATTACKATDAWN" offset={0} readOnly onOffset={() => {}} />)
    expect(q('crib-strip-slider')).toBeNull()
    expect(q('crib-strip').dataset.crashCount).toBe('0')
    // M1: a read-only strip is a labelled region the keyboard can focus (and so scroll), never role="img"
    const region = q('crib-strip-scroller')
    expect(region.getAttribute('role')).toBe('region')
    expect(region.tabIndex).toBe(0)
    expect(region.getAttribute('aria-label')).toMatch(/^Crib ATTACKATDAWN under WSNPNLKLSTCS at offset 0: no crash/)
    expect(container.querySelector('[role="img"]')).toBeNull()
  })
})

describe('MenuGraph', () => {
  const v14 = menuFromCrib('WSNPNLKLSTCS', 'ATTACKATDAWN', 0)

  it('counts closures and offers the available edges', async () => {
    const add = vi.fn()
    const remove = vi.fn()
    const menu = menuFromEdges(v14.edges.slice(0, 10))
    await render(<MenuGraph menu={menu} available={v14.edges} onAddEdge={add} onRemoveEdge={remove}
      highlightLoop={['A', 'T', 'L', 'K']} warnings={[11]} />)
    const el = q('menu-graph')
    expect(el.dataset.closures).toBe('1')
    expect(el.dataset.edges).toBe('10')
    expect(el.dataset.loops).toBe('AKLT')
    expect(el.querySelectorAll('[data-loop="true"]')).toHaveLength(4)
    expect(el.querySelector('[data-edge="11"]')?.getAttribute('data-warning')).toBe('true')
    await click(q('menu-graph-add-11'))
    expect(add).toHaveBeenCalledWith(11)
    await key(q('menu-graph-remove-3'), 'Delete')
    expect(remove).toHaveBeenCalledWith(3)
    expect(q('menu-graph-add-1')).toBeNull() // already in the menu
  })

  it('counts links, letters and pieces so that the closure sum adds up (m2)', async () => {
    const two = menuFromEdges([...v14.edges.slice(0, 3), { a: 'X', b: 'Y', pos: 20 }, { a: 'Y', b: 'X', pos: 21 }])
    await render(<MenuGraph menu={two} />)
    // A–W, T–S, T–N and a doubled X–Y: 5 links, 7 letters, 3 pieces, 1 closure (the X–Y pair)
    expect(q('menu-graph').dataset.pieces).toBe('3')
    expect(q('menu-graph-closures').textContent).toBe(
      'Closures: 1 — 5 links, 7 letters, 3 pieces (links − letters + pieces = 1)')
    expect(menuPieces(two.edges).map((p) => p.join(''))).toEqual(['TNS', 'AW', 'XY'])
  })

  it('moves focus to the link’s new button after Enter adds it or Delete removes it (m3)', async () => {
    function Harness() {
      const [added, setAdded] = useState<readonly number[]>([1, 2, 3])
      const menu: Menu = menuFromEdges(v14.edges.filter((e) => added.includes(e.pos)))
      return <MenuGraph menu={menu} available={v14.edges} onAddEdge={(pos) => setAdded((a) => [...a, pos])}
        onRemoveEdge={(pos) => setAdded((a) => a.filter((x) => x !== pos))} />
    }
    await render(<Harness />)
    q('menu-graph-add-4').focus()
    await click(q('menu-graph-add-4'))
    expect(document.activeElement).toBe(q('menu-graph-remove-4'))
    await key(q('menu-graph-remove-2'), 'Delete')
    expect(q('menu-graph-remove-2')).toBeNull()
    expect(document.activeElement).toBe(q('menu-graph-add-2'))
  })

  it('draws each connected piece on its own circle and scrolls on narrow screens', async () => {
    await render(<MenuGraph menu={v14} />)
    const drawing = q('menu-graph-drawing')
    expect(drawing.getAttribute('role')).toBe('region')
    expect(drawing.tabIndex).toBe(0)
    expect(drawing.querySelector('svg')?.style.minWidth).toMatch(/px$/)
  })

  it('shows vector 14 with 3 closures', async () => {
    await render(<MenuGraph menu={v14} />)
    expect(q('menu-graph').dataset.closures).toBe('3')
    expect(q('menu-graph').dataset.loops).toBe('NST AKLT ATNCW')
  })
})

describe('WireGrid and TestRegister', () => {
  const toy = toyBombe(createRng(8), { n: 8, scramblers: 4 })
  const ws = propagate(toy.menu, toy.scramblers, toy.truth, { n: 8, diagonal: true })

  it('replays the propagation step by step and outlines the register', async () => {
    await render(<WireGrid state={ws} step={1} diagonal testLetter={toy.truth.bank} />)
    expect(q('wire-grid').dataset.liveTotal).toBe('1')
    expect(q('wire-grid').dataset.testLive).toBe('1')
    expect(q('wire-grid').querySelector('[data-via="hypothesis"]')).not.toBeNull()
    await render(<WireGrid state={ws} diagonal testLetter={toy.truth.bank} />)
    expect(q('wire-grid').dataset.liveTotal).toBe(String(ws.order.length))
    expect(q('wire-grid-scroller').tabIndex).toBe(0) // read-only: the scroller itself takes focus
    expect(q('wire-grid-scroller').getAttribute('role')).toBe('region')
  })

  it('is a keyboard grid of buttons when onToggleWire is given', async () => {
    const toggle = vi.fn()
    await render(<WireGrid state={ws} diagonal={false} testLetter="C" onToggleWire={toggle} />)
    const start = q('wire-grid-cell-C-A')
    expect(start.tabIndex).toBe(0)
    expect(q('wire-grid-scroller').hasAttribute('tabindex')).toBe(false) // the cells are the tab stop
    start.focus()
    await key(start, 'ArrowRight')
    expect(document.activeElement).toBe(q('wire-grid-cell-C-B'))
    await key(q('wire-grid-cell-C-B'), 'ArrowDown')
    expect(document.activeElement).toBe(q('wire-grid-cell-D-B'))
    await click(q('wire-grid-cell-D-B'))
    expect(toggle).toHaveBeenCalledWith(3, 1)
  })

  it('TestRegister counts the live wires', async () => {
    const bank = toy.truth.bank.charCodeAt(0) - 65
    await render(<TestRegister live={ws.live[bank]!} testLetter={toy.truth.bank} />)
    expect(q('test-register').dataset.liveCount).toBe('1')
    expect(q('test-register').dataset.liveWires).toBe(toy.truth.wire)
  })
})
