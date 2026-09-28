/**
 * Menus (PLAN §3.11, §4.4 III.10). PURE. A crib at an offset pairs each plaintext letter with the cipher letter
 * under it; the pair at crib position p (1-based) is an edge a–b labelled p: the scrambler at position p sends a to
 * b (after the plugboard). The bombe needs closures (independent loops): E − V + C.
 */

import { ROTORS, letterToIndex, type Letter, type RotorName } from '../engine'

/** One crib position: plaintext letter a, cipher letter b, pos = the 1-based crib position. */
export interface MenuEdge {
  readonly a: Letter
  readonly b: Letter
  readonly pos: number
}

/** A menu: its edges and its distinct letters (A→Z). */
export interface Menu {
  readonly edges: readonly MenuEdge[]
  readonly letters: readonly Letter[]
}

const up = (s: string) => s.toUpperCase()

/** A menu from any list of edges (letters are the distinct edge letters, A→Z). */
export function menuFromEdges(edges: readonly MenuEdge[]): Menu {
  const letters = [...new Set(edges.flatMap((e) => [e.a, e.b]))].sort() as Letter[]
  return { edges: [...edges], letters }
}

/** The full menu of a crib at `offset`: edge i is crib[i]–cipher[offset + i] at pos i + 1. */
export function menuFromCrib(cipher: string, crib: string, offset: number): Menu {
  const c = up(cipher)
  const p = up(crib)
  if (!Number.isInteger(offset) || offset < 0 || offset + p.length > c.length) {
    throw new RangeError(`Offset ${offset} does not fit a ${p.length}-letter crib under ${c.length} letters`)
  }
  const edges: MenuEdge[] = []
  for (let i = 0; i < p.length; i++) {
    letterToIndex(p[i]!)
    letterToIndex(c[offset + i]!)
    edges.push({ a: p[i] as Letter, b: c[offset + i] as Letter, pos: i + 1 })
  }
  return menuFromEdges(edges)
}

function vertexIndex(m: Menu): { letters: Letter[]; index: Map<Letter, number> } {
  const letters = [...new Set<Letter>([...m.letters, ...m.edges.flatMap((e) => [e.a, e.b])])].sort()
  return { letters, index: new Map(letters.map((l, i) => [l, i])) }
}

function componentCount(n: number, pairs: readonly (readonly [number, number])[]): number {
  const parent = Array.from({ length: n }, (_, i) => i)
  const find = (x: number): number => {
    while (parent[x] !== x) {
      parent[x] = parent[parent[x]!]!
      x = parent[x]!
    }
    return x
  }
  let components = n
  for (const [u, v] of pairs) {
    const ru = find(u)
    const rv = find(v)
    if (ru !== rv) {
      parent[ru] = rv
      components--
    }
  }
  return components
}

/** Closures = E − V + C (edges, letters, connected components): the number of independent loops. */
export function closures(m: Menu): number {
  const { letters, index } = vertexIndex(m)
  const pairs = m.edges.map((e) => [index.get(e.a)!, index.get(e.b)!] as const)
  return m.edges.length - letters.length + componentCount(letters.length, pairs)
}

/**
 * A cycle basis of the menu with the fewest letters (a minimum cycle basis, by Horton's candidate cycles and
 * elimination over GF(2)); exactly closures(m) loops. Each loop is its letters in order around the cycle, starting
 * at its first letter alphabetically and continuing towards the smaller neighbour. Vector 14 gives NST (= TNS),
 * AKLT (= ATLK) and ATNCW (= TAWCN), shortest first. Two edges between the same letters form a 2-letter loop.
 */
