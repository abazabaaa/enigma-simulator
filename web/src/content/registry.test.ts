import { describe, expect, it } from 'vitest'
import { CHAPTER_IDS } from '../contracts/core'
import { ACTS, CHAPTERS, chapterMeta, isChapterId } from './registry'

describe('chapter registry (V13)', () => {
  it('lists the 14 chapters in course order with unique orders 0–13', () => {
    expect(CHAPTERS.map((c) => c.id)).toEqual([...CHAPTER_IDS])
    expect(CHAPTERS.map((c) => c.order)).toEqual(Array.from({ length: 14 }, (_, i) => i))
  })

  it('assigns acts P, I×4, II×4, III×4, IV', () => {
    expect(CHAPTERS.map((c) => c.act).join(' ')).toBe('P I I I I II II II II III III III III IV')
    for (const c of CHAPTERS) expect(ACTS.map((a) => a.id)).toContain(c.act)
  })

  it('marks only II.8 optional and gives every chapter a title and dates', () => {
    expect(CHAPTERS.filter((c) => c.optional).map((c) => c.id)).toEqual(['ii8-sheets'])
    for (const c of CHAPTERS) {
      expect(c.title.length).toBeGreaterThan(3)
      expect(c.dates).toMatch(/^\d{4}(–\d{4})?$/)
    }
  })

  it('loads each chapter module with a matching id', async () => {
    for (const c of CHAPTERS) {
      const mod = await c.load()
      expect(mod.default.id).toBe(c.id)
      expect(mod.default.scenes.length).toBeGreaterThan(0)
    }
  })

  it('titles never give a chapter\'s bet away (II.6: whether the plugboard changes the cycles is its bet)', () => {
    expect(chapterMeta('ii6-cycles')?.title).toBe('Cycles and the theorem')
    for (const c of CHAPTERS) expect(c.title, c.id).not.toMatch(/cannot hide|plugboard can(?:no|')t/i)
  })

  it('looks chapters up by id', () => {
    expect(chapterMeta('ii6-cycles')?.order).toBe(6)
    expect(chapterMeta('nope')).toBeUndefined()
    expect(isChapterId('iv-capstone')).toBe(true)
    expect(isChapterId('lab-fixture')).toBe(false)
  })
})
