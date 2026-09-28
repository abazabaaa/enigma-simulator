/**
 * The course: 14 chapters (PLAN §2.4, §4.4). Each chapter loads lazily as its own chunk. After 02,
 * no PR edits this file: a chapter PR replaces only its own src/chapters/<id>/ folder.
 * A chapter is locked until the previous REQUIRED chapter (by order) is complete; II.8 is optional.
 */

import { CHAPTER_IDS, type ActId, type ChapterId } from '../contracts/core'
import type { ChapterMeta } from '../contracts/lesson'

export const CHAPTERS: readonly ChapterMeta[] = [
  {
    id: 'prologue',
    act: 'P',
    order: 0,
    title: 'A new key every day',
    dates: '1918',
    load: () => import('../chapters/prologue/index.ts'),
  },
  {
    id: 'i1-anatomy',
    act: 'I',
    order: 1,
    title: 'Anatomy of a key press',
    dates: '1927–1937',
    load: () => import('../chapters/i1-anatomy/index.ts'),
  },
  {
    id: 'i2-stepping',
    act: 'I',
    order: 2,
    title: 'Stepping and rings',
    dates: '1932',
    load: () => import('../chapters/i2-stepping/index.ts'),
  },
  {
    id: 'i3-reflector-plugboard',
    act: 'I',
    order: 3,
    title: 'Reflector and plugboard',
    dates: '1939',
    load: () => import('../chapters/i3-reflector-plugboard/index.ts'),
  },
  {
    id: 'i4-permutations',
    act: 'I',
    order: 4,
    title: 'The machine as permutations',
    dates: '1932',
    load: () => import('../chapters/i4-permutations/index.ts'),
  },
  {
    id: 'ii5-indicators',
    act: 'II',
    order: 5,
    title: 'The doubled indicator',
    dates: '1932',
    load: () => import('../chapters/ii5-indicators/index.ts'),
  },
  {
    id: 'ii6-cycles',
    act: 'II',
    order: 6,
    title: 'Cycles the plugboard cannot hide',
    dates: '1932',
    load: () => import('../chapters/ii6-cycles/index.ts'),
  },
  {
    id: 'ii7-catalogue',
    act: 'II',
    order: 7,
    title: 'The cyclometer and the catalogue',
    dates: '1934–1937',
    load: () => import('../chapters/ii7-catalogue/index.ts'),
  },
  {
    id: 'ii8-sheets',
    act: 'II',
    order: 8,
    title: 'Zygalski sheets',
    dates: '1938',
    optional: true,
    load: () => import('../chapters/ii8-sheets/index.ts'),
  },
  {
    id: 'iii9-cribs',
    act: 'III',
    order: 9,
    title: 'Cribs',
    dates: '1939–1940',
    load: () => import('../chapters/iii9-cribs/index.ts'),
  },
  {
    id: 'iii10-menus',
    act: 'III',
    order: 10,
    title: 'Menus and loops',
    dates: '1939',
    load: () => import('../chapters/iii10-menus/index.ts'),
  },
  {
    id: 'iii11-bombe',
    act: 'III',
    order: 11,
    title: 'The bombe',
    dates: '1940',
    load: () => import('../chapters/iii11-bombe/index.ts'),
  },
  {
    id: 'iii12-checking',
    act: 'III',
    order: 12,
    title: 'Checking the stops',
    dates: '1940–1941',
    load: () => import('../chapters/iii12-checking/index.ts'),
  },
  {
    id: 'iv-capstone',
    act: 'IV',
    order: 13,
    title: 'Capstone: break a day',
    dates: '1936–1940',
    load: () => import('../chapters/iv-capstone/index.ts'),
  },
]

export const ACTS: readonly { readonly id: ActId; readonly title: string }[] = [
  { id: 'P', title: 'Prologue' },
  { id: 'I', title: 'Act I: the machine' },
  { id: 'II', title: 'Act II: Warsaw' },
  { id: 'III', title: 'Act III: Bletchley' },
  { id: 'IV', title: 'Act IV: capstone' },
]

export function chapterMeta(id: string): ChapterMeta | undefined {
  return CHAPTERS.find((c) => c.id === id)
}

export function isChapterId(id: unknown): id is ChapterId {
  return typeof id === 'string' && (CHAPTER_IDS as readonly string[]).includes(id)
}
