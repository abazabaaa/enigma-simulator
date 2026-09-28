# Enigma web app

An interactive, story-driven explainer of how the Enigma machine worked and how it was broken.
This directory holds the web app: Vite 8, React 19, TypeScript 6 (strict), Tailwind CSS 4, Zustand 5,
Vitest 5 and Playwright 1.56. The Python code at the repository root is the original simulator and
is not used by the app.

## Quick start

```sh
cd web
npm ci
npm run dev        # http://localhost:5173/enigma-simulator/
```

Or serve the production build exactly as GitHub Pages will: `npm run build && npm run preview`
(http://localhost:4173/enigma-simulator/).

`docs/PLAN.md` (repository root) is the build plan; its §3 holds the interface contracts in
`src/contracts/`. Besides the course (`#/course`) and the sandbox machine (`#/machine`), useful pages
are `#/lab/stage` (every stage preset on a demo machine), `#/lab/viz` (the crypto views), `#/lab/fixture`
(the lesson engine's fixture chapter) and `#/engine` (the engine as text: type A–Z).

## Scripts

| Script               | What it does                                                                  |
| -------------------- | ----------------------------------------------------------------------------- |
| `npm run dev`        | Vite dev server                                                               |
| `npm run build`      | `vite build` into `dist/`, then `scripts/postbuild.mjs` copies `index.html` to `404.html` |
| `npm run preview`    | Serve `dist/` (same base path as GitHub Pages)                                |
| `npm run typecheck`  | `tsc -b`: app, unit tests (`tsconfig.test.json`), configs and e2e specs       |
| `npm test`           | Vitest, run once: `src/**/*.test.{ts,tsx}`, at most 2 workers                 |
| `npm run test:watch` | Vitest in watch mode                                                          |
| `npm run check`      | typecheck, test, build, `scripts/budget.mjs`, `scripts/ownership-check.mjs`: run before every push |
| `npm run e2e`        | Playwright, projects `2d` and `3d` (builds, then runs `vite preview`)         |
| `npm run e2e:pr`     | Playwright, project `2d` only                                                 |
| `npm run e2e:3d`     | Playwright, project `3d` only                                                 |
| `npm run e2e:walk`   | Playwright, the course walk (`@walk`) on the 2D stage; `npx playwright test --project=walk-3d` walks it on the 3D stage |
| `npm run review`     | The headless review walk (`playwright.review.config.ts`, specs in `e2e/review/`, output in `review-artifacts/`) |

Every Playwright command needs **`E2E_PORT`** outside CI (the config refuses to start without it):
builders use `41NN` and reviewers `51NN`, where NN is the PR number, so agents sharing the machine
never collide. CI defaults to 4173. Example: `E2E_PORT=4102 npm run e2e:pr -- --grep "@smoke|@platform"`.

**Budgets** (`scripts/budget.mjs`, from `dist/.vite/manifest.json`, gzip): entry chunk ≤ 170 kB;
the 3D view (`src/machine3d/index.tsx` and its static imports) ≤ 400 kB and never in the entry;
effects ≤ 130 kB; each chapter chunk ≤ 80 kB; the code editor (`src/code/CodeEditor.tsx` plus the
CodeMirror module it lazy-loads, `src/code/codemirror.tsx`) ≤ 150 kB.

Python helpers (run them from the repository root, no dependencies needed):

```sh
python3 tools/reference_enigma.py          # independent oracle: PASS/FAIL per vector, exit 1 on failure
python3 tools/export_vectors.py            # regenerate src/engine/__fixtures__/vectors.json
python3 tools/export_vectors.py --check    # CI: fail if the committed JSON is stale
```

The JSON fixture is committed, so the TypeScript tests never need Python. Never edit it by hand.

## Flags

URL flags go **before** the hash, so they survive navigation between routes
(`/enigma-simulator/?e2e=1&stage=2d#/lab/stage?preset=pawls`). They are parsed by `src/lib/flags.ts`.

| Flag                  | Effect                                                                            |
| --------------------- | --------------------------------------------------------------------------------- |
| `?e2e=1`              | Enables the e2e-only hooks (`__course.completeTasks`, `unlockAll`, …); remembered for the tab in sessionStorage; `?e2e=0` clears it |
| `?stage=2d` / `3d`    | Forces the 2D view, or asks for 3D (used only when the 3D view exists and WebGL 2 works) |
| `?motion=reduce`/`full` | Overrides reduced motion (beats the stored preference and `prefers-reduced-motion`) |
| `?seed=<salt>`        | Fixes the progress salt                                                           |

Routes (PLAN §2.3): `#/`, `#/course`, `#/c/:chapter[/:scene]`, `#/machine?k=<codec>`, `#/engine`,
`#/lab/stage?preset=<id>&locks=<csv>&model=<I|M3|M4>&ghost=demo&toy=6|8`, `#/lab/fixture[/:scene]`,
`#/lab/gate/:chapter/:gate` and `#/lab/viz`. A path-style link (`/enigma-simulator/course`, served
by `404.html` on GitHub Pages) is rewritten to the hash route at startup.

## Testing

- **Unit tests (Vitest)** live next to the code as `*.test.ts`, or `*.test.tsx` whose first line is
  `// @vitest-environment happy-dom`. The engine suites cover every published vector, the stepping
  and ring rules, the trace, validation and property tests; the platform suites cover the contracts'
  pure helpers, the stores (locks, hold, setters, isolation), playback, toys, key-space figures,
  StageHost, the ownership check and the bans below.
- **End-to-end tests (Playwright)** in `e2e/` drive the production build through `window.__enigma`,
  `window.__stage` and `window.__course`, asserting state, never pixels. Every spec
  `import { test, expect } from './fixtures'`, which fails the test on any console error, page error,
  failed same-origin request or unexpected WebGL context loss (`allowContextLoss()` opts out), and
  opens pages with `gotoApp(page, '/route', { stage })` from `e2e/helpers/app.ts`.
- **Projects and tags.** Each spec carries a tag: `@smoke`, `@platform`, `@area:<x>`, `@chapter:<id>`,
  `@3d`, `@sync` or `@walk`. Project `2d` runs everything but `@3d` and `@walk`, with the 2D stage and
  reduced motion; project `3d` runs `@3d` and `@sync`; projects `walk` and `walk-3d` run `@walk` on the
  2D and the 3D stage. Locally use one worker (the default) and run only your own tags plus
  `@smoke|@platform`; CI runs everything.
- **Release specs** (`@area:release`, in project `2d`): `a11y.spec.ts` (axe, no serious or critical
  finding on every route, every chapter's first scene, a gate's rollback and hint, the code item; the
  code editor never traps Tab), `layout.spec.ts` (390×844: no sideways page scroll on any route, wide
  content scrolls inside its box) and `release.spec.ts` (the `/enigma-simulator/` build: budgets,
  404.html, deep links, path-style links through 404.html, the share URL round trip, lazy chunks).
  Their route list is `e2e/helpers/routes.ts`; add a route there and all three cover it.
- **The code editor** is CodeMirror 6 (lazily loaded; a textarea if its chunk fails to load). The test
  id `code-editor` sits on the editable element, so `getByTestId('code-editor').fill(source)` works;
  read the text back from `localStorage['enigma.code.<itemKey>']`, not with `toHaveValue`. Tab indents;
  Esc then Tab leaves the editor.
- **Load-sensitive suites.** The dev box is shared by several agents (4 CPUs, load average 15–25), so
  a few suites carry longer per-test limits with unchanged assertions: the guess bot 300 s per gate and
  the CC learner 120 s per source (`src/lesson/guessBot.test.ts`); `runBombe` 300 s and the
  propagate/test-register checks 120 s (`src/crypto/bombe.test.ts`); the review walk 600 s per chapter
  (`e2e/review/walk.review.spec.ts`); the walk 240 s in 2D and 480 s in 3D. Run Vitest with
  `VITEST_MAX_WORKERS=1` (or 2) and Playwright with `--workers=1`; rerun a load timeout alone before
  treating it as a failure, and never weaken an assertion to pass.
- **Bans** (`src/lint/bans.test.ts`): no `waitForTimeout`, `test.only`, `page.pause` or
  `toHaveScreenshot` in `e2e/`; no `console.log` in `src/` outside `src/debug`; no `.solve(` and no
  1900–1949 years in chapter scenes or `items.tsx`.
- `@playwright/test` is pinned to exactly **1.56.0**, which matches the Chromium 141 build installed
  in the dev container at `/opt/pw-browsers` (`PLAYWRIGHT_BROWSERS_PATH`). In that container never run
  `npx playwright install`. CI runners install their own browser with
  `npx playwright install --with-deps chromium`.
- Chromium runs headless with SwiftShader (`--use-gl=angle --use-angle=swiftshader
  --enable-unsafe-swiftshader --ignore-gpu-blocklist`), so WebGL 2 works without a GPU.
- **Gaming detection** (`src/lesson/rules.ts`): `fast` = the last two answers each under 2 s;
  `ladder` = three wrong answers within 5 s in total; `reveals` = two reveals among the last six.
  A gaming fallback (set-the-machine) always starts at hint level 0 with its own attempt window.

## Ownership

`ownership.json` maps every PR of the build plan to the files it may change (repository-root globs:
`owns`, `stubs` it creates for another PR, and `amend` paths allowed only in a commit whose message
carries the tag, e.g. PR 07's `[contracts-v2]`). `scripts/ownership-check.mjs` runs inside
`npm run check`: on a branch `claude/enigma/NN-*` every file touched by a non-merge commit since the
base must belong to PR NN. The rules are read from the base, so a PR cannot grant itself files.
For a stacked PR set `OWNERSHIP_BASE=origin/<base branch>` (the default is the integration branch);
other branches print `ownership: skipped`. Only the coordinator edits `ownership.json` after PR 02.

## Base path and deployment

`vite.config.ts` sets `base: '/enigma-simulator/'` for GitHub Pages. Override it with the
`VITE_BASE` environment variable (for example `VITE_BASE=/ npm run build`); `playwright.config.ts`
reads the same variable, so the e2e tests always match the build. Routing uses the URL hash
(`#/engine`) because GitHub Pages has no SPA fallback.

`.github/workflows/web.yml` runs on pushes to `master` and the integration branch, on every pull
request and on demand. Jobs: `check` (Python oracle, `tools/export_*.py --check`, `npm run check`
with the ownership base of the PR), `e2e` (project `2d` in two shards, the release specs included),
`e2e-3d`, `walk` (pushes only; projects `walk` and `walk-3d`), `pages-artifact` (pushes to the
integration branch or `master`: builds with `VITE_BASE=/enigma-simulator/`, checks the asset base,
404.html and the budgets, and uploads the Pages artifact) and `deploy` (`master` only).

**Deploy handoff** (two steps only the repository owner can take): merge the integration branch into
`master`, and set the one-off repository setting **Settings → Pages → Source: GitHub Actions**. The
push to `master` then runs `deploy`, and the site appears at `https://<owner>.github.io/enigma-simulator/`.

## Source layout

```
docs/PLAN.md         the build plan (repository root)
web/
  ownership.json     which PR owns which files; scripts/ownership-check.mjs enforces it
  scripts/           ownership-check.mjs, budget.mjs, postbuild.mjs
  src/
    engine/          pure TypeScript Enigma engine: no dependencies, no React (public API: index.ts)
    contracts/       the interface contracts (PLAN §3): types plus pure helpers (STAGE_PRESETS,
                     resolveStage, dimmedParts, hopAt, …). Frozen at [contracts-v1]
    lib/             rng (seeded), memoise (seeded-generator caches), toy (6/8-letter machines),
                     keyspace (BigInt figures), symbols (slot colours) and Sym, storage, flags,
                     reducedMotion
    state/           machineStore (createMachineStore, locks), activeMachine (MachineProvider),
                     playbackStore (the only animation clock), stageStore, toyStore, uiStore, sync
    stage/           StageHost (3D or 2D), StagePlaceholder, stageApi (window.__stage)
    stage2d/         the SVG stage (PR 04)
    machine3d/       the 3D machine (PRs 06, 11); ready.ts gates it
    machine-ui/      the DOM machine: keyboard, lamps, rotors, plugboard, trace, tape (PR 04)
    lesson/, code/   the lesson runtime, the code runner and the CodeMirror editor (PRs 05, 17)
    crypto/, viz/    Rejewski and bombe kits and their views (PR 08)
    content/         registry.ts: the 14 chapters, each loaded lazily
    chapters/<id>/   one folder per chapter: index.ts, gates.ts (pure), items.tsx, facts.ts, scenes/
    pages/           one lazily loaded page per route; App.tsx maps routes to pages
    debug/           window.__enigma
    lint/            bans and ownership-check tests
    router.ts        hash router: useRoute() → { path, pattern, params, query }
  e2e/               Playwright specs, fixtures.ts, helpers/
```

## `window.__stage` (e2e contract)

Installed in every build by `src/stage/stageApi.ts` (types in `src/contracts/hooks.ts`):
`info()` returns the latest `StageReport` of the mounted view (renderer, focus, dimmed, highlighted,
litLamp, windows, hop, pathPoints, ghost) plus the resolved `directive` and the playback `seq` and
`t`; `playback()` returns `{ t, hops, seq, playing, gated }`; `stats()` returns the 3D renderer stats,
or `null` when no 3D view is mounted. `dimmed` always equals `dimmedParts(focus, model)` from
`src/contracts/stage.ts`, which e2e specs import in Node to compare.

## Engine conventions

- **Rotor order.** `config.rotors`, `config.rings`, `config.positions` and `state.positions` are
  listed LEFT → RIGHT as the operator sees them. The **rightmost rotor is the fast rotor**. On the M4
  the leftmost entry is the Greek rotor (Beta or Gamma), which never steps.
- **Letters.** Rings and start positions in a config are letters (`'A'` is ring setting 01).
  `state.positions` holds the *current* window positions as indices (A = 0). `config.positions`
  is the start.
- **Stepping comes first.** A key press steps the rotors, then the current flows. With R, M and L the
  three rightmost rotors: M steps if R is at its turnover *or* M is at its own turnover (the double
  step); L steps if M is at its turnover; R always steps. Turnover letters are the window letters
  before the carry (Q, E, V, J, Z; Z and M for VI–VIII).
- **Rings.** With window position p and ring setting r the core is offset by o = (p − r) mod 26:
  `forward(x) = (W[(x + o) mod 26] − o) mod 26`, and backward uses W⁻¹. The ring moves the wiring
  relative to the alphabet ring. The notch is fixed to the alphabet ring, so the turnover test uses
  the window letter.
- **Composition order.** Permutations compose **left to right**: `compose(p, q)` applies `p` first,
  then `q`, so `compose(p, q)[i] === q[p[i]]`. Then (ab)(cd)(ef) · (bc)(de)(fa) = (ace)(bfd), and
  Rejewski's AD is `compose(A, D)`. `conjugate(p, by)` is by⁻¹·p·by, which relabels p's cycles through
  `by`. `cycleSignature` returns cycle lengths in descending order, fixed points included.
- **Non-letters.** `encipher` uppercases letters and drops every other character by default. A
  dropped character is not enciphered and does not step the rotors, as on the real 26-key keyboard.
  `{ keepNonLetters: true }` copies such characters through unchanged, still without stepping.
  `pressKey`/`encodeLetter` throw `RangeError` for a non-letter, and `pressKey` does not step when it
  throws.
- **Validation.** `createMachine` enforces each model's rules and throws `EnigmaConfigError`, whose
  `problems` field lists every issue; `validateConfig` returns the same list without throwing. The
  rules: Enigma I takes rotors I–V and UKW A/B/C; M3 takes I–VIII and B/C; M4 takes Beta/Gamma plus
  three of I–VIII and B-thin/C-thin. No rotor may appear twice. The plugboard takes at most 13
  pairs, and no letter may appear in two pairs.

### Trace stages

`encodeLetter` and `pressKey` return a `trace` with one entry per stage, in this order. A 3-rotor
machine has 11 stages; the M4 adds the two `greek` stages for 13:

```
plugboard-in, etw-in,
rotor-right-fwd, rotor-middle-fwd, rotor-left-fwd, [rotor-greek-fwd],
reflector,
[rotor-greek-bwd], rotor-left-bwd, rotor-middle-bwd, rotor-right-bwd,
etw-out, plugboard-out
```

Every entry has `stage`, `kind`, `input`, `output`, `inputIndex` and `outputIndex`. Letters are in
the fixed frame of the machine, meaning the ETW contact they face. Rotor entries also carry `rotor`,
`slot`, `slotIndex`, `direction` (`fwd`/`bwd`), `window`, `position`, `ring`, `offset` and the core
contacts `entryContact` → `exitContact`. These contacts are indices into the rotor's wiring table,
so a forward wire satisfies `wiring[entryContact] === letter(exitContact)`. Core contact k faces the
fixed contact (k − offset) mod 26. Plugboard entries carry `plugged`, and the reflector entry
carries `reflector`.

## `window.__enigma` (e2e and debugging contract)

`window.__enigma` is installed in dev and production builds before React renders. It reads and
drives the same Zustand store as the UI.

```ts
window.__enigma: {
  version: 1                                        // bumped on breaking changes
  getState(): EnigmaSnapshot                        // plain JSON
  pressKey(letter: string): Letter                  // one key press; returns the lamp. Throws
                                                    // MachineLockedError while locks.keyboard is set
  setConfig(cfg: Partial<MachineConfigInput>): EnigmaSnapshot
                                                    // merged into the current config, validated
                                                    // (throws EnigmaConfigError), then reset
  reset(): EnigmaSnapshot                           // back to the start positions, tape cleared
}

EnigmaSnapshot = {
  config: MachineConfig        // normalised: rings/positions as letter arrays, plugboard as pairs
  positions: string            // current windows, e.g. "ADU"
  input: string                // letters pressed since the last reset or setConfig
  output: string               // lamps lit since then
  lamp: Letter | null          // last lamp
  lastStepping: { stepped: { left, middle, right }, doubleStep, before: string, after: string } | null
  lastTrace: TraceStep[] | null
}
```

Example: `__enigma.setConfig({ rotors: ['I','II','III'], rings: 'AAA', positions: 'AAA' })`, then
`'AAAAA'` pressed key by key lights `BDZGO` and leaves the windows at `AAF`.
