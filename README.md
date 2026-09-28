# enigma-simulator

This enigma-simulator project is an educational tool which simulates the
workings of an [Enigma machine][wiki-enigma], the Germans' main military
encryption tool during [World War II][wiki-ww2]. The software allows users to
encrypt and decrypt messages. Additionally, the simulation includes a
step-by-step guide that teaches users how to recover Enigma keys.

This project was created and maintained by the [National Security Agency][nsa].

The repository now holds two things:

- **The original notebooks** at the repository root (`BreakingEnigma.ipynb`, `MasterEnigmaCracker.ipynb`,
  `machine.py`, `components.py`, `rejewski.py`): the NSA's Python simulator and key-recovery guide, unchanged.
  Their conventions are historical to this code: the first rotor listed is the fast rotor, there are no ring
  settings and no double step.
- **The interactive course** in [`web/`](web/): a browser app that teaches how the Enigma worked and how it was
  broken, from a single key press to a whole day's key, with a 3D machine you can operate.

## The interactive Enigma course

A story-driven course in four acts. Every idea is something you do on a working machine: you press keys and watch
the current flow through the plugboard, the rotors and the reflector, in 3D or in a 2D view, with a synchronised
trace. Before a key idea is revealed you place a bet; to move on you pass a short gate of freshly generated
exercises (predict a lamp, set the machine, spot the cycle, write a small function), with graded hints, a rollback
that shows where your reasoning left the machine's path, and no timers. A sandbox machine (`#/machine`) lets you
encipher anything and share the exact setting as a link.

| Act | Chapters |
| --- | --- |
| Prologue | A new key every day |
| I · The machine | I.1 Anatomy of a key press · I.2 Stepping and rings · I.3 Reflector and plugboard · I.4 The machine as permutations |
| II · Warsaw | II.5 The doubled indicator · II.6 Cycles and the theorem · II.7 The cyclometer and the catalogue · II.8 Zygalski sheets (optional) |
| III · Bletchley | III.9 Cribs · III.10 Menus and loops · III.11 The bombe · III.12 Checking the stops |
| IV · Capstone | Break a day |

Twelve chapters in Acts I–III, framed by the Prologue and the Act IV capstone. Chapters unlock in order; your
progress stays in your browser.

### Run it

Node 22.12 or later:

```sh
cd web
npm ci
npm run dev                          # http://localhost:5173/enigma-simulator/
npm run build && npm run preview     # the production build, as GitHub Pages serves it
```

[`web/README.md`](web/README.md) is the developer guide: architecture, scripts, URL flags, testing, bundle
budgets and the e2e contracts (`window.__enigma`, `window.__stage`, `window.__course`).

### Accuracy

The TypeScript engine (`web/src/engine/`) implements Enigma I, M3 and M4 with rings, the double step and the
plugboard, and is checked against three independent oracles:

- `tools/reference_enigma.py`: an independent Python implementation that passes the published vectors (AAAAA →
  BDZGO, rings BBB → EWTYX, the 1930 manual message, Barbarossa 1941, U-264's M4 message, Scharnhorst, and M4
  Beta at A with B-thin ≡ M3 with UKW-B);
- `web/src/engine/__fixtures__/vectors.json`: those vectors exported by `tools/export_vectors.py`; CI fails if the
  file is stale;
- `tools/oracles/`: three-oracle agreement over 1,000 random configurations with `@ondoher/enigma` and
  `py-enigma` (`.github/workflows/oracles.yml`).

Every exercise is generated from a seed and graded by the same engine, so every answer the course accepts is one
the machine really gives.

### How it was built and reviewed

The course was built as a stack of pull requests against the integration branch
`claude/intelligent-hamilton-r0i6wz`, following the build plan in [`docs/PLAN.md`](docs/PLAN.md): contracts first,
then the machine, the lesson engine and the 3D view, one pilot chapter, then the chapters in parallel.
`web/ownership.json` and `web/scripts/ownership-check.mjs` kept each PR to its own files.

Each PR is reviewed by an independent review agent that builds it, walks the UI in headless Chromium at 1280 px
and 390 px with motion reduced and full, in 2D and 3D, reads the screenshots, runs axe, checks the console, and
tries to game the gates (guessing, pasting an agent's code, reading the page state); findings are fixed and
re-reviewed. CI (`.github/workflows/web.yml`) runs typecheck, unit tests, the build, bundle budgets and the
ownership check; the e2e suite in 2D and 3D; the full course walk in 2D and 3D; and the Pages artifact build.

| PR | Branch | What |
| --- | --- | --- |
| [#1](https://github.com/abazabaaa/enigma-simulator/pull/1) | 01-foundation | Vite/React scaffold and the historically accurate engine |
| [#3](https://github.com/abazabaaa/enigma-simulator/pull/3) | 02-platform | Platform, contracts v1, stage host, CI |
| [#2](https://github.com/abazabaaa/enigma-simulator/pull/2) | 03-oracles | Three-oracle agreement tests |
| [#5](https://github.com/abazabaaa/enigma-simulator/pull/5) | 04-machine-ui | DOM machine, trace, 2D stage, sandbox |
| [#7](https://github.com/abazabaaa/enigma-simulator/pull/7) | 05-lesson | Lesson engine: gates, hints, progress, code runner |
| [#6](https://github.com/abazabaaa/enigma-simulator/pull/6) | 06-machine3d-core | The procedural 3D machine |
| [#8](https://github.com/abazabaaa/enigma-simulator/pull/8) | 07-pilot-i2 | Pilot chapter I.2 |
| [#4](https://github.com/abazabaaa/enigma-simulator/pull/4) | 08-cryptokit | Crypto kit: Rejewski's attack, cribs, menus, the bombe, 2D views |
| [#10](https://github.com/abazabaaa/enigma-simulator/pull/10) | 09-act1-a | Prologue, I.1, the home page |
| [#9](https://github.com/abazabaaa/enigma-simulator/pull/9) | 10-act1-b | I.3, I.4 |
| [#11](https://github.com/abazabaaa/enigma-simulator/pull/11) | 11-machine3d-signal | 3D signal path, ghost path, reflector arcs, cables, Bloom |
| [#13](https://github.com/abazabaaa/enigma-simulator/pull/13) | 12-act2-a | II.5, II.6 |
| [#14](https://github.com/abazabaaa/enigma-simulator/pull/14) | 13-act2-b | II.7, II.8 |
| [#12](https://github.com/abazabaaa/enigma-simulator/pull/12) | 14-act3-a | III.9, III.10 |
| [#15](https://github.com/abazabaaa/enigma-simulator/pull/15) | 15-act3-b | III.11, III.12 |
| #16 | 16-capstone | The Act IV capstone (until it merges, the capstone is a placeholder scene) |
| 17 | 17-release | CodeMirror editor, release specs (a11y, phone layout, deploy), README, the assembled app |

### Deploying (two steps for the repository owner)

1. Merge the release PR into the integration branch `claude/intelligent-hamilton-r0i6wz`, then merge that
   branch into `master`.
2. Set **Settings → Pages → Source = GitHub Actions** once.

The push to `master` runs the `deploy` job, and the course appears at
`https://<owner>.github.io/enigma-simulator/`.

## License

See [LICENSE](LICENSE). The original simulator and notebooks were created by the
[National Security Agency][nsa]; portions were created by the U.S. Government.

[nsa]: https://www.nsa.gov
[wiki-enigma]: https://en.wikipedia.org/wiki/Enigma_machine
[wiki-ww2]: https://en.wikipedia.org/wiki/World_War_II