export function loops(m: Menu): Letter[][] {
  const { letters, index } = vertexIndex(m)
  const V = letters.length
  const ends = m.edges.map((e) => [index.get(e.a)!, index.get(e.b)!] as const)
  const want = closures(m)
  if (want === 0) return []

  // adjacency sorted by (neighbour, pos) for deterministic BFS trees
  const adj: { to: number; edge: number }[][] = Array.from({ length: V }, () => [])
  ends.forEach(([u, v], e) => {
    adj[u]!.push({ to: v, edge: e })
    if (u !== v) adj[v]!.push({ to: u, edge: e })
  })
  const pos = (e: number) => m.edges[e]!.pos
  for (const list of adj) list.sort((x, y) => x.to - y.to || pos(x.edge) - pos(y.edge))

  interface Candidate {
    readonly bits: bigint
    readonly edges: number[]
  }
  const candidates = new Map<bigint, Candidate>()
  const addCandidate = (edges: number[]) => {
    const bits = edges.reduce((acc, e) => acc | (1n << BigInt(e)), 0n)
    if (!candidates.has(bits)) candidates.set(bits, { bits, edges: [...edges].sort((x, y) => x - y) })
  }
  ends.forEach(([u, v], e) => {
    if (u === v) addCandidate([e])
  })

  for (let root = 0; root < V; root++) {
    const parentEdge = new Array<number>(V).fill(-1)
    const parent = new Array<number>(V).fill(-1)
    const seen = new Array<boolean>(V).fill(false)
    seen[root] = true
    const queue = [root]
    for (let qi = 0; qi < queue.length; qi++) {
      const x = queue[qi]!
      for (const { to, edge } of adj[x]!) {
        if (seen[to]) continue
        seen[to] = true
        parent[to] = x
        parentEdge[to] = edge
        queue.push(to)
      }
    }
    const pathToRoot = (x: number): { vertices: number[]; edges: number[] } => {
      const vertices = [x]
      const edges: number[] = []
      while (x !== root) {
        edges.push(parentEdge[x]!)
        x = parent[x]!
        vertices.push(x)
      }
      return { vertices, edges }
    }
    ends.forEach(([u, v], e) => {
      if (u === v || !seen[u] || !seen[v]) return
      if (parentEdge[u] === e || parentEdge[v] === e) return
      const pu = pathToRoot(u)
      const pv = pathToRoot(v)
      // simple only if the two paths meet only at the root
      const onU = new Set(pu.vertices)
      if (pv.vertices.some((x) => x !== root && onU.has(x))) return
      addCandidate([...pu.edges, ...pv.edges, e])
    })
  }

  const sorted = [...candidates.values()].sort((x, y) => {
    if (x.edges.length !== y.edges.length) return x.edges.length - y.edges.length
    const px = x.edges.map(pos).sort((a, b) => a - b)
    const py = y.edges.map(pos).sort((a, b) => a - b)
    for (let i = 0; i < px.length; i++) if (px[i] !== py[i]) return px[i]! - py[i]!
    return 0
  })

  const basis = new Map<number, bigint>() // pivot bit → reduced vector
  const chosen: Candidate[] = []
  for (const c of sorted) {
    let v = c.bits
    while (v !== 0n) {
      const pivot = highestBit(v)
      const row = basis.get(pivot)
      if (row === undefined) break
      v ^= row
    }
    if (v === 0n) continue
    basis.set(highestBit(v), v)
    chosen.push(c)
    if (chosen.length === want) break
  }
  return chosen.map((c) => orderLoop(c.edges, ends, letters))
}

function highestBit(v: bigint): number {
  return v.toString(2).length - 1
}

/** The letters of a simple cycle given by its edges, from its smallest letter towards the smaller neighbour. */
function orderLoop(edges: readonly number[], ends: readonly (readonly [number, number])[], letters: readonly Letter[]):
  Letter[] {
  if (edges.length === 1) return [letters[ends[edges[0]!]![0]]!]
  const next = new Map<number, { to: number; edge: number }[]>()
  for (const e of edges) {
    const [u, v] = ends[e]!
    next.set(u, [...(next.get(u) ?? []), { to: v, edge: e }])
    next.set(v, [...(next.get(v) ?? []), { to: u, edge: e }])
  }
  const start = Math.min(...next.keys())
  const out = [start]
  const first = [...next.get(start)!].sort((x, y) => x.to - y.to)[0]!
  let usedEdge = first.edge
  let cur = first.to
  while (cur !== start) {
    out.push(cur)
    const step = next.get(cur)!.find((s) => s.edge !== usedEdge)!
    usedEdge = step.edge
    cur = step.to
  }
  return out.map((i) => letters[i]!)
}

/**
 * The first key press k in [from, to] (1-based, counted from windows `start`) at which the MIDDLE rotor steps
 * (a carry from the right rotor or the double step), or null. `rotors` and `start` are LEFT → RIGHT (3, or 4 on the
 * M4, whose Greek rotor never steps). Crib positions ≥ k are enciphered with a different middle rotor, so a bombe
 * menu must not use them.
 */
export function turnoverWithin(rotors: readonly RotorName[], start: string, from: number, to: number): number | null {
  const s = up(start)
  if (s.length !== rotors.length || rotors.length < 3) {
    throw new RangeError(`Expected one start letter per rotor, got ${JSON.stringify(start)} for ${rotors.length}`)
  }
  const k = rotors.length
  const [M, R] = [rotors[k - 2]!, rotors[k - 1]!]
  let m = letterToIndex(s[k - 2]!)
  let r = letterToIndex(s[k - 1]!)
  const at = (rotor: RotorName, p: number) => ROTORS[rotor].turnovers.includes(String.fromCharCode(65 + p))
  for (let press = 1; press <= to; press++) {
    const rightAt = at(R, r)
    const middleAt = at(M, m)
    r = (r + 1) % 26
    if (rightAt || middleAt) {
      if (press >= from) return press
      m = (m + 1) % 26
    }
  }
  return null
}
