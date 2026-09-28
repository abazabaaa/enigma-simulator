/**
 * Focus helpers shared by SceneFrame and GateRunner. A control is only a focus target when it can take the
 * focus now: a locked keyboard (disabled, aria-disabled or inside an inert subtree, as 04's is) is skipped, so
 * a set-machine item whose keyboard precedes its own controls focuses those controls, not a dead key.
 */

/** An answer widget's controls, in document order (review round 3: never an aria-disabled one). */
export const ANSWER_CONTROL =
  '[data-role="answer"] :is(input, textarea, select, button, [tabindex="0"]):not([disabled]):not([aria-disabled="true"]):not([tabindex="-1"])'

/** Focusable now: not disabled (itself or by a fieldset), not aria-disabled, not in an inert subtree, not -1. */
export function usable(el: Element): boolean {
  return (
    !el.matches(':disabled') &&
    el.getAttribute('aria-disabled') !== 'true' &&
    el.getAttribute('tabindex') !== '-1' &&
    el.closest('[inert]') === null &&
    // :disabled already covers a disabled fieldset in browsers; said again for DOMs that miss it (happy-dom).
    (el.tagName === 'FIELDSET' || el.closest('fieldset[disabled]') === null)
  )
}

/** The first element under `root` matching `selector` that can take the focus now, or null. */
export function firstUsable(root: ParentNode | null | undefined, selector: string): HTMLElement | null {
  if (!root) return null
  for (const el of root.querySelectorAll<HTMLElement>(selector)) if (usable(el)) return el
  return null
}

/**
 * Focus `resolve()` now, and for the next `frames` frames put it back if the focus was lost meanwhile (to
 * <body>, or because the focused control became disabled or inert when a lock landed after this render).
 */
export function focusSettled(resolve: () => HTMLElement | null, frames = 3): void {
  let n = 0
  const run = (): void => {
    const active = document.activeElement
    const lost = !active || active === document.body || !usable(active)
    if (n === 0 || lost) resolve()?.focus()
    if (++n <= frames) requestAnimationFrame(run)
  }
  run()
}
