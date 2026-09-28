/** STUB (02 → 09). 09 builds the guided entry: the stage, "type a word", Begin and the course map. */
export function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center gap-6 px-6 py-16">
      <p className="font-mono text-sm tracking-[0.3em] text-amber-400/80 uppercase">Interactive history</p>
      <h1 className="text-4xl font-semibold text-stone-100 sm:text-5xl">Enigma: how it worked, how it was broken</h1>
      <p className="text-lg leading-relaxed text-stone-400">
        Press a key and follow the current through the plugboard, three turning rotors and the reflector. Then
        step into the shoes of Rejewski, Turing and Welchman and break it yourself.
      </p>
      <nav className="flex gap-4 font-mono text-sm">
        <a className="text-amber-300 underline" href="#/course">
          The course
        </a>
        <a className="text-amber-300 underline" href="#/machine">
          The machine
        </a>
      </nav>
    </main>
  )
}
