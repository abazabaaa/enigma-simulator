import { Component, type ReactNode } from 'react'

/**
 * Catches errors thrown by the 3D view, including a failed lazy import, and hands them to
 * StageHost's onError (fallback to 2D). main.tsx reports errors caught here as console.warn.
 */
export class StageErrorBoundary extends Component<
  { onError: (e: unknown) => void; children: ReactNode },
  { failed: boolean }
> {
  override state = { failed: false }
  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true }
  }
  override componentDidCatch(error: unknown): void {
    this.props.onError(error)
  }
  override render(): ReactNode {
    return this.state.failed ? null : this.props.children
  }
}
