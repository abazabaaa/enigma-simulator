import { useRoute } from '../router'

/** STUB (02 → 05). #/lab/gate/:chapter/:gate: any gate alone, for review. */
export function GateLabPage() {
  const { params } = useRoute()
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-3xl font-semibold text-stone-100">
        Gate lab: {params.chapter}/{params.gate}
      </h1>
      <p className="mt-4 text-stone-400">The gate runtime is on its way.</p>
    </main>
  )
}
