import { useState } from 'react'
import { CourseMap, ProgressNotices, useProgress } from '../lesson'
import { now } from '../lesson/clock'
import { progressSnapshot } from '../lesson/progress'
import { BUTTON, QUIET_BUTTON } from '../lesson/ui/controls'

/** #/course: the act map with lock states and bets, reset (with a confirmation) and export as JSON. */
export function CoursePage() {
  const [confirming, setConfirming] = useState(false)
  const reset = useProgress((s) => s.reset)
  const exportJson = () => {
    const blob = new Blob([JSON.stringify(progressSnapshot(), null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'enigma-progress.json'
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8">
      <h1 className="text-3xl font-semibold text-stone-100">The course</h1>
      <ProgressNotices />
      <CourseMap heading={false} />
      <section className="flex flex-wrap items-center gap-3 border-t border-stone-800 pt-4">
        <button type="button" data-testid="course-export" className={QUIET_BUTTON} onClick={exportJson}>
          Export progress (JSON)
        </button>
        {confirming ? (
          <span className="flex flex-wrap items-center gap-2" role="alertdialog" aria-label="Confirm reset">
            <span className="text-sm text-stone-300">Erase all progress?</span>
            <button
              type="button"
              data-testid="course-reset-confirm"
              className={BUTTON}
              onClick={() => {
                reset(now())
                setConfirming(false)
              }}
            >
              Yes, reset
            </button>
            <button type="button" data-testid="course-reset-cancel" className={QUIET_BUTTON} onClick={() => setConfirming(false)}>
              Cancel
            </button>
          </span>
        ) : (
          <button type="button" data-testid="course-reset" className={QUIET_BUTTON} onClick={() => setConfirming(true)}>
            Reset progress
          </button>
        )}
      </section>
    </main>
  )
}
