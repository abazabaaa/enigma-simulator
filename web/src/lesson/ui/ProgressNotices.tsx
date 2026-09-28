import type { JSX } from 'react'
import { useProgress } from '../progress'
import { QUIET_BUTTON } from './controls'

/** The corrupt-progress notice and the storage-failure banner (PLAN §2.2 item 8). */
export function ProgressNotices(): JSX.Element | null {
  const notice = useProgress((s) => s.notice)
  const dismiss = useProgress((s) => s.dismissNotice)
  if (!notice.corrupt && !notice.storageFailed) return null
  return (
    <div className="flex flex-col gap-2">
      {notice.corrupt ? (
        <div role="status" data-testid="progress-notice" className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-amber-600 bg-amber-950/40 p-2 text-sm text-amber-100">
          <span>Your saved progress could not be read, so it was set aside and you are starting fresh.</span>
          <button type="button" className={QUIET_BUTTON} onClick={dismiss}>
            OK
          </button>
        </div>
      ) : null}
      {notice.storageFailed ? (
        <div role="status" data-testid="storage-banner" className="rounded-md border border-stone-600 bg-stone-900 p-2 text-sm text-stone-300">
          This browser is not letting the page save: your progress lasts only until you close the tab.
        </div>
      ) : null}
    </div>
  )
}
