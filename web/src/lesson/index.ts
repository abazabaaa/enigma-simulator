/**
 * The lesson runtime's public surface for pages and chapters (PLAN §6.4). Chapters' gates.ts must NOT import
 * this file (it pulls in React): pure item logic imports lesson/kinds and lesson/rules only.
 */

import { installCourseApi } from './courseApi'
import { installPrefsSync } from './prefsSync'

installCourseApi()
installPrefsSync()

export { bindGates } from './bind'
export { CourseMap } from './ui/CourseMap'
export { ChapterPlayer } from './ui/ChapterPlayer'
export { LockedPage } from './ui/LockedPage'
export { ProgressNotices } from './ui/ProgressNotices'
export { GateRunner } from './ui/GateRunner'
export { RevealButton, useRevealFired } from './ui/bets'
export { ActClock, StoryScene } from './ui/StoryScene'
export { LetterTable, Mono, SubmitButton, BUTTON, QUIET_BUTTON, INPUT } from './ui/controls'
export { partLabel, partList, partName } from './partNames'
export { useProgress } from './progress'
export { isLocked, previousRequired, nextChapter } from './flow'
