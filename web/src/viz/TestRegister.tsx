import type { JSX } from 'react'
import type { TestRegisterProps } from './types'

/** STUB (API freeze): the view lands in the next commits of PR 08. */
export function TestRegister(p: TestRegisterProps): JSX.Element {
  return <div data-testid={p.testId ?? 'test-register'} data-stub="TestRegister" />
}
