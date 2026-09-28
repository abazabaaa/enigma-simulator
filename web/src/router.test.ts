import { describe, expect, it } from 'vitest'
import { ROUTE_PATTERNS, hrefFor, matchRoute, parseHash } from './router'

describe('matchRoute', () => {
  it('matches literal and :param segments', () => {
    expect(matchRoute('/c/:chapter', '/c/i2-stepping')).toEqual({ chapter: 'i2-stepping' })
    expect(matchRoute('/c/:chapter/:scene', '/c/i2-stepping/gate')).toEqual({ chapter: 'i2-stepping', scene: 'gate' })
    expect(matchRoute('/c/:chapter', '/c/i2-stepping/gate')).toBeNull()
    expect(matchRoute('/course', '/course')).toEqual({})
    expect(matchRoute('/course', '/courses')).toBeNull()
    expect(matchRoute('/', '/')).toEqual({})
    expect(matchRoute('/c/:chapter', '/c/a%20b')).toEqual({ chapter: 'a b' })
    expect(matchRoute('/c/:chapter', '/c/%E0%A4%A')).toBeNull()
  })
})

describe('parseHash', () => {
  it('parses #/path?query', () => {
    expect(parseHash('#/lab/stage?preset=pawls&locks=keyboard,positions')).toEqual({
      path: '/lab/stage',
      pattern: '/lab/stage',
      params: {},
      query: { preset: 'pawls', locks: 'keyboard,positions' },
    })
    expect(parseHash('#/lab/gate/i2-stepping/stepping')).toMatchObject({
      pattern: '/lab/gate/:chapter/:gate',
      params: { chapter: 'i2-stepping', gate: 'stepping' },
    })
    expect(parseHash('#/machine?k=I.B.I-II-III.01-01-01.ADU.AV-BS').query.k).toBe('I.B.I-II-III.01-01-01.ADU.AV-BS')
  })

  it('defaults to / and reports unknown paths', () => {
    expect(parseHash('')).toMatchObject({ path: '/', pattern: '/' })
    expect(parseHash('#')).toMatchObject({ path: '/', pattern: '/' })
    expect(parseHash('#engine')).toMatchObject({ path: '/engine', pattern: '/engine' })
    expect(parseHash('#/nowhere')).toEqual({ path: '/nowhere', pattern: null, params: {}, query: {} })
  })

  it('has a pattern for every route of PLAN §2.3', () => {
    const hashes = ['#/', '#/course', '#/c/x', '#/c/x/y', '#/machine', '#/engine', '#/lab/stage']
    hashes.push('#/lab/fixture', '#/lab/fixture/s', '#/lab/gate/c/g', '#/lab/viz')
    for (const hash of hashes) {
      expect(parseHash(hash).pattern, hash).not.toBeNull()
    }
    expect(ROUTE_PATTERNS).toHaveLength(11)
  })
})

describe('hrefFor', () => {
  it('builds a hash with an optional query', () => {
    expect(hrefFor('/course')).toBe('#/course')
    expect(hrefFor('/lab/stage', { preset: 'wire', toy: '6' })).toBe('#/lab/stage?preset=wire&toy=6')
    expect(parseHash(hrefFor('/lab/stage', { locks: 'a,b' })).query).toEqual({ locks: 'a,b' })
  })
})
