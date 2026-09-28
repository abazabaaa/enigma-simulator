# Enigma course: final build plan

**This is the one plan the executing agents follow.** §3 (contracts) and §4 (chapters and gates) are normative. Where the three earlier plans disagree with this document, this document is right.

- **Spine.** The spine is the parallel-engineering-first plan. It had the highest combined judge score (96.25, against 93.25 for risk-first and 83.25 for learner-first). From it this plan takes:
  - the `[contracts-v1]` checkpoint commit;
  - the StageHost with a 2D fallback, so no chapter waits for 3D;
  - `ownership.json`, enforced inside `npm run check`;
  - a single crypto kit whose API is frozen before any chapter uses it;
  - the `configure()` test hooks;
  - the oracle job.
- **Taken from learner-first:** bet-gated reveals, ghost-path rollback, `once` items for transfer and fixed-answer probes, the pairing validator, the `relabel` and `board-myth` items, per-slot symbol colours, the machine-store factory, and the reviewer's solvability check.
- **Taken from risk-first:**
  - e2e fixtures that fail on any console error;
  - the five-reading sync spec;
  - the 300-seed manifest lint;
  - a no-leak test API with answers computed in Node;
  - loophole probes and a screenshot checklist;
  - the L0/L1/L2 3D fallback ladder and `stats()` budgets;
  - `keyspace.ts`, `maxLines`, and quarantine of corrupt progress.
- **Judge findings.** Every "mustFix" from the three judges is resolved; §9.2 maps each one to the section that resolves it.

**Repository.** The repository is github.com/abazabaaa/enigma-simulator, cloned at `/home/user/enigma-simulator`. The Python simulator at the root stays untouched. The integration branch is `claude/intelligent-hamilton-r0i6wz`. PR branches are named `claude/enigma/NN-name`, and each has a worktree at `/home/user/wt/NN-name`.

---

## 1. Product summary

A static web app (hash-routed, deployed to GitHub Pages under `/enigma-simulator/`) that teaches an adult self-taught programmer, who codes with AI agents, how Enigma worked and how it was broken. It is built on a verified engine and a gate framework that an agent cannot pass for the learner.

1. **Guided entry.** The first screen shows the whole machine with a single affordance, "type a word". Typing the ciphertext back returns the word.
2. **The machine.** It can be operated in 3D and through real DOM controls:
   - 26 `<button>` keys;
   - window spinbuttons showing letters, ring spinbuttons showing 01–26;
   - a plugboard pair list and a model select (Enigma I, M3, M4);
   - an `aria-live` announcer, for example "Q lights E. Rotors now A E W.";
   - a paper tape with copy/paste;
   - a shareable URL.
3. **The signal path** glows through the machine and stays in step with an 11-row (M4: 13-row) per-stage letter trace. It has a speed control and a scrub control. Rotors step first, pawl against notch, including the double step. Each rotor is two layers: the alphabet ring with its notch, and the wiring core. The reflector shows its 13 pairs, and the plugboard cables are crossed twice.
4. **Four acts, 14 chapters, one scene at a time.** The acts are the Prologue plus Act I (the machine), Act II (Warsaw), Act III (Bletchley) and a capstone. Each scene isolates one component, with the rest dimmed.
5. **Bets and gates.**
   - Every first-time reveal is preceded by a bet.
   - Every Next sits behind a gate.
   - A gate passes on 2 of 3 fresh randomised instances, or on a single `once` item for fixed-answer probes and transfer.
   - The hint ladder runs: withhold → highlight → worked example on a different instance → reveal plus a fresh instance.
   - A wrong answer animates the learner's own answer and shows where it diverges.
6. **Code gates** ask for functions of about ten lines and always pair a typed prediction with an in-page item. The page openly offers "Copy brief for your agent".
7. **Two novel artefacts:**
   - Rejewski's cycle attack: AD/BE/CF from indicators, cycle lengths invariant under the stecker, cyclometer, catalogue lookup, and plugboard recovery.
   - A bombe with a live wire-state view (8 wires, then 26), a test register, and a diagonal-board toggle.
8. **Story beats** are short interstitials about real, dated people, taken from sourced `facts.ts` files. An act-boundary "clock" motivates but never times anything.
9. **Retrieval practice.**
   - Recall items interleaved across earlier acts open Acts II and III and the capstone.
   - A short mixed check runs on return visits.
   - There are no timers, hearts or streaks.
   - Progress is saved in localStorage.
   - The app has full keyboard and reduced-motion parity.
10. **Verification.**
    - Engine vectors plus three independent oracles.
    - State-based Playwright e2e for every route and chapter.
    - A headless review-agent walkthrough per PR.
    - A course walk on every integration push.
    - Zero console errors.

---

## 2. Architecture

### 2.0 The foundation as built (PR 01, `claude/enigma/01-foundation`, `/home/user/wt/01-foundation`)

Everything below was verified by reading the code, and later PRs rely on it.

- **Toolchain.** `web/` uses Vite 8, React 19, TypeScript ~6 (strict, with `erasableSyntaxOnly`, so no enums, namespaces or parameter properties), Tailwind 4, zustand 5, Vitest 5 and **@playwright/test 1.56.0**. Code style: 2-space indent, no semicolons, single quotes, lines of about 120 columns.
- **Engine: alphabet and permutations** (`web/src/engine/index.ts`):
  - Alphabet: `Letter`, `LETTERS`, `letterToIndex`, `indexToLetter`, `mod`, `toLetters`.
  - Permutations: `Perm = readonly number[]`. `compose(p, q)` applies p first, so `compose(p,q)[i] === q[p[i]]`. `inverse`. `conjugate(p, by) = by⁻¹·p·by`. `cycles`. `cycleSignature` gives lengths in descending order, fixed points included. Also `fromPairs`, `fromCycles`, `fromWiring`, `formatCycles`, `isInvolution`, `fixedPoints`, `identity`, `shift`.
- **Engine: wiring.**
  - Tables: `ROTORS`, `REFLECTORS`, `MODELS`, `ROTOR_PERMS`, `REFLECTOR_PERMS`, `KEYBOARD_ROWS`.
  - Names: `RotorName` is I–VIII, Beta or Gamma. `ReflectorName` is A, B, C, B-thin or C-thin. `ModelName` is I, M3 or M4.
- **Engine: machine.**
  - `MachineConfig` is `{model, reflector, rotors, rings, positions, plugboard}`. Rotors are listed left to right; rings and positions are letters; the plugboard is a list of pairs.
  - `MachineConfigInput`. `MachineState` is `{config, positions}`, where `positions` holds the *current* windows as indices.
  - `createMachine`. `validateConfig`, which is strict per model: I takes rotors I–V and UKW A/B/C; M3 takes I–VIII and B/C; M4 takes Beta/Gamma plus three of I–VIII and B-thin/C-thin.
  - `normalizeConfig`, `withPositions`.
  - `step(state)` returns `{state, stepped{left,middle,right}, doubleStep}`.
  - `encodeLetter(state, l)` returns `{output, trace}` and does **not** step.
  - `pressKey(state, l)` returns `{state, output, trace, stepping{stepped, doubleStep, before, after}}`.
  - Also `encipher`, `isAtTurnover(rotor, position)`, `rotorPermutation(rotor, ring, position)`, `machinePermutation(state)`, `positionsToString`, `slotNames`, `DEFAULT_CONFIG`, and `EnigmaConfigError{problems}`.
- **Trace.** A 3-rotor machine produces 11 stages; the M4 produces 13. In order: `plugboard-in, etw-in, rotor-right-fwd, rotor-middle-fwd, rotor-left-fwd, [rotor-greek-fwd], reflector, [rotor-greek-bwd], rotor-left-bwd, rotor-middle-bwd, rotor-right-bwd, etw-out, plugboard-out`.
  - Every step carries `{kind, stage, input, output, inputIndex, outputIndex}`.
  - Rotor steps add `rotor, slot, slotIndex, direction, window, position, ring, offset, entryContact, exitContact`.
  - Plugboard steps carry `plugged`; the reflector step carries `reflector`.
- **Store.** `state/machineStore.ts` exports `useMachineStore`. Its state interface is `MachineStore {machine, input, output, last: PressResult|null, pressKey, setConfig, reset}`.
- **Test API.** `debug/windowApi.ts` installs `window.__enigma` v1:
  - `getState()` returns `{config, positions:'ADU', input, output, lamp, lastStepping{stepped,doubleStep,before,after}, lastTrace}`;
  - `pressKey(l)` returns the lamp;
  - `setConfig(partial)` merges into the current config, validates, and resets;
  - `reset()`.
- **Routing.** `router.ts` is a hash router with `useRoute()`. The `App.tsx` `ROUTES` table has `'/'` (HomePage placeholder) and `'/engine'` (EngineDevPage).
- **Playwright.** testDir `e2e`. One project, `chromium`, with the SwiftShader flags. The webServer runs `npm run build && npm run preview --host 127.0.0.1 --port $E2E_PORT --strictPort`; the base URL is `http://127.0.0.1:$PORT/enigma-simulator/`. `reuseExistingServer: !CI` is fixed by 02.
- **Vitest.** `include: ['src/**/*.test.ts']`, `environment: 'node'`; widened by 02.
- **Python tools.**
  - `tools/reference_enigma.py` is an independent oracle.
  - `tools/export_vectors.py` supports `--check`.
  - `src/engine/__fixtures__/vectors.json` holds 19 cases.
- **CI.** `.github/workflows/web.yml` runs on pushes to master, on PRs, and on `workflow_dispatch`. Jobs: the Python oracle, `npm run check`, and Playwright. The Pages artifact and the deploy step run on master only.
- **Pages.** GitHub Pages needs a one-off repository setting, which is a **user** action.

### 2.1 Directory layout (owner PR in brackets; `→` marks an ownership transfer of a stub)

```
web/
  package.json, package-lock.json, vite.config.ts, playwright.config.ts, playwright.review.config.ts,
  tsconfig.json, tsconfig.app.json, tsconfig.node.json, index.html, ownership.json      [02]
  scripts/ownership-check.mjs, scripts/budget.mjs, scripts/postbuild.mjs                 [02]
  src/
    engine/            [01] frozen. 03 adds __tests__/oracles.test.ts and __fixtures__/oracle-vectors.json
    contracts/         [02] core, machine, stage, lesson, code, progress, hooks (§3). Frozen at [contracts-v1];
                            one additive amendment commit [contracts-v2] allowed in 07
    lib/               [02] rng, toy, keyspace, symbols, Sym.tsx, storage, flags, reducedMotion
    state/             [02] machineStore.ts (01 file, extended), activeMachine.tsx, playbackStore, stageStore,
                            toyStore, uiStore, sync
    stage/             [02] StageHost, StagePlaceholder, stageApi (window.__stage)
    stage2d/           [02 stub → 04] index.tsx (Stage2D)
    machine-ui/        [02 stub index.ts → 04] Keyboard, Lampboard, RotorControls, PlugboardEditor, ModelSelect,
                            TracePanel, PlaybackBar, Announcer, PaperTape, PermTable, MachinePanel, urlCodec
    machine3d/         [02 stubs ready.ts, index.tsx → 06] core: Canvas, layout, CameraRig, Case, Keys, Lamps,
                            Sockets, Etw, RotorStack, Pawls, focus, labels, debug.
                       [06 stubs → 11] signal/, effects/, parts/Reflector.tsx, parts/Cables.tsx, parts/ToyGeometry.tsx
    lesson/            [05] rules, kinds/, bind, chapterMachine, progress, runtime UI, recall/, fixture/, courseApi,
                            validate(.test), lint.test, guessBot.test, purity.test
    code/              [05] runner.worker.ts, runner.ts, CodeItem.tsx, CodeEditor.tsx (textarea; → 17 for CodeMirror)
    crypto/            [08] pure kit, *.worker.ts, *Client.ts, data/rejewski65.ts
    viz/               [08] CycleDiagram, CycleAlign, CatalogueHistogram, LightTable, CribStrip, MenuGraph, WireGrid,
                            TestRegister
    content/registry.ts[02] 14 ChapterMeta with lazy load()
    chapters/<id>/     [02 placeholder index.ts → chapter PR] index.ts, gates.ts (pure), items.tsx, facts.ts,
                            scenes/*.tsx, __tests__/*.test.ts
    pages/             HomePage [01 → 02 stub → 09]; CoursePage, ChapterPage, GateLabPage, FixturePage [02 stubs → 05];
                       SandboxPage [02 stub → 04]; StageLabPage [02]; VizLabPage [02 stub → 08]; EngineDevPage [01]
    debug/windowApi.ts [01 → 02]
    App.tsx, router.ts, main.tsx, index.css     [02]
    lint/bans.test.ts                           [02]
  e2e/
    fixtures.ts, helpers/app.ts, smoke.spec.ts, platform.spec.ts, deploy.spec.ts            [02]; engine.spec.ts [01]
    helpers/machine.ts, machine-ui.spec.ts, sync.spec.ts, stage2d.spec.ts                   [04]
    helpers/course.ts, lesson.spec.ts, course.spec.ts, walk.spec.ts, review/**              [05]
    machine3d.spec.ts [06]; viz.spec.ts [08]; machine3d-signal.spec.ts [11]
    chapters/<id>.spec.ts [chapter PR]; home.spec.ts [09]; a11y.spec.ts, layout.spec.ts, release.spec.ts [17]
tools/oracles/**, .github/workflows/oracles.yml   [03]
.github/workflows/web.yml                        [02 → 17]
CLAUDE.md                                        [coordinator]
```

### 2.2 State model

1. **Engine.** Pure and immutable. Only stores and pure item logic call it.
2. **Machine store.** 01's `useMachineStore`, extended by 02 and never forked, is the only writer of machine state. `createMachineStore()` builds extra instances for a second machine: the II.7 cyclometer and the III.12 checking machine. Those instances are passed down through `<MachineProvider>`.
   - DOM keys, physical keys, 3D key clicks, set-the-machine items and `window.__enigma` all call the store's actions.
   - Locks live in the store. The setters enforce them. `setConfig` and `setLocks` form the setup path and ignore locks.
3. **Toy store.** Same shape, for the 6- and 8-letter toy machines built with `lib/toy.ts`.
4. **Playback store.** The only animation clock.
   - `t` runs over `[0, 1+hops]`: `[0,1)` is the stepping phase and hop k is live during `[1+k, 2+k)`.
   - A single `usePlaybackClock()` in App advances it with requestAnimationFrame.
   - Speed `'instant'` and reduced motion jump straight to the end.
   - `gated` pins `t = 0` while a bet is pending.
5. **Stage store.** Holds the resolved `StageDirective` of the current scene or item, the highlights (hint L1 and rollback), and the ghost path (rollback). The 2D and 3D views read it.
6. **UI store.** Renderer preference (`auto|3d|2d`), motion (`system|reduce|full`), labels and speed. They are persisted through `ProgressV1.prefs`.
7. **Lesson flow.** A chapter's flow is an XState v5 machine with one flat state per scene and no history states. `NEXT` is guarded by `canAdvance`, and `GOTO(i)` is allowed only for `i ≤ reached`. Scoring is the **pure reducer** of §3.5, applied to `ItemRecord`s; XState never holds scores. The machine is rebuilt from `ProgressV1` on every mount, never from a snapshot, to avoid xstate#5178.
8. **Persistence.** zustand `persist` writes plain JSON to `localStorage['enigma.progress.v1']`.
   - The current instance's seed is persisted, so a reload never rerolls it.
   - A corrupt value or a value of another version is moved to `enigma.progress.corrupt`, progress starts fresh, and a notice is shown.
   - If storage throws, progress is kept in memory and a banner says so.

Data flows one way: an input calls a store action; `state/sync.ts` sees the new `seq` and calls `playback.play`; every view renders from `(machine store, playback, stage store)`.

### 2.3 Routing

The hash router is extended by 02 to parse `#/path?query`. Flags go **before** the hash: `?e2e=1` enables the e2e-only hooks, `?stage=2d|3d` forces a renderer, `?motion=reduce|full` overrides motion, and `?seed=<salt>` fixes the progress salt.

| Route | Page (owner) | Notes |
|---|---|---|
| `#/` | HomePage (09) | Guided entry with the stage (`type-a-word` preset), a single "type a word" affordance, "Begin" to the Prologue, and the course map below |
| `#/course` | CoursePage (05) | Act map, progress, reset, export as JSON |
| `#/c/:chapter` and `#/c/:chapter/:scene` | ChapterPage (05) | Locked chapter shows `LockedPage`. A scene beyond `reached` redirects to `reached` |
| `#/machine?k=<codec>` | SandboxPage (04) | Full machine with share URL, tape and M4. No bets |
| `#/engine` | EngineDevPage (01) | Unchanged |
| `#/lab/stage?preset=<id>&locks=<csv>&model=<I\|M3\|M4>&ghost=demo&toy=6\|8` | StageLabPage (02) | Every preset on a demo machine, for 04, 06 and 11. `ghost=demo` sets a fixed divergent ghost path; `toy=` switches the source to a toy |
| `#/lab/fixture[/:scene]` | FixturePage (05) | Hidden fixture chapter using every generic kind |
| `#/lab/gate/:chapter/:gate` | GateLabPage (05) | Any gate alone, for review |
| `#/lab/viz` | VizLabPage (08) | Every crypto view with fixture data |

A chapter is locked until the previous **required** chapter, by `order`, is complete. II.8 is optional and never blocks III.9.

### 2.4 Content model

Content is plain TSX; there is no MDX. `content/registry.ts` lists 14 `ChapterMeta` entries with `load: () => import('../chapters/<id>/index.ts')`, one code-split chunk each. 02 creates a placeholder `chapters/<id>/index.ts` for each chapter: a single story scene reading "Being written". Each chapter PR replaces its own folder. **After 02, no PR edits a shared registry.**

Each `chapters/<id>/` folder contains:
- `gates.ts`: **pure** item logic (`export const GATES: ChapterGates`). It never imports React, three, the DOM, `import.meta` or `?worker`, so both Vitest and Playwright in Node can import it.
- `items.tsx`: `export const ITEM_UI: ItemUiMap`, the Prompt, Answer, Worked and Feedback components for each item.
- `facts.ts`: `export const FACTS: readonly Fact[]`, every date and number shown, each with an https source.
- `scenes/*.tsx`: the scene `View` components.
- `index.ts`: `export default { id, scenes, gates: bindGates(GATES, ITEM_UI), facts: FACTS } satisfies ChapterDef`.

Scene kinds:
- `story`: a data-only card rendered by the framework, at most 120 words, naming a person and a date taken from the chapter's facts, with an optional static act clock. Next is always enabled.
- `explore`: a view plus tasks completed by real actions, and bets that gate each first-time reveal.
- `gate`: one gate whose items are presented one at a time.
- `recall`: a gate the runtime builds from the recall pool (§4.2).

### 2.5 Sync between 3D, trace and DOM

There is **one write path**. DOM keys (`key-X`), physical keydown, 3D key clicks and `__enigma.pressKey` all call `useMachineStore.getState().pressKey`.
- The physical-key listener ignores key events while focus is in a text field and while `locks.keyboard` is set.
- `state/sync.ts` subscribes to `seq` and calls `playback.play('machine', seq, last.trace.length)`. The toy store works the same way with `'toy'`.

Every reader renders from `(last, t)`:
- **Lamps**, in the DOM and in 3D, are lit when `isLit(t)`.
- **`TracePanel`**: the stepping row is live during `[0,1)`; row k is lit when `hopAt(t) ≥ k`.
- **Window displays**, meaning the spinbuttons, the 2D windows and the 3D ring angles, show `stepping.before` while `t < 1`. They interpolate in 3D during `[0,1)` and show `after` once `t ≥ 1`.
- **`Announcer`** speaks once, when the lamp is lit.
- **Scrubbing** writes only `t`.

Because every view is a function of the same `(last, t)`, the views cannot drift apart. The canvas is `aria-hidden`; the DOM is the accessible surface.

**Sync spec** (04 runs it in 2D, 11 in 3D). At speed `instant`, it presses 50 random keys on random configurations. After every press, five readings must agree:
1. `__enigma.getState().lamp`;
2. the `data-output` of `trace-row-<last>`, the plugboard-out row;
3. `__stage.info().litLamp`;
4. the lamp letter parsed from the announcer;
5. the windows. The spinbuttons' `aria-valuetext` joined together, `__stage.info().windows` and `__enigma.getState().positions` must all be equal.

### 2.6 Rendering

- **StageHost (02).** It takes a `StageRef` and resolves it through the stage store.
  - It renders the 3D view when `MACHINE_3D_READY` (from `machine3d/ready.ts`) is true, WebGL2 is available, and neither `?stage=2d` nor the preference `'2d'` is set. The 3D view is lazy-loaded with `React.lazy(() => import('../machine3d'))`.
  - Otherwise it renders `Stage2D`, from `stage2d/`.
  - If Stage2D is still the 02 stub, it renders `StagePlaceholder`, which prints the directive as text.
  - On `onError` (context loss or shader failure) it switches to 2D for the rest of the session and logs `console.warn`, never `console.error`.
- **Stage2D (04).** An SVG "flattened circuit" with n contacts per column: keys/lamps | plugboard | ETW (H) | R (N) | M | L | (G) | UKW (U).
  - It draws the forward and return paths up to `t`, the window letters, and a ring band offset by the ring setting.
  - Each rotor has pawl and notch marks, and each part has a label.
  - Parts are dimmed through `dimmedParts()`. Highlights pulse, or show a static outline under reduced motion. A ghost path is drawn dashed in `--sym-ghost` against the reference in `--sym-reference`.
  - It renders the toy for n ∈ {6, 8}. It is the default renderer for reduced motion without WebGL, and for 2D e2e runs.
- **Machine3D (06 core, 11 signal).**
  - `<Canvas frameloop="demand" dpr={[1,1.5]}>` calls `invalidate()` on store changes.
  - `CameraRig` uses drei `CameraControls` with named shots. Under reduced motion, shot changes are cuts.
  - The case has a lid (closed, open, cutaway). The keyboard, lampboard and plug sockets are drei `<Instances>`. Lit lamps use emissive intensity above 1 with `toneMapped={false}`.
  - Each rotor has two separately rotating groups: an **AlphabetRing** (26 troika glyphs plus an extruded notch plate, angle = window) and a **WiringCore** (instanced contacts in the slot's symbol colour, angle = offset). Each slot also has pawls and a notch.
  - The **signal (11)** is a `TubeGeometry` over a `CatmullRomCurve3` through `pathPoints()`, drawn up to `t`, with an emissive head at `getPointAt`. The ghost tube is red, the reference gold, and a marker sits at `divergeAt`.
  - 11 also adds the reflector as 13 arcs, plug cables as tubes, Bloom (`luminanceThreshold 1`, `mipmapBlur`) in a separate lazy chunk that `PerformanceMonitor` drops when the frame rate falls, the M4 fourth slot, and toy geometry for n = 6 and n = 8.
  - All geometry is procedural, at 1 unit = 1 cm, with **at most 120 draw calls**.
- **Symbol colours.** Colours belong to slots, not to rotor types:
  - S = plugboard, H = ETW, N = right rotor, M = middle, L = left, G = Greek, U = reflector;
  - plus `signal`, `ghost`, `reference` and `dim`.

  They are defined once in `lib/symbols.ts` (`SYMBOL_COLORS`), written as CSS variables `--sym-*` at startup, and read by the 3D materials through `symbolColor()`. The colour of N in an equation is therefore the colour of the right rotor.
- **Rings versus positions.** Positions are always letters and rings are always 01–26, in the DOM, in 2D, in 3D labels and in prompts.
- **Reduced motion** comes from `prefers-reduced-motion` or the preference. Playback becomes instant, so the whole path is drawn at once. Camera moves become cuts, and pulses become static outlines. Motion is otherwise kept.
- **Code splitting.** The entry chunk holds only the shell and engine. Pages, each chapter, the 3D view, effects and the code editor load lazily. Budgets are in §7.1.

### 2.7 Test hooks

- **`window.__enigma`** (01, v1, unchanged shape). It drives the default store. Since 02, `pressKey` throws `MachineLockedError` while `locks.keyboard` is set.
- **`window.__stage`** (02): `info()`, `stats()` and `playback()` (§3.9). It is present in production builds.
- **`window.__course`** (05): `where()`, `gate()`, `answer()`, `continue()`, `bet()`, `next()`, `lastCheck()`, `events()` and `progress()`. `gate()` returns instance parameters and **never answers**.
  - `completeTasks`, `unlockAll`, `resetProgress` and `configure` throw unless the page was opened with `?e2e=1`.
  - e2e computes answers **in Node**, by importing the pure `gates.ts` (§3.13 L4).

### 2.8 Build, CI and deploy

- **`npm run build`** runs `vite build && node scripts/postbuild.mjs`. The postbuild step copies `dist/index.html` to `dist/404.html`. `build.manifest: true` is set for the budget script.
- **`npm run check`** runs typecheck, then Vitest, then build, then `scripts/budget.mjs`, then `scripts/ownership-check.mjs`.
- **`.github/workflows/web.yml`** (02, later 17):
  - Triggers: push to `master` **and** `claude/intelligent-hamilton-r0i6wz`, `pull_request`, and `workflow_dispatch`. `timeout-minutes: 30`.
  - `check` job: the Python oracle, a loop running `tools/export_*.py --check`, `npm ci`, and `npm run check`. For pull requests it sets `OWNERSHIP_BASE=origin/${{ github.base_ref }}` and `OWNERSHIP_PR=${{ github.head_ref }}`, and uses `fetch-depth: 0`.
  - `e2e` job: a matrix with `shard: [1, 2]` running `npx playwright install --with-deps chromium` and then `npx playwright test --project=2d --shard=${{ matrix.shard }}/2`.
  - `e2e-3d` job: `--project=3d`.
  - `walk` job: runs on push and dispatch only, with `--project=walk`.
  - `pages-artifact` job: runs on push to integration **or** master. It builds with `VITE_BASE=/enigma-simulator/` and runs `actions/upload-pages-artifact`. This is the in-session **deploy-ready** proof.
  - `deploy` job: runs on push to `master` only.
  - On failure, the Playwright report is uploaded.
- **Merging to master** and setting **Settings → Pages → Source = GitHub Actions** are an explicit **user handoff** (§7.6).
- **`.github/workflows/oracles.yml`** (03) is a separate workflow. It runs on pushes and PRs that touch `tools/oracles/**` or `web/src/engine/**`.

---
## 3. Interface contracts (normative)

**How the contracts are landed and changed**
- 02 lands these contracts in its first commit, whose message contains `[contracts-v1]`. The commit includes pure runtime helpers such as `CHAPTER_IDS`, `STAGE_PRESETS`, `resolveStage`, `dimmedParts` and `hopAt`. Signatures marked `declare` are implemented by the PR named in the comment.
- After `[contracts-v1]`, only **additive, optional** changes are allowed, and they must be batched in 07's single `[contracts-v2]` commit. Anything else needs a coordinator hotfix PR (numbers 90–99).
- Every field is `readonly` in the real files.
- Instances and answers must survive a JSON round trip; this is enforced by the lint, not by the type system, because engine interfaces are not assignable to index-signature `Json` types.

### 3.1 Core, rng, keyspace, symbols (02)

```ts
// contracts/core.ts
export type { Letter, Perm, RotorSlot, RotorName, ReflectorName, ModelName, MachineConfig, MachineConfigInput,
  MachineState, PressResult, TraceStep, TraceStage, StepInfo } from '../engine'
export const CHAPTER_IDS = ['prologue', 'i1-anatomy', 'i2-stepping', 'i3-reflector-plugboard', 'i4-permutations',
  'ii5-indicators', 'ii6-cycles', 'ii7-catalogue', 'ii8-sheets', 'iii9-cribs', 'iii10-menus', 'iii11-bombe',
  'iii12-checking', 'iv-capstone'] as const
export type ChapterId = (typeof CHAPTER_IDS)[number]
export const LAB_CHAPTER_ID = 'lab-fixture'
export type AnyChapterId = ChapterId | typeof LAB_CHAPTER_ID
export type ActId = 'P' | 'I' | 'II' | 'III' | 'IV'
export type GateKey = `${AnyChapterId}/${string}`            // chapter/gateId
export type ItemKey = `${AnyChapterId}/${string}/${string}`  // chapter/gateId/itemId
export type BetKey = `${AnyChapterId}/${string}`             // chapter/betId
export interface Choice { id: string; label: string; misconception?: true }

// lib/rng.ts — Rng is a bare function so modules built on 01 need no import from 02
export type Rng = () => number
export declare function createRng(seed: number): Rng        // mulberry32, identical to engine/__tests__/helpers.ts
export declare function seedFor(...parts: readonly (string | number)[]): number  // FNV-1a 32-bit of parts.join('\u001f')
export declare function int(r: Rng, n: number): number      // 0 ≤ k < n
export declare function pick<T>(r: Rng, xs: readonly T[]): T
export declare function shuffle<T>(r: Rng, xs: readonly T[]): T[]
export declare function sample<T>(r: Rng, xs: readonly T[], k: number): T[]   // k distinct
export declare function randLetter(r: Rng, n?: number): Letter                // among the first n letters (default 26)
export declare function randomPerm(r: Rng, n: number): number[]
export declare function randomInvolution(r: Rng, n: number, pairs: number): number[]
export declare function randomConfig(r: Rng, o?: { model?: ModelName; rotorsFrom?: readonly RotorName[];
  reflector?: ReflectorName; plugs?: number | readonly [number, number]; rings?: 'AAA' | 'random' }): MachineConfig
  // always passes validateConfig; defaults: model I, rotors I–V, UKW-B, rings random, 0–10 plugs

// lib/keyspace.ts — every figure shown in the app is computed here (BigInt), never typed
export declare function plugboardCount(pairs: number): bigint     // 26!/((26−2p)!·p!·2^p); 10 → 150738274937250n
export declare function keyspace(o?: { orders?: bigint; pairs?: number; rings?: boolean }): bigint
  // default 60n × 17576n × plugboardCount(10) = 158962555217826360000n; rings: × 676n
export declare function pairedPartitions(): number                // 101 (cycle types of AD = partitions of 13)
export declare const CATALOGUE_SETTINGS: 105456                   // 6 × 17,576
export declare function formatSci(n: bigint, digits?: number): string   // '1.59 × 10²⁰'

// lib/symbols.ts (+ lib/Sym.tsx)
export type Sym = 'S' | 'H' | 'N' | 'M' | 'L' | 'G' | 'U'
export type Swatch = Sym | 'signal' | 'ghost' | 'reference' | 'dim'
export declare const SYM_FOR_PART: Readonly<Partial<Record<PartId, Sym>>>   // plugboard S, etw H, *-right N, *-middle M,
                                                                             // *-left L, *-greek G, reflector U
export declare function symForStage(stage: TraceStage): Sym
export declare const SYMBOL_COLORS: Readonly<Record<Swatch, { light: string; dark: string }>>
export declare function applySymbolTokens(root?: HTMLElement): void   // writes --sym-S … --sym-dim; main.tsx calls it once
export declare function symbolColor(s: Swatch, scheme: 'light' | 'dark'): string   // for 3D materials
export declare function Sym(p: { s: Sym; inv?: boolean }): JSX.Element               // coloured N or N⁻¹
```

### 3.2 Machine, playback and toy (02)

```ts
// contracts/machine.ts
import type { StoreApi, UseBoundStore } from 'zustand'
export type LockKey = 'model' | 'rotors' | 'reflector' | 'rings' | 'positions' | 'plugboard' | 'keyboard'
export interface MachineLocks {
  model?: boolean; rotors?: boolean; reflector?: boolean; rings?: boolean; positions?: boolean; plugboard?: boolean
  keyboard?: boolean     // DOM keys disabled; physical keys ignored; pressKey throws MachineLockedError
  hold?: boolean         // pressKey encodes WITHOUT stepping (I.1): state unchanged, stepping.before = after
  lampsHidden?: boolean  // lamps, trace outputs and the announcer's lamp text are concealed
}
export interface MachineStore {                   // 01's interface; 01 members kept verbatim
  machine: MachineState; input: string; output: string; last: PressResult | null
  pressKey: (letter: string) => PressResult       // throws MachineLockedError('keyboard') when locked
  setConfig: (config: MachineConfigInput) => void // setup path: ignores locks, clears the tape; keeps seq
  reset: () => void
  // added by 02
  seq: number                                     // +1 on every successful pressKey
  locks: MachineLocks
  setLocks: (locks: MachineLocks) => void         // replaces all locks (setup path)
  setPositions: (windows: string) => void         // lock 'positions'; clears `last`, keeps the tape
  setRing: (slotIndex: number, ring: Letter) => void          // lock 'rings'
  setRotor: (slotIndex: number, rotor: RotorName) => void     // lock 'rotors'; EnigmaConfigError if invalid for model
  setReflector: (reflector: ReflectorName) => void            // lock 'reflector'
  setModel: (model: ModelName) => void            // lock 'model'. I → rotors from I–V (defaults I II III), UKW-B;
                                                  // M3 → current rotors if valid, else I II III, UKW-B;
                                                  // M4 → Beta + current three (VI–VIII allowed), B-thin, ring/pos 'A'
  setPlugs: (pairs: readonly string[]) => void    // lock 'plugboard'
  togglePlug: (a: Letter, b: Letter) => void      // lock 'plugboard'; add a–b, or remove the pair containing a
  snapshot: () => MachineConfig                   // current config whose positions = CURRENT windows
}
export type MachineStoreHook = UseBoundStore<StoreApi<MachineStore>>
export declare class MachineLockedError extends Error { readonly lock: LockKey }   // state/machineStore.ts
// state/machineStore.ts
export declare function createMachineStore(init?: { config?: MachineConfigInput; locks?: MachineLocks }): MachineStoreHook
export declare const useMachineStore: MachineStoreHook          // default instance; __enigma and sync drive it
// state/activeMachine.tsx
export declare function MachineProvider(p: { store: MachineStoreHook; children: ReactNode }): JSX.Element
export declare function useMachine<T>(selector: (s: MachineStore) => T): T   // provider's store, else default
export declare function useMachineApi(): MachineStoreHook

// contracts/machine.ts — playback (state/playbackStore.ts)
export type Speed = 0.25 | 0.5 | 1 | 2 | 4 | 'instant'
export interface PlaybackStore {
  source: 'machine' | 'toy'; seq: number; hops: number
  t: number                     // 0 … 1 + hops. [0,1) stepping; hop k live on [1+k, 2+k); lit at 1 + hops
  playing: boolean; speed: Speed
  gated: boolean                // a pending bet: t pinned to 0, play() ignored
  play: (source: 'machine' | 'toy', seq: number, hops: number) => void   // instant speed or reduced motion → end
  scrub: (t: number) => void; finish: () => void; setSpeed: (s: Speed) => void
  tick: (dtMs: number) => void  // only usePlaybackClock() in App calls this
  setGated: (g: boolean) => void
}
export const STEP_MS = 400, HOP_MS = 150          // at speed 1; divided by speed
export declare function hopAt(t: number, hops: number): number   // −1 on [0,1); else min(hops−1, floor(t−1))
export declare function isLit(t: number, hops: number): boolean   // t ≥ 1 + hops
export declare const usePlaybackStore: UseBoundStore<StoreApi<PlaybackStore>>
export declare function usePlaybackClock(): void
// state/sync.ts
export declare function installSync(): void          // default machine store seq → playback.play; toy store likewise
export declare function setPendingBet(pending: boolean): void
  // true: remember the current locks.keyboard, set it, and set playback.gated; false: restore both

// contracts/machine.ts — toy (lib/toy.ts, state/toyStore.ts)
export interface ToySpec {
  n: 6 | 8                                  // letters A…F or A…H
  rotors: readonly (readonly number[])[]    // 1–3 rotors, LEFT → RIGHT, forward wirings on n letters
  notches: readonly number[]                // turnover window index per rotor
  reflector: readonly number[]              // fixed-point-free involution on n
  plugs: readonly number[]                  // involution on n; identity = no cables
  positions: readonly number[]
  stepping: boolean                         // false = held (I.1)
}
export interface ToyPress { spec: ToySpec; lamp: Letter; hops: readonly PathHop[]; stepping: StepInfo }
  // hops: plugboard-in, rotor fwd (right→left using slot names of the last k of left/middle/right), reflector,
  // rotor bwd, plugboard-out. No ETW.
export declare function toyPress(spec: ToySpec, key: Letter): ToyPress
export declare function toyPermutation(spec: ToySpec): number[]   // current scrambler including plugs, no stepping
export declare function randomToy(r: Rng, n: 6 | 8, rotors: 1 | 2 | 3, o?: { plugs?: number; stepping?: boolean }): ToySpec
export interface ToyStore { spec: ToySpec; seq: number; last: ToyPress | null
  press: (key: Letter) => ToyPress; setSpec: (s: ToySpec) => void; reset: () => void }
export declare const useToyStore: UseBoundStore<StoreApi<ToyStore>>
```

### 3.3 Stage (02 contracts; views in 04, 06 and 11)

```ts
// contracts/stage.ts
export interface PathHop {                 // every engine TraceStep is assignable; lib/toy emits it too
  kind: 'plugboard' | 'etw' | 'rotor' | 'reflector'; stage: TraceStage
  input: Letter; output: Letter; inputIndex: number; outputIndex: number
  slotIndex?: number; offset?: number; entryContact?: number; exitContact?: number
}
export type PartId = 'battery' | 'keyboard' | 'lampboard' | 'plugboard' | 'etw' | 'reflector' | 'lid'
  | `rotor-${RotorSlot}` | `ring-${RotorSlot}` | `core-${RotorSlot}` | `notch-${RotorSlot}` | `pawl-${RotorSlot}`
export type PartGroup = 'wire' | 'rotor-stack' | 'pawls' | 'overview'
export type Focus = PartId | PartGroup
export type CameraShot = 'overview' | 'front' | 'rotors' | 'rotor-layers' | 'reflector' | 'plugboard' | 'lampboard' | 'toy'
export interface StageDirective {
  source: 'machine' | 'toy'; shot: CameraShot
  focus: Focus                             // ONE part or group; 'overview' dims nothing
  lid: 'closed' | 'open' | 'cutaway'; trace: 'animate' | 'static' | 'off'; labels: 'names' | 'symbols' | 'off'
  ringLayer: boolean                       // exploded ring/core layers
  plugboard: boolean                       // plugboard visible
  interactive: boolean                     // canvas keys clickable
}
export interface Highlight { part: PartId; tone: 'hint' | 'error' | 'ok' }
export interface Ghost { hops: readonly PathHop[]; divergeAt: number }   // learner path vs the reference path
export type StagePresetId = 'overview' | 'type-a-word' | 'toy' | 'wire' | 'wire-noplug' | 'rotors' | 'rotor-layers'
  | 'pawls' | 'reflector' | 'plugboard' | 'symbols' | 'checking'
export declare const STAGE_PRESETS: Readonly<Record<StagePresetId, StageDirective>>   // table below
export type StageRef = StagePresetId | { preset: StagePresetId; with: Partial<StageDirective> }
export declare function resolveStage(ref: StageRef): StageDirective
export declare const ALL_PARTS: (model: ModelName) => readonly PartId[]   // 3 or 4 rotor slots
export declare function dimmedParts(focus: Focus, model: ModelName): PartId[]
  // pure; the ONLY definition of dimming; 2D and 3D must report exactly this list:
  // 'overview' → []; 'wire' → parts not on the path (battery, lid, notch-*, pawl-*);
  // 'rotor-stack' → all but rotor-/ring-/core-/notch-/pawl-*; 'pawls' → all but pawl-*, notch-*, ring-*;
  // a PartId p → all but p and its sub-parts (rotor-x includes ring-x, core-x, notch-x, pawl-x)
export interface StageViewProps {
  directive: StageDirective; reducedMotion: boolean
  onReport: (r: StageReport) => void      // after every render that changes what is shown
  onError: (e: unknown) => void           // StageHost falls back to 2D
}
export interface StageReport {
  renderer: 'webgl2' | 'svg' | 'placeholder'; gpu?: string
  focus: Focus; dimmed: readonly PartId[]; highlighted: readonly PartId[]
  litLamp: Letter | null; windows: string; hop: number; pathPoints: number; ghost: boolean
}
export interface StageStats { calls: number; triangles: number; geometries: number; textures: number; framesWhileIdle: number }
// state/stageStore.ts
export interface StageStore { directive: StageDirective | null; highlight: readonly Highlight[]; ghost: Ghost | null
  setDirective: (d: StageDirective | null) => void; setHighlight: (h: readonly Highlight[]) => void
  setGhost: (g: Ghost | null) => void }
// stage/StageHost.tsx
export declare function StageHost(p: { stage: StageRef | null; className?: string }): JSX.Element | null
// stage2d/index.tsx (04) and machine3d/index.tsx (06): default export ComponentType<StageViewProps>
// machine3d/ready.ts (06): export const MACHINE_3D_READY: boolean   (02 stub: false)
```

| Preset | source | shot | focus | lid | trace | labels | ringLayer | plugboard | interactive |
|---|---|---|---|---|---|---|---|---|---|
| overview | machine | overview | overview | closed | animate | off | no | yes | yes |
| type-a-word | machine | front | overview | closed | off | off | no | yes | yes |
| toy | toy | toy | wire | open | animate | names | no | no | yes |
| wire | machine | overview | wire | cutaway | animate | names | no | yes | yes |
| wire-noplug | machine | overview | wire | cutaway | animate | names | no | no | yes |
| rotors | machine | rotors | rotor-stack | cutaway | static | names | no | no | yes |
| rotor-layers | machine | rotor-layers | ring-right | cutaway | off | names | yes | no | no |
| pawls | machine | rotors | pawls | cutaway | off | names | no | no | yes |
| reflector | machine | reflector | reflector | cutaway | animate | names | no | no | yes |
| plugboard | machine | plugboard | plugboard | open | animate | names | no | yes | yes |
| symbols | machine | overview | wire | cutaway | animate | symbols | no | yes | yes |
| checking | machine | overview | wire | cutaway | animate | names | no | no | yes |

### 3.4 Lesson content (02 types; 05 runtime)

```ts
// contracts/lesson.ts
export type ItemKind = 'letter' | 'letters' | 'numbers' | 'choice' | 'order' | 'chain' | 'set-machine' | 'ghost-pick'
  | 'code' | 'custom'
export type PassRule = { kind: 'window' } | { kind: 'once' }   // window = 2 correct among the last 3 outcomes
export type HintLevel = 0 | 1 | 2 | 3
export interface GenCtx { key: ItemKey; attempt: number; purpose: 'instance' | 'worked' | 'fallback'
  previous: readonly unknown[] }           // last ≤ 3 instances of this item
export interface ItemSetup { machine?: MachineConfigInput; toy?: ToySpec; locks?: MachineLocks; stage?: StageRef | null }
export type Rollback =
  | { kind: 'path'; ghost: Ghost }                                    // lamp, chain, code keypress, ghost-pick
  | { kind: 'windows'; from: MachineConfig; expected: readonly string[]; got: readonly string[]; firstWrong: number }
  | { kind: 'cycles'; perm: readonly number[]; cycle: readonly number[]; expected: readonly number[]; got: readonly number[] }
  | { kind: 'perm'; wrongCells: readonly number[] }
  | { kind: 'crib'; offset: number; crashes: readonly number[] }
  | { kind: 'menu'; loop: readonly Letter[]; breakAt: number }
  | { kind: 'wires'; scrambler: number; expected: readonly Letter[]; got: readonly Letter[] }
  | { kind: 'machine'; field: LockKey; message: string; highlight: readonly PartId[] }
  | { kind: 'order'; firstWrong: number }
  | { kind: 'none' }
export interface CheckResult { correct: boolean; feedback?: string; rollback: Rollback }
export interface ItemLogic<I = unknown, A = unknown> {      // PURE; lives in gates.ts
  id: string; kind: ItemKind; rule: PassRule
  compute: boolean       // counts for "every act ends on a compute or set-machine item"
  inPage: boolean        // answer requires manipulating page state (set-machine, ghost-pick, constructive custom)
  transfer?: true        // requires rule once
  constantAnswer?: true  // same answer on every instance; requires rule once
  lintSeeds?: number     // default 300, minimum 50 (heavy generators)
  generate(r: Rng, ctx: GenCtx): I
  same(a: I, b: I): boolean
  check(i: I, a: A): CheckResult
  solve(i: I): A                                   // reveal, worked example and Node-side e2e only
  sampleAnswer(i: I, r: Rng): A                    // a uniformly random well-formed answer (guess bot)
  mutate(i: I, a: A, r: Rng): A                    // a wrong answer near a (lint)
  setup?(i: I): ItemSetup                          // applied while the instance is shown, restored after
  highlight(i: I, lastWrong: A | null): readonly Highlight[]   // hint L1
}
export interface GateLogic { items: readonly ItemLogic[]; fallback: ItemLogic; puzzle?: true }
export type ChapterGates = Readonly<Record<string, GateLogic>>   // gates.ts: export const GATES
export interface AnswerProps<I, A> { instance: I; disabled: boolean; hintLevel: HintLevel; submit(a: A): void }
export interface ItemUi<I = unknown, A = unknown> {
  Prompt: ComponentType<{ instance: I; hintLevel: HintLevel }>
  Answer?: ComponentType<AnswerProps<I, A>>        // required for 'custom'; generic widgets otherwise
  Worked: ComponentType<{ instance: I; solution: A }>   // L2 gets a DIFFERENT instance; L3 gets the current one
  Feedback?: ComponentType<{ instance: I; answer: A; result: CheckResult }>  // required for cycles|perm|crib|menu|wires
}
export type ItemUiMap = Readonly<Record<string, ItemUi<any, any>>>   // items.tsx: export const ITEM_UI (incl. fallbacks)
export interface GateBinding { logic: GateLogic; ui: ItemUiMap }
export declare function bindGates(g: ChapterGates, ui: ItemUiMap): Readonly<Record<string, GateBinding>>  // 05; throws on a missing UI

export type SceneKind = 'story' | 'explore' | 'gate' | 'recall'
export type MechanismTag = 'typing' | 'lamp' | 'path' | 'machine-path' | 'stepping' | 'double-step' | 'ring'
  | 'reflector' | 'plugboard' | 'no-self' | 'notation' | 'indicator' | 'AD' | 'paired-cycles' | 'invariance'
  | 'cyclometer' | 'catalogue' | 'female' | 'crash' | 'closure' | 'loop' | 'wires' | 'diagonal' | 'checking'
export interface BetSpec { id: string; prompt: string; kind: 'letter' | 'choice' | 'number'; options?: readonly Choice[] }
export interface RevealSpec { bet: string; trigger: 'press' | 'step' | 'run' | 'toggle' | 'play'; key?: Letter }
export interface TaskDef { id: string; label: string }
export interface Fact { id: string; kind: 'person' | 'date' | 'number' | 'event' | 'quote'; text: string
  value?: string | number; source: `https://${string}` }
export interface ClockSpec { date: string /* fact id, kind 'date' */; time?: string /* 'HH:MM' */; caption: string }
  // a STATIC clock and calendar; never counts down; allowed only in story scenes
export interface StorySpec { text: string /* ≤ 120 words */; people: readonly string[] /* ≥1 fact id, kind person */
  date: string /* fact id, kind date */; facts?: readonly string[]; clock?: ClockSpec; figure?: 'keyspace' }
export interface SceneDef {
  id: string; kind: SceneKind; title: string
  stage: StageRef | null
  setup?: ItemSetup
  panels?: { keyboard?: boolean; lamps?: boolean; rotors?: boolean; rings?: boolean; plugboard?: boolean; model?: boolean
    trace?: boolean; playback?: boolean; tape?: boolean }
  introduces?: readonly MechanismTag[]   // first-time reveals: need reveals + bets
  shows?: readonly MechanismTag[]        // already introduced (this or an earlier chapter)
  freePress?: true                       // key presses need no bet (requires `shows`)
  bets?: readonly BetSpec[]; reveals?: readonly RevealSpec[]; tasks?: readonly TaskDef[]
  worked?: true                          // worked-example scene (fading policy)
  gate?: string                          // kind 'gate'
  recall?: { count: 3 }                  // kind 'recall'
  story?: StorySpec                      // kind 'story' only
  View?: ComponentType<SceneProps>       // explore/gate body; story and recall have none
}
export interface BetHandle { committed: boolean; value: string | null; commit(v: string): void; resolve(truth: string): void }
export interface ItemRuntimeView { key: ItemKey; itemId: string; kind: ItemKind; rule: PassRule; attempt: number; seed: number
  hintLevel: HintLevel; fallback: boolean; passed: boolean; window: readonly OutcomeResult[]; instance: unknown }
export interface GateHandle { key: GateKey; passed: boolean; current: ItemRuntimeView | null
  items: readonly ItemRuntimeView[]; last: { itemId: string; result: CheckResult } | null
  submit(itemId: string, answer: unknown): CheckResult; continue(): void }
export interface SceneProps { chapter: AnyChapterId; scene: string; reducedMotion: boolean; store: MachineStoreHook
  completeTask(id: string): void; bet(id: string): BetHandle
  reveal(id: string): { allowed: boolean; fire(): void }    // RevealButton/press gating; fire() emits 'reveal'
  gate: GateHandle | null }
export interface ChapterDef { id: AnyChapterId; scenes: readonly SceneDef[]; gates: Readonly<Record<string, GateBinding>>
  facts: readonly Fact[] }
export interface ChapterMeta { id: ChapterId; act: ActId; order: number; title: string; dates: string; optional?: true
  load(): Promise<{ default: ChapterDef }> }
```

### 3.5 Scoring rules (pure; signatures in 02, implementation in 05 `lesson/rules.ts`)

```ts
// contracts/lesson.ts holds the types below; lesson/rules.ts (05) exports the functions
export type OutcomeResult = 'correct' | 'wrong' | 'revealed'
export interface Outcome { result: OutcomeResult; ms: number; seed: number; fallback: boolean; hintLevel: HintLevel; at: number }
export interface ItemRecord { attempt: number; seed: number; redraw: number; shownAt: number
  outcomes: readonly Outcome[]    // capped at 20
  wrong: number                   // consecutive wrong answers since the last correct answer or reveal
  fallbackNext: boolean; passed: boolean }   // passed is sticky
export interface GateRecord { items: Readonly<Record<string, ItemRecord>>; passed: boolean }
export interface RuleConfig { minLatencyMs: number; burstMs: number }         // defaults 2000, 5000
export type ItemAction = { type: 'answer'; correct: boolean; now: number } | { type: 'reveal'; now: number }
export declare function newItemRecord(salt: string, key: ItemKey, now: number): ItemRecord
export declare function reduceItem(rec: ItemRecord, a: ItemAction, rule: PassRule,
  ctx: { salt: string; key: ItemKey }, cfg?: RuleConfig): ItemRecord
export declare function hintLevel(rec: ItemRecord, puzzle: boolean): HintLevel
export declare function windowPassed(outcomes: readonly Outcome[]): boolean
export declare function isGaming(rec: ItemRecord, cfg?: RuleConfig): false | 'fast' | 'ladder' | 'reveals'
export declare function instanceSeed(salt: string, key: ItemKey, attempt: number, redraw: number): number  // seedFor(salt,key,'inst',attempt,redraw)
export declare function workedSeed(salt: string, key: ItemKey, attempt: number, k: number): number        // seedFor(salt,key,'worked',attempt,k)
export declare function fallbackSeed(salt: string, key: ItemKey, attempt: number): number                 // seedFor(salt,key,'fallback',attempt)
export declare function drawInstance(l: ItemLogic, salt: string, key: ItemKey, attempt: number,
  previous: readonly unknown[]): { instance: unknown; seed: number; redraw: number }   // redraw 0…20 while same()
export declare function drawWorked(l: ItemLogic, salt: string, key: ItemKey, attempt: number,
  current: unknown, next: unknown): { instance: unknown; seed: number }   // k 0…20 until neither same(current) nor same(next)
export declare function gatePassed(g: GateRecord, logic: GateLogic): boolean   // every item passed
```

**Rules (normative; 05 turns each into a table test):**

1. **Window pass.** An item passes when at least 2 of its **last 3** outcomes are `correct`. `revealed` counts as wrong. The pass is sticky.

   | Outcomes, oldest first | Passed? |
   |---|---|
   | C C | pass after the 2nd |
   | C W C | pass after the 3rd |
   | W C C | pass after the 3rd |
   | C W W | no |
   | C W W C | no (window W W C) |
   | C W W C C | pass after the 5th |
   | W W W R C C | pass (window R C C) |
   | C R C | pass |

2. **Once pass.** The item passes on its first `correct` outcome.
3. **Every answer or reveal** increments `attempt`, sets `shownAt = now`, and draws a fresh instance through `drawInstance`. The new seed is persisted. A reload restores `seed` and `redraw` exactly and never rerolls.
4. **Hint ladder.** The ladder is driven by `wrong`: a correct answer or a reveal resets it to 0, and a wrong answer adds 1.
   - Normal gates: `hintLevel = min(3, wrong)`, so attempt 1 has L0, attempt 2 L1, attempt 3 L2 and attempt 4 L3.
   - Puzzle gates: `hintLevel = min(3, max(0, wrong − 1))`, so the first hint arrives at attempt 3, after 2 wrong answers.
   - The levels:
     - **L1:** the item's `highlight()` is applied to the stage and the trace row.
     - **L2:** `Worked` is shown on `drawWorked(...)`, an instance different from both the current and the next one.
     - **L3:** the *current* instance's solution is revealed through `Worked` with `solve(current)`. The only control is "Got it: next instance" (`gate-continue`), which dispatches `reveal`. The outcome is recorded as `revealed`, `wrong` resets to 0, and a fresh instance is drawn.
5. **Gaming.** `isGaming` checks three conditions:
   - `fast`: the last 2 outcomes both had `ms < minLatencyMs`;
   - `ladder`: 3 consecutive wrong answers, each under `burstMs`, that ran up to L3;
   - `reveals`: 2 or more `revealed` outcomes among the last 6.

   After such an action, `reduceItem` sets `fallbackNext`. The next instance is drawn from `GateLogic.fallback` with `fallbackSeed`, and its outcome is recorded on the triggering item with `fallback: true`. `fallbackNext` clears once that instance is answered. A `gaming` event is emitted.
6. **Code items.** The instance holds its seed, the probe and the cases.
   - Run is disabled until the probe is non-empty. The probe locks when Run starts.
   - The answer is `{probe, run}`, and the item is correct ⇔ `probe === expected && run.status === 'pass' && run.passed === run.total && run.instanceSeed === instance.seed`.
   - Truth table: probe ✓ with all cases passing gives C; probe ✗ with all passing gives W; probe ✓ with a failing case gives W; no probe means Run is disabled and nothing can be submitted.
   - The learner's code persists across instances, stored per item in `localStorage['enigma.code.<itemKey>']`.
7. **Gate pass.** A gate passes when every item has passed. Items are presented one at a time, in the order listed.

### 3.6 Generic item builders (pure; 05 `lesson/kinds/index.ts`) and generic widgets

```ts
type Base<I, A> = Omit<ItemLogic<I, A>, 'kind' | 'sampleAnswer' | 'mutate' | 'compute' | 'inPage'>
  & Partial<Pick<ItemLogic<I, A>, 'sampleAnswer' | 'mutate' | 'compute' | 'inPage'>>
export declare function letterItem<I>(s: Base<I, Letter> & { alphabet?: 6 | 8 | 26 }): ItemLogic<I, Letter>
export declare function lettersItem<I extends { length: number }>(s: Base<I, string>): ItemLogic<I, string>
export declare function numbersItem<I extends { count: number | 'any' }>(s: Base<I, number[]> & {
  range: readonly [number, number] | readonly number[]; tolerance?: number | { relative: number }; multiset?: true }): ItemLogic<I, number[]>
export declare function choiceItem<I extends { options: readonly Choice[] }>(s: Base<I, string>): ItemLogic<I, string>
export declare function orderItem<I extends { blocks: readonly Choice[] }>(s: Base<I, string[]>): ItemLogic<I, string[]>
export declare function chainItem<I extends { stages: readonly { id: string; label: string }[] }>(
  s: Base<I, string[]>): ItemLogic<I, string[]>                 // one token per stage
export declare function setMachineItem<I extends { setup: ItemSetup; unlocked: readonly LockKey[]; trial: 'locked' | 'preview'
  maxPlugs?: number }>(s: Omit<Base<I, MachineConfig>, 'check'> & {
  predicate(i: I, cfg: MachineConfig): true | { field: LockKey; message: string; highlight: readonly PartId[] }
  sampleAnswer(i: I, r: Rng): MachineConfig }): ItemLogic<I, MachineConfig>
export declare function ghostPickItem<I extends { options: readonly PartId[]; ghost: Ghost }>(s: Base<I, PartId>): ItemLogic<I, PartId>
export declare function codeItem<I extends { seed: number }>(task: CodeTask<I>,
  s: Pick<ItemLogic<I, CodeAnswer>, 'id' | 'rule' | 'generate' | 'same' | 'highlight'>): ItemLogic<I, CodeAnswer>
```

Defaults:
- `compute` is true for `letter`, `letters`, `numbers`, `chain`, `set-machine` and `code`. It is false for `choice`, `order` and `ghost-pick`.
- `inPage` is true for `set-machine` and `ghost-pick`. A `custom` item must declare both flags itself.
- `sampleAnswer`:
  - letter: a uniform letter of the alphabet;
  - letters: a uniform string of the right length;
  - numbers: uniform over `range`, or a random paired partition when `multiset` is set and the range is `[0, 26]`;
  - choice: a uniform option;
  - order: a random permutation of the blocks;
  - chain: uniform tokens;
  - set-machine: the item's own random configuration within its unlocked controls;
  - numbers with `multiset`: a uniform random *paired* partition of the instance's `n`;
  - code: `{probe: a uniform random token of the probe's answer type, run: a passing summary for this instance}`.
    The bot models a learner whose agent writes working code, so only the probe and the paired items stop it.
- `mutate`: the next letter or option, number + 1, or a swap of two blocks.

`set-machine` semantics (G8):
- While the item is shown, the setup locks `keyboard` and sets `lampsHidden`, and unlocks only `unlocked`.
- The predicate is checked **only on Submit**, against `store.snapshot()`.
- `trial: 'preview'` adds a live decrypt-preview panel of the item's message; it never allows key presses.

Generic widgets (05) exist for every kind except `custom`: letter input, letters input, number fields, radio choices, a drag-and-keyboard Parsons list, per-stage chain inputs, a Submit that snapshots the machine, a part picker, and the CodeItem.

### 3.7 Code runner (05)

```ts
// contracts/code.ts
export interface CodeCase { label: string; fn: string; args: readonly unknown[]; expect: unknown; compare?: 'deep' | 'hops' }
export interface CodeTask<I> {
  fnNames: readonly string[]; signature: string; brief: string; starter: string
  provided: string              // helper source prepended in the worker (e.g. the instrumented parts)
  maxLines: number              // non-blank, non-comment lines per function; > maxLines → status 'too-long', not submitted
  timeoutMs?: number            // default 1500
  reference: string             // reference solution: reviewer agent-paste probe and e2e; never rendered before reveal
  instrument?: 'keypress-parts' // worker records the PathHops produced through `parts`
  cases(i: I): readonly CodeCase[]                                 // ≥ 20 random + edge cases from i.seed
  probe(i: I): { call: string; expected: string }                  // typed before Run unlocks
}
export interface CodeRunSummary { status: 'pass' | 'fail' | 'error' | 'timeout' | 'too-long'; passed: number; total: number
  instanceSeed: number; firstFailure?: { label: string; expected: string; actual: string }; hops?: readonly PathHop[] }
export interface CodeAnswer { probe: string; run: CodeRunSummary }
export interface RunRequest { id: number; source: string; provided: string; fnNames: readonly string[]
  calls: readonly { fn: string; args: readonly unknown[] }[]; timeoutMs: number; instrument?: 'keypress-parts' }
export type RunResponse =
  | { id: number; ok: true; results: readonly ({ value: unknown; hops?: readonly PathHop[] } | { error: string })[]; logs: readonly string[] }
  | { id: number; ok: false; error: 'timeout' | 'syntax' | 'missing-fn'; message: string; line?: number }
export declare function runCode(req: Omit<RunRequest, 'id'>): Promise<RunResponse>
  // code/runner.ts: one module worker; on timeout terminate() and respawn; fetch, importScripts, XMLHttpRequest,
  // WebSocket, indexedDB are replaced by throwing shims inside the worker
export declare function countLines(source: string, fn: string): number
export declare function CodeEditor(p: { value: string; onChange(v: string): void; readOnly?: boolean; testId?: string }): JSX.Element
  // 05: <textarea> (monospace, Tab inserts 2 spaces); 17: CodeMirror 6, lazily loaded, same props
```

### 3.8 Progress and events (02 types; 05 implementation)

```ts
// contracts/progress.ts
export const PROGRESS_KEY = 'enigma.progress.v1', PROGRESS_CORRUPT_KEY = 'enigma.progress.corrupt'
export interface BetRecord { value: string; correct: boolean | null; at: number }
export interface ProgressV1 {
  version: 1; salt: string; createdAt: number; lastVisit: number
  chapters: Partial<Record<AnyChapterId, { reached: number; completed: boolean; tasks: readonly string[] }>>
  gates: Readonly<Record<GateKey, GateRecord>>
  bets: Readonly<Record<BetKey, BetRecord>>          // shown as "bets made / bets right"; never scored
  recall: Readonly<Record<string, { lastSeen: number; correct: number; wrong: number }>>
  prefs: { speed: Speed; motion: 'system' | 'reduce' | 'full'; stage: 'auto' | '3d' | '2d'; labels: boolean }
}
// contracts/progress.ts — event log (window.__course.events())
export type LessonEvent =
  | { type: 'scene.enter' | 'scene.complete'; chapter: AnyChapterId; scene: string }
  | { type: 'bet.commit'; bet: BetKey; value: string } | { type: 'bet.resolve'; bet: BetKey; correct: boolean }
  | { type: 'reveal'; bet: BetKey; trigger: RevealSpec['trigger'] }
  | { type: 'item.show'; item: ItemKey; attempt: number; seed: number; hintLevel: HintLevel; fallback: boolean; workedSeed?: number }
  | { type: 'item.submit'; item: ItemKey; attempt: number; correct: boolean; ms: number; rollback: Rollback['kind'] }
  | { type: 'item.reveal'; item: ItemKey; attempt: number }
  | { type: 'item.passed'; item: ItemKey } | { type: 'gate.passed'; gate: GateKey }
  | { type: 'chapter.complete'; chapter: AnyChapterId }
  | { type: 'gaming'; item: ItemKey; reason: 'fast' | 'ladder' | 'reveals' }
  | { type: 'return-check'; items: readonly ItemKey[] }
```

### 3.9 Window hooks (02 types; `__stage` in 02, `__course` in 05)

```ts
// contracts/hooks.ts
export type StageInfo = StageReport & { directive: StageDirective | null; seq: number; t: number }
export interface StageTestApi { info(): StageInfo; stats(): StageStats | null
  playback(): { t: number; hops: number; seq: number; playing: boolean; gated: boolean } }
export interface CourseTestApi {
  version: 1
  where(): { chapter: AnyChapterId | null; scene: string | null; index: number; kind: SceneKind | null; canNext: boolean; locked: boolean }
  gate(): { key: GateKey; passed: boolean; current: ItemRuntimeView | null; items: readonly ItemRuntimeView[] } | null  // no answers
  answer(itemId: string, answer: unknown): CheckResult   // the same path as the UI Submit; scored; throws if not the current item
  continue(): void; bet(betId: string, value: string): void; next(): boolean
  lastCheck(): { itemId: string; result: CheckResult } | null
  events(): readonly LessonEvent[]; progress(): ProgressV1
  // e2e-only: throw Error('e2e only') unless the page URL had ?e2e=1
  completeTasks(): void; unlockAll(): void; resetProgress(): void
  configure(o: { minLatencyMs?: number; burstMs?: number; playback?: 'instant' | 'normal'; now?: number; salt?: string }): void
}
declare global { interface Window { __stage?: StageTestApi; __course?: CourseTestApi } }   // __enigma stays declared in debug/windowApi.ts
```

### 3.10 Machine UI (04), 3D (06, 11)

```ts
// machine-ui/index.ts — 02 ships stubs with these exact props; 04 implements. `store` defaults to useMachineApi().
export declare function MachinePanel(p: { store?: MachineStoreHook; show: NonNullable<SceneDef['panels']> }): JSX.Element
export declare function Keyboard(p: { store?: MachineStoreHook }): JSX.Element        // key-A…Z; QWERTZ rows
export declare function Lampboard(p: { store?: MachineStoreHook }): JSX.Element       // lamp-A…Z; lit via playback
export declare function RotorControls(p: { store?: MachineStoreHook; rings?: boolean; rotorSelect?: boolean }): JSX.Element
  // rotor-pos-{slot}: role=spinbutton, aria-valuetext = letter; ring-{slot}: spinbutton 1–26, aria-valuetext '01'…'26';
  // rotor-select-{slot}, reflector-select
export declare function ModelSelect(p: { store?: MachineStoreHook }): JSX.Element     // model-select
export declare function PlugboardEditor(p: { store?: MachineStoreHook; maxPairs?: number }): JSX.Element
  // plug-input, plug-add, plug-pair-{i} with remove buttons
export declare function TracePanel(p: { source?: 'machine' | 'toy'; compact?: boolean; showOffsets?: boolean }): JSX.Element
  // trace-step (stepping row) + trace-row-{i}: data-stage, data-input, data-output, data-lit; sym chip per row
export declare function PlaybackBar(): JSX.Element     // playback-play, playback-scrub (range), playback-speed (select)
export declare function Announcer(): JSX.Element       // role=status aria-live=polite data-testid=announcer:
                                                       // "Q lights E. Rotors now A E W." (lamp omitted if lampsHidden)
export declare function PaperTape(p: { store?: MachineStoreHook }): JSX.Element     // tape-input, tape-output, tape-copy, tape-paste
export declare function PermTable(p: { perm: readonly (number | null)[]; n?: number; sym?: Sym; label?: ReactNode
  highlight?: readonly number[]; editable?: boolean; onEdit?(i: number, v: number | null): void; testId?: string }): JSX.Element
export declare function encodeConfig(c: MachineConfig): string          // e.g. 'I.B.I-II-III.01-01-01.ADU.AV-BS'
export declare function decodeConfig(s: string): MachineConfig | null   // null if invalid

// machine3d/layout.ts (06; pure, unit-tested)
export interface Vec3 { x: number; y: number; z: number }
export interface Layout { n: number; slots: readonly RotorSlot[]; toy: boolean }
export declare function makeLayout(o: { n: number; slots: readonly RotorSlot[]; toy: boolean }): Layout
export declare function contactPoint(l: Layout, part: 'plugboard' | 'etw' | RotorSlot | 'reflector' | 'keyboard' | 'lampboard',
  face: 'in' | 'out', contact: number, rotation: number): Vec3
export declare function pathPoints(hops: readonly PathHop[], l: Layout): Vec3[]   // exactly 2 + 2·hops.length points
```

### 3.11 Crypto kit and viz (08; API frozen in 08's first commit)

```ts
// crypto/types.ts
export type Rng = () => number
export interface Products { AD: readonly (number | null)[]; BE: readonly (number | null)[]; CF: readonly (number | null)[]
  conflicts: readonly string[] }                 // e.g. 'CF: Z→W vs X→W'
// crypto/rejewski.ts
export declare const REJEWSKI_65: readonly string[]   // 65 six-letter strings, verbatim from Christensen (see §4.3 F20)
export declare function encryptIndicator(day: MachineConfig, messageKey: string): string   // key typed twice at day.positions
export declare function makeIndicators(r: Rng, day: MachineConfig, count: number): { keys: string[]; indicators: string[] }
export declare function products(indicators: readonly string[]): Products
export declare function sixPermutations(day: MachineConfig): readonly number[][]   // A…F at the Grundstellung (engine, with stepping)
export declare function productsFromMachine(day: MachineConfig): { AD: number[]; BE: number[]; CF: number[] }  // compose(A,D) …
export declare function characteristic(ad: Perm, be: Perm, cf: Perm): string       // 'AD:10.10.2.2.1.1 BE:9.9.3.3.1.1 CF:13.13'
export declare function isPairedType(lengths: readonly number[]): boolean
export declare function factorizationCount(ad: Perm): number                        // 20 for vector 13
// crypto/catalogue.ts (pure) + catalogue.worker.ts + catalogueClient.ts
export interface CatalogueEntry { rotors: readonly RotorName[]; positions: string }
export type Catalogue = ReadonlyMap<string, readonly CatalogueEntry[]>
export declare function buildCatalogue(o: { reflector: ReflectorName; orders?: readonly (readonly RotorName[])[]
  onProgress?(done: number, total: number): void }): Catalogue   // default: the 6 orders of I, II, III, rings AAA → 105,456 entries
export declare function catalogueStats(c: Catalogue): { entries: number; distinct: number; maxBucket: number
  histogram: readonly { size: number; count: number }[] }
export declare function getCatalogue(reflector: ReflectorName, onProgress?: (d: number, t: number) => void): Promise<Catalogue>
  // client: builds once per session in a worker (falls back to the main thread), memoised
// crypto/cribs.ts
export declare function crashes(cipher: string, crib: string, offset: number): number[]   // indices i with cipher[offset+i] === crib[i]
export declare function zeroCrashOffsets(cipher: string, crib: string): number[]
export declare function isConsistentCrib(cipher: string, crib: string, offset: number): boolean
// crypto/menu.ts
export interface MenuEdge { a: Letter; b: Letter; pos: number }   // pos = 1-based crib position
export interface Menu { edges: readonly MenuEdge[]; letters: readonly Letter[] }
export declare function menuFromCrib(cipher: string, crib: string, offset: number): Menu
export declare function closures(m: Menu): number                 // E − V + C
export declare function loops(m: Menu): Letter[][]                // a cycle basis
export declare function turnoverWithin(rotors: readonly RotorName[], start: string, from: number, to: number): number | null
// crypto/bombe.ts (+ bombe.worker.ts, bombeClient.ts)
export interface WireState { n: number; live: readonly (readonly boolean[])[]   // [bank letter][wire]
  order: readonly { bank: number; wire: number; via: number | 'hypothesis' | 'diagonal' }[] }
export declare function scramblerAt(rotors: readonly RotorName[], reflector: ReflectorName, start: string, pos: number): number[]
  // no plugboard; only the fast drum advances (pos steps); middle and left fixed — bombe drum semantics
export declare function propagate(menu: Menu, scramblers: readonly (readonly number[])[], hyp: { bank: Letter; wire: Letter },
  o: { n: number; diagonal: boolean }): WireState
export declare function liveCount(ws: WireState, bank: Letter): number
export interface Stop { rotors: readonly RotorName[]; positions: string; testLetter: Letter; stecker: Letter; live: number }
export declare function runBombe(o: { menu: Menu; rotors: readonly RotorName[]; reflector: ReflectorName; diagonal: boolean
  from?: string; limit?: number; onProgress?(d: number, t: number): void }): Stop[]   // default: all 17,576 positions
export declare function checkStop(stop: Stop, cipher: string, crib: string, offset: number):
  { consistent: boolean; steckers: readonly string[]; contradiction?: { letter: Letter; partners: readonly Letter[] } }
export declare function toyBombe(r: Rng, o: { n: 8; scramblers: 3 | 4 | 5 }): { menu: Menu; scramblers: number[][]
  truth: { bank: Letter; wire: Letter } }
// crypto/generators.ts — every config passes validateConfig
export declare function dayKey(r: Rng, o: { era: '1932' | '1936' | '1940'; plugs?: number; rings?: 'AAA' | 'random'
  orders?: readonly (readonly RotorName[])[] }): MachineConfig
  // 1932/1936: model I, UKW-A, rotors from I–III, 6 plugs; 1940: model I, UKW-B, rotors from I–V, 10 plugs
export declare function cribbedMessage(r: Rng, o: { day: MachineConfig; crib: string; length: number }):
  { plain: string; cipher: string; offset: number; start: string }   // no middle-rotor turnover inside the crib span
```

```ts
// viz/index.ts (08) — SVG, keyboard-operable, colours via var(--sym-*)
export declare function CycleDiagram(p: { perm: readonly number[]; n?: number; highlightCycle?: readonly number[]
  relabelBy?: readonly number[]; onPickLetter?(i: number): void }): JSX.Element
export declare function CycleAlign(p: { a: readonly number[]; b: readonly number[]; offset: number; reversed: boolean
  onChange(offset: number, reversed: boolean): void }): JSX.Element
export declare function CatalogueHistogram(p: { stats: ReturnType<typeof catalogueStats>; highlight?: string }): JSX.Element
export declare function LightTable(p: { sheets: readonly (readonly boolean[])[]; size: 51; shown: number; onShown(n: number): void }): JSX.Element
export declare function CribStrip(p: { cipher: string; crib: string; offset: number; onOffset?(o: number): void; readOnly?: boolean }): JSX.Element
export declare function MenuGraph(p: { menu: Menu; available?: readonly MenuEdge[]; onAddEdge?(pos: number): void
  onRemoveEdge?(pos: number): void; highlightLoop?: readonly Letter[]; warnings?: readonly number[] }): JSX.Element
export declare function WireGrid(p: { state: WireState; step?: number; diagonal: boolean; testLetter: Letter
  onToggleWire?(bank: number, wire: number): void }): JSX.Element
export declare function TestRegister(p: { live: readonly boolean[]; testLetter: Letter }): JSX.Element
```

### 3.12 Fixed test IDs

- **Machine:** `key-A…Z`, `lamp-A…Z`, `rotor-pos-{greek|left|middle|right}`, `ring-{slot}`, `rotor-select-{slot}`, `reflector-select`, `model-select`, `plug-input`, `plug-add`, `plug-pair-{i}`.
- **Trace, playback and tape:** `trace-step`, `trace-row-{i}`, `playback-play`, `playback-scrub`, `playback-speed`, `announcer`, `tape-input`, `tape-output`, `tape-copy`, `tape-paste`, `share-link`.
- **Stage:** `stage` (`data-renderer`, `data-focus`), `stage-placeholder`.
- **Navigation and bets:** `scene-next`, `scene-back`, `task-{id}` (`data-done`), `bet-{id}`, `bet-option-{id}-{option}`, `bet-commit-{id}`, `reveal-{id}`.
- **Gates:** `item-{itemId}` (`data-passed`, `data-attempt`), `gate-submit`, `gate-continue`, `hint-panel` (`data-hint-level`), `worked-example` (`data-seed`), `rollback` (`data-kind`), `gate-prediction`, `code-run`, `code-editor`, `copy-brief`.
- **Course:** `course-map`, `chapter-link-{id}`, `locked-page`, `return-check`, `story-card`, `act-clock`.

### 3.13 Validation and lint (normative; 05 implements; runs in `npm test`)

`lesson/validate.test.ts` checks every registered chapter, the fixture chapter and the recall pool:

- **V1 Identity.** Ids are unique. Every `scene.gate` resolves. Every item and fallback has an `ITEM_UI` entry. `custom` items have `Answer`. Rollback kinds `cycles|perm|crib|menu|wires` have `Feedback`.
- **V2 Endings.** Every chapter except the prologue ends with a `gate` scene. The final required chapter of each act (I.4, then II.8 or II.7 if II.8 is cut, III.12, the capstone) ends on a gate that contains a `compute: true` item.
- **V3 Story.** `story` appears only on story scenes. Its text is at most 120 words. It has at least one person fact and one date fact, and the ids resolve to facts of the right kind. A clock appears only in story scenes. The first story scene of the prologue, II.5, III.9 and the capstone has a clock. There are never two consecutive story scenes.
- **V4 Facts.** Every fact has an `https://` source, every fact id is unique, and every fact is referenced.
- **V5 One component per scene.** In chapters of Acts I and II, every `explore` or `gate` scene with a stage has `resolveStage(stage).focus !== 'overview'`.
- **V6 Bets.**
  - Every scene with `introduces` has at least one `reveal`.
  - Every `reveal.bet` resolves to one of the scene's `bets`, and every bet is used by a reveal.
  - A scene with `freePress` has `shows`, and each of those tags was introduced by an earlier scene of this or an earlier chapter.
  - A scene that shows the keyboard and animates the trace needs either `introduces` or `freePress`.
- **V7 Fading.** Chapters up to and including II.5 have a `worked: true` scene before their first gate. Chapters from II.6 onward have none.
- **V8 Pairing.** A gate with a `code` item also has another item with `inPage: true`.
- **V9 Once rules.** `transfer` and `constantAnswer` items have `rule.kind === 'once'`.
- **V10 Fallback.** `GateLogic.fallback` has `inPage: true` and kind `set-machine`, `ghost-pick` or `custom`.
- **V11 Recall.** II.5, III.9 and the capstone start with a `recall` scene.
- **V12 Validity.** Every `setup.machine`, whether on a scene or on any generated item over the lint seeds, passes `validateConfig` with zero problems. A set-machine item's `unlocked` keys are not locked by its setup.
- **V13 Registry.** The registry has 14 chapters with unique `order` values. `optional` appears only on II.8.

`lesson/lint.test.ts`, `guessBot.test.ts` and `purity.test.ts`:

- **L1 Generators.** Over `lintSeeds` seeds (default 300):
  - `generate` is deterministic;
  - the instance survives a JSON round trip unchanged and is at most 16 kB;
  - `same(i, i)` is true;
  - `check(i, solve(i)).correct` is true;
  - `check(i, mutate(i, solve(i)))` is incorrect for at least 95% of seeds;
  - solutions take at least 2 distinct values, unless the item is `constantAnswer`.
- **L2 Guess bot.** For each gate, 1,000 simulated runs. The bot answers every instance with `sampleAnswer` and dispatches through `reduceItem`, reaching the reveal as the ladder dictates, with at most 6 attempts per item. **P(the gate passes) must be below 1%.** The same bound applies to every recall gate and every return-check pair that the §4.2 rotation can produce; the test enumerates them.
- **L3 CC learner.** An always-correct learner passes every gate. For each gate, it uses at most 2 instances per window item and 1 per once item, and it is shown every `transfer` item.
- **L4 Purity.** The static import closure of every `chapters/*/gates.ts`, `lesson/recall/pool.ts` and `lesson/fixture/gates.ts` stays inside `src/engine/`, `src/lib/{rng,toy,keyspace}.ts`, `src/contracts/`, `src/lesson/{rules,kinds/*}.ts`, `src/crypto/` (excluding `*.worker.ts` and `*Client.ts`), and the same chapter's `gates|facts|data*.ts`. It contains no `import.meta`, no `?worker`/`?raw`/`?url` imports, no `.tsx` files, no `react`, and no `Math.random`.

`src/lint/bans.test.ts` (02):

- **L5 Bans.**
  - In `e2e/`: no `waitForTimeout`, `test.only`, `page.pause` or `toHaveScreenshot`. Specs import `test` and `expect` from `./fixtures`, never from `@playwright/test`.
  - In `src/`: no `console.log`, except under `src/debug`.
  - No `.solve(` in `src/chapters/*/scenes/**` or `items.tsx`.
  - Every `*.test.tsx` starts with `// @vitest-environment happy-dom`.
  - No `/\b19[0-4]\d\b/` year in `chapters/*/scenes/**` or `items.tsx`. Dates live in facts.

---
## 4. Chapter and gate specification (normative)

### 4.1 Global rules

- **G1 Stepper.** `scene-next` is enabled only when `canAdvance` holds:
  - story scenes: always;
  - explore scenes: every task is done and every reveal's bet is committed;
  - gate and recall scenes: the gate has passed.

  Back is always allowed, as far back as any reached scene.
- **G2 Pass rules.** Items are `window` (2 correct among the last 3, sticky) or `once`. A gate passes when every item has passed. Items are shown one at a time, in the order listed.
- **G3 Fresh instances.** Every answer or reveal draws a fresh instance (§3.5 rule 3). Instances that match any of the last 3 are redrawn. Worked-example instances never equal the current instance or the next one.
- **G4 Hint ladder.** The ladder is automatic and per item: L0 nothing, then L1 highlight, then L2 a worked example on a different instance, then L3 reveal plus a fresh instance. In puzzle gates (the capstone), the first hint comes at attempt 3.
- **G5 Rollback.** Every wrong answer shows a rollback of the learner's own answer before `gate-continue`, following the table below.
- **G6 Anti-gaming.** When a gaming signal fires (fast, ladder or reveals, §3.5 rule 5), the next instance is drawn from the gate's in-page `fallback`.
- **G7 Pairing.**
  - A code item passes an instance only when the probe (typed before Run) is correct **and** every hidden case passes.
  - A gate that holds a code item must also hold an `inPage` item: set-the-machine, ghost-pick, or a constructive custom item.
  - "Copy brief for your agent" (`copy-brief`) copies the brief, signature and visible tests. It is offered openly.
  - Functions stay within `maxLines` (≤ 12).
- **G8 Set-the-machine.** While the item is shown, the keyboard is locked and the lamps are hidden, so trial presses are impossible. The predicate is checked only on Submit. `trial: 'preview'` adds a live decrypt preview and is used only where reading a partial decrypt *is* the historical method: II.7 `set-plugs`, III.12 `set-key` and the capstone.
- **G9 Transfer.** A transfer instance is always a separate `once` item, so every learner reaches it.
- **G10 Bets.** Every first-time reveal (`introduces`) is preceded by a bet.
  - Until the bet is committed, the triggering control (key, Step, Run, toggle or Play button) is disabled, `locks.keyboard` is set, and `playback.gated` pins `t` at 0.
  - After commit the control unlocks. Bets are recorded and resolved, never scored.
  - Exempt: the sandbox, repeat presses, and `freePress` scenes whose mechanisms were already introduced.
  - At most 3 bets per scene.
- **G11 One component per scene.** In Acts I and II, a mechanism scene focuses a single part or group, and everything else is dimmed (`dimmedParts`). 2D and 3D report the same list.
- **G12 Story layer.**
  - Stories appear only as separate story scenes, of at most 120 words.
  - Each names a real person and a date taken from `facts.ts`, and never sits on top of a calculation.
  - Act clocks appear only in the first story of the Prologue, II.5, III.9 and the capstone. They are static and never time anything.
- **G13 Endings.** Every chapter except the prologue ends on a gate. Every act ends on a compute or set-the-machine item.
- **G14 Disclosure order** (Franklin Heath):
  - I.1 teaches rotors and reflector with `hold` (no stepping), rings 01 and no plugs;
  - I.2 adds stepping and rings;
  - I.3 adds the plugboard.

  No generator uses a feature before its chapter.
- **G15 Fading.** Worked-example scenes come before the gates in Act I and II.5. From II.6 on, gates come problem-first, and worked examples appear only as L2 hints.
- **G16 Recall.** II.5, III.9 and the capstone open with 3 recall items interleaved across all earlier acts (§4.2). A return-visit check also runs.
- **G17 No clocks on assessment.** There are no timers, hearts or streaks, and nothing assessed is ever timed.
- **G18 Model validity.** Every generated setup passes `validateConfig`. Items that use VI–VIII switch to model M3, and the store's `setConfig` or `setModel` handles the switch.

**Rollback per answer kind (G5)**

| Answer kind | `rollback.kind` | What the learner sees |
|---|---|---|
| letter (lamp prediction) | `path` | The reference path is drawn in gold. The learner's lamp is traced *backwards* through the inverse components as a red ghost until it meets the reference, and `divergeAt` marks that hop |
| chain (hop letters) | `path` | The learner's letters form a red ghost path that splits from gold at the first wrong hop |
| code, keypress | `path` | The learner's recorded hops (instrumented `parts`) are drawn against the engine trace |
| ghost-pick | `path` | The seeded bug's ghost and the reference are drawn; the true divergence part pulses |
| letters (windows) | `windows` | The machine steps press by press up to the first wrong window, the carrying rotor's pawl and notch are highlighted, and expected and typed windows are shown side by side |
| numbers (cycle lengths) | `cycles` | CycleDiagram highlights the miscounted cycle and walks it letter by letter |
| perm fill | `perm` | Wrong cells are highlighted, and the indicator pair that defines each cell animates into it |
| crib offset | `crib` | CribStrip sits at the learner's offset with the crash columns in red |
| menu / loop letter | `menu` | MenuGraph animates the loop up to the edge where the implication breaks, or the closure that is missing |
| bombe chain / live count | `wires` | WireGrid replays the propagation up to the scrambler where the learner's letter differs |
| set-machine | `machine` | The failed predicate is shown on the part itself, for example "the middle notch is not at its turnover" or "K lights X, not T" |
| order | `order` | The first misplaced block is highlighted, with the correct order |
| choice | `none` | The explanation of the correct option and why the chosen distractor is wrong |

### 4.2 Recall pool and return-visit check (05, `lesson/recall/pool.ts`; pure and generic, never imports a chapter)

| Id | Act | Kind | Instance → answer |
|---|---|---|---|
| `r-windows` | I | letters (9) | I–V machine, start within 3 presses of a turnover → the windows after 3 presses |
| `r-plug-to-hit` | I | set-machine | Unplugged scrambler table shown → at most 2 cables so that K lights T (keyboard locked) |
| `r-hop-trio` | I | letters (3) | Right-, middle- and left-rotor strips at their offsets shown with a letter in → the letters after R, M and L |
| `r-compose` | II | letters (4) | 6-letter p and q → compose(p,q) images of four letters |
| `r-lengths` | II | numbers (multiset) | Product of two fixed-point-free involutions on 12–14 letters → cycle lengths |
| `r-crashes` | III | numbers (any) | Cipher, crib and offset k → crash indices |
| `r-loop` | III | letters (4) | 8-letter loop with 3 scrambler tables and 4 hypotheses → the letter returned for each |

Every recall item is `once`, with the full ladder. Every recall gate and return-check pair the rotation can produce has a guess-bot pass rate below 1% (L2).

- **Act recall** (a scene of kind `recall`, 3 items):
  - II.5: `r-windows`, `r-hop-trio`, `r-plug-to-hit`.
  - III.9: 2 Act II items plus 1 Act I item.
  - Capstone: 1 item per act.

  Items are chosen by seeded rotation, and the three item kinds must differ.
- **Return-visit check.** It runs when `now − lastVisit ≥ 6 h` and at least one chapter is complete, as the learner enters any `#/c/…` route. It shows 2 items from completed acts, one from the oldest `recall[].lastSeen` act and one from another act. The learner must answer or reveal each before resuming; it never locks anything further. It emits `return-check`, and e2e can trigger it with `configure({now})`.

### 4.3 Facts register (use only these facts, or others found in `research_notes/Interactive Enigma teaching tools/technical_and_historical_ground_truth.md` with its sources; never invent)

| Id | Fact | Source |
|---|---|---|
| F1 | Arthur Scherbius filed his cipher-machine patent on 23 Feb 1918 | https://en.wikipedia.org/wiki/Enigma_machine |
| F2 | "Approximately 40,000 Enigma machines were constructed" | https://en.wikipedia.org/wiki/Enigma_machine |
| F3 | 1926 Reichsmarine adoption; 1928 Reichswehr version; 1930 Enigma I in service | https://en.wikipedia.org/wiki/Enigma_machine |
| F4 | 1927: the UK bought a commercial Enigma; April 1937: Dilly Knox's first Enigma decrypt (unsteckered Spanish Civil War traffic) | https://en.wikipedia.org/wiki/Cryptanalysis_of_the_Enigma |
| F5 | 1 Sept 1932: Marian Rejewski, Henryk Zygalski and Jerzy Różycki hired in Warsaw; 9 Dec 1932: Hans-Thilo Schmidt's key tables (Sept–Oct 1932) delivered via Gustave Bertrand; wirings recovered by the end of 1932 | https://en.wikipedia.org/wiki/Cryptanalysis_of_the_Enigma ; https://en.wikipedia.org/wiki/Marian_Rejewski |
| F6 | Rejewski's notation: S plugboard, H entry wheel, N/M/L rotors, R reflector (the app writes U), P the cyclic shift | https://www.matematiksider.dk/enigma/MAA%20article%20about%20Enigma%20.pdf |
| F7 | Conjugate permutations share cycle structure, "the theorem that won World War II" (Deavours) | https://en.wikipedia.org/wiki/Marian_Rejewski |
| F8 | Cyclometer 1934/35; the catalogue took "over a year"; 1/2 Nov 1937 the reflector change forced a redo | https://en.wikipedia.org/wiki/Cryptanalysis_of_the_Enigma |
| F9 | 15 Sept 1938 indicator change; Oct 1938 Zygalski sheets and bomba; 15 Dec 1938 rotors IV and V; 1 Jan 1939 7–10 plugs | https://en.wikipedia.org/wiki/Zygalski_sheets ; https://en.wikipedia.org/wiki/Cryptanalysis_of_the_Enigma |
| F10 | Pyry conference near Warsaw, 26–27 July 1939 | https://en.wikipedia.org/wiki/Cryptanalysis_of_the_Enigma |
| F11 | Knox's first question at Pyry was the entry-drum wiring | https://www.matematiksider.dk/enigma/MAA%20article%20about%20Enigma%20.pdf |
| F12 | 4 Sept 1939: Alan Turing and Gordon Welchman report to Bletchley Park; Turing designs the bombe in 1939 | https://en.wikipedia.org/wiki/Cryptanalysis_of_the_Enigma |
| F13 | 18 Mar 1940 Victory; 1 May 1940 doubled indicator ends; 22 May 1940 first Herivel-tip break (John Herivel); 8 Aug 1940 Agnus Dei with diagonal board | https://en.wikipedia.org/wiki/Cryptanalysis_of_the_Enigma ; https://en.wikipedia.org/wiki/Herivel_tip |
| F14 | The diagonal board was Welchman's idea, shown "early in 1940" | https://en.wikipedia.org/wiki/Cryptanalysis_of_the_Enigma |
| F15 | March 1941: the first Wrens arrive as bombe operators | https://en.wikipedia.org/wiki/Cryptanalysis_of_the_Enigma |
| F16 | 1974: the British ban lifted; F. W. Winterbotham's *The Ultra Secret* | https://en.wikipedia.org/wiki/Ultra_(cryptography) |
| F17 | "a severe cryptological flaw" (no letter enciphers to itself) | https://en.wikipedia.org/wiki/Enigma_machine |
| F18 | Turing's expected stops per wheel order, 8-letter menu: 3 loops 2.2; 1 loop 1,500; 0 loops 40,000 | https://en.wikipedia.org/wiki/Bombe |
| F19 | Wilcox's rule of thumb: two closures, 13–14 links | https://websites.nku.edu/~christensen/Bombe.pdf |
| F20 | The 65 indicators (Christensen, from Bauer): AUQ AMN, IND JHU, PVJ FEG, SJM SPO, WTM RAO, BNH CHL, JWF MIC, QGA LYB, SJM SPO, WTM RAO, BCT CGJ, JWF MIC, QGA LYB, SJM SPO, WTM RAO, CIK BZT, KHB XJV, RJL WPX, SUG SMF, WKI RKK, DDB VDV, KHB XJV, RJL WPX, SUG SMF, XRS GNM, EJP IPS, LDR HDE, RJL WPX, TMN EBY, XRS GNM, FBR KLE, LDR HDE, RJL WPX, TMN EBY, XOI GUK, GPB ZSV, MAW UXP, RFC WQQ, TAA EXB, XYW GCP, HNO THD, MAW UXP, SYX SCW, USE NWH, YPC OSQ, HNO THD, NXD QTU, SYX SCW, VII PZK, YPC OSQ, HXV TTI, NXD QTU, SYX SCW, VII PZK, ZZY YRA, IKG JKF, NLU QFZ, SYX SCW, VQZ PVR, ZEF YOC, IKG JKF, OBU DLZ, **SYZ SCW**, VQZ PVR, ZSJ YWG. `SYZ SCW` conflicts with `SYX SCW`, because CF maps X→W. Transcribe it verbatim; `products()` must report it in `conflicts`, and vector 13 uses the consistent majority. Expected: AD = (a)(bc)(dvpfkxgzyo)(eijmunqlht)(rw)(s) → 10 10 2 2 1 1; BE = (axt)(blfqveoum)(cgy)(d)(hjpswizrn)(k) → 9 9 3 3 1 1; CF = (abviktjgfcqny)(duzrehlxwpsmo) → 13 13 | https://www.matematiksider.dk/enigma/MAA%20article%20about%20Enigma%20.pdf |
| F21 | Vector 14: cipher WSNPNLKLSTCS over crib ATTACKATDAWN → no crashes; loops ATLK, TNS, TAWCN; 3 closures | https://en.wikipedia.org/wiki/Bombe |
| F22 | Gordon Welchman headed Hut 6 (Army and Air Force Enigma) | https://en.wikipedia.org/wiki/Gordon_Welchman |

The key-space figures are computed by `lib/keyspace.ts` (F-KS: 60 × 17,576 × 150,738,274,937,250 = 1.59 × 10²⁰; × 676 = 1.07 × 10²³; 105,456; 101; 101³ = 1,030,301), sourced to https://www.matematiksider.dk/enigma/MAA%20article%20about%20Enigma%20.pdf.

### 4.4 Chapters

**Notation.**
- **Scenes:** `id · kind · stage preset · setup · introduces / bets / reveal · tasks`.
- **Items:** `id · kind · rule · generator → answer · rollback · L1 highlight`.
- **L2** is always `Worked` on a different instance, and **L3** is always the reveal of the current instance.
- **"2/3"** means the window rule, and **"once"** means a single correct answer.
- **Machine setups** use model I and UKW-B unless stated otherwise.

#### prologue · Act P · order 0 · no gate (the hook)

1. `scherbius` · story · people F1 (Scherbius) · date F1 · facts F2 · clock {date F1, caption "Each day brought a new key."}
2. `type-a-word` · explore · `type-a-word` · setup I II III, AAA, AAA, no plugs · panels keyboard, lamps, tape · introduces [typing] · bet `own-letter` (choice: its own letter / another letter / no lamp), reveal press · tasks `type5` (5 letters typed), `roundtrip` (reset, type the ciphertext, and the tape shows the original)
3. `brute-force` · explore · `overview` · bet `brute` (choice: yes, within a year / only with thousands of machines / no, not in the lifetime of the universe), reveal play → `figure: 'keyspace'` animates 60 × 17,576 × 150,738,274,937,250 ≈ 1.59 × 10²⁰, then × 676 ring settings ≈ 1.07 × 10²³, with the explanation that only the right and middle notches matter, 26² = 676 · task `seen`

Chapter completion needs every task done and every bet committed.

#### i1-anatomy · Act I · order 1

Disclosure: `hold` (no stepping), rings 01, no plugs, plugboard hidden.

1. `knox` · story · people F4 (Knox) · date F4 (1927 and April 1937)
2. `toy-wire` · explore · worked · `toy` · toy n=6, 1 rotor + reflector, held · introduces [lamp] · bet `toy-lamp` (letter), reveal press `C` · task `press3`
3. `toy-trace` · explore · `toy` · toy n=6, 2 rotors, held · panels trace, playback · introduces [path] · bet `toy-path` (letter), reveal press · tasks `press3`, `scrub-reflector` (scrub `t` into the reflector hop)
4. `worked-chain` · explore · worked · `wire-noplug` · I II III, rings AAA, fixed positions, locks {hold, plugboard, rings, rotors, positions} · View: each component's substitution strip (PermTable) at its current offset, and a "next hop" button that fills the 11-hop chain for K · shows [path], freePress · task `all-hops`
5. `path-26` · explore · `wire-noplug` · same locks · panels keyboard, lamps, trace, playback · introduces [machine-path] · bet `q-lamp` (letter), reveal press `Q` · tasks `speed` (speed changed), `scrub`
6. `gate` · gate `anatomy`:
   - `toy-lamp` · letter(6) · 2/3 · `randomToy(n 6, 2 rotors, held)` plus a key, with every table shown → the lamp · `path` (backward ghost) · L1 the part where the backward trace diverged in the last wrong answer, else `reflector`
   - `hop-chain` · chain(11) · 2/3 · 3 distinct rotors from I–V, rings AAA, random positions, no plugs, held; strips shown at their offsets → the letter after each stage · `path` · L1 the part of the first wrong hop
   - `path-order` · order(11 stage blocks) · once · constantAnswer · `order`
   - `path-order-m4` · order(13 blocks, with the Greek rotor and the thin reflector) · once · **transfer** · `order`
   - fallback `toy-set` · custom inPage · toy n=6 with 2 rotors, keyboard locked, rotor-position pickers → positions such that C lights E; a solution is guaranteed · `machine`

#### i2-stepping · Act I · order 2 · **contract pilot (PR 07)**

1. `rejewski-p` · story · people F5 (Rejewski) · date F5 (late 1932) · facts F6 · text: the right rotor's step written as a single permutation P
2. `step-first` · explore · worked · `pawls` · I II III, AAA, AAA, locks {rotors, rings, plugboard, positions} · panels keyboard, rotors, trace, playback · introduces [stepping] · bet `first-press` (choice: no rotor moves / the right rotor moves first / all three move), reveal press `A` · task `press1`
3. `double-step` · explore · `pawls` · positions ADU · panels rotors, trace · introduces [double-step] · bets `adu`, `adv`, `aew` (choice each time: right only / right + middle / all three), revealed by `step` via the `reveal-*` Step button, which presses `A` with the lamps hidden · task `reach-bfx`
4. `ring-vs-core` · explore · `rotor-layers` · rings unlocked · panels rotors, rings, keyboard · introduces [ring] · bet `ring-window` (choice: the window letter changes [misconception] / the window stays and the wiring turns under it / the notch moves to another letter), reveal toggle (the right ring goes 01 → 05) · tasks `change-ring`, `compare-lamps` (the same key pressed before and after)
5. `gate` · gate `stepping`:
   - `windows` · letters(9) · 2/3 · 3 distinct rotors from I–V, random rings, start within 3 presses of the right turnover; when `attempt` is even, the 3 presses must include a double step → the three windows after each press · `windows` · L1 [notch-right, pawl-middle, notch-middle]
   - `middle-steps` · set-machine · 2/3 · random order from I–V, target `middle`; unlocked [positions]; trial locked; predicate `step(state).stepped.middle` · `machine` · L1 [notch-right, notch-middle]
   - `ring-probe` · choice(4, shuffled, misconception-tagged) · once · constantAnswer · `none`
   - `windows-m3` · letters(9) · once · **transfer** · **model M3**, at least one of VI–VIII in the right or middle slot, start within 2 presses of a Z or M turnover · `windows`
   - fallback `left-steps` · set-machine: the same as `middle-steps` with target `left`

#### i3-reflector-plugboard · Act I · order 3

1. `bletchley` · story · people F12 (Turing, Welchman) · date F12 · facts F17
2. `reflector-pairs` · explore · worked · `reflector` · introduces [reflector] · bet `pairs` (number), reveal play (the 13 arcs light in turn) · task `seen`
3. `plugboard-twice` · explore · `plugboard` · plugboard unlocked · panels plugboard, keyboard, trace · introduces [plugboard] · bet `twice` (choice: once / twice / only if that key is plugged), reveal press · tasks `add2`, `press-plugged`
4. `reciprocity` · explore · `wire` · shows [path, plugboard], freePress · panels keyboard, tape · task `roundtrip`
5. `self-search` · explore · `wire` · positions unlocked · introduces [no-self] · bet `self` (choice: yes / no / only with cables), reveal run (`reveal-self` searches all 17,576 positions; the counter reaches 17,576 with 0 hits) · a "give up" button appears after 30 manual presses · task `searched`
6. `gate` · gate `reflector`:
   - `plug-to-hit` · set-machine · 2/3 · I–V, random rings and positions, no cables; distinct K and T with E0(K) ≠ T; the unplugged scrambler E0 is shown as a PermTable; unlocked [plugboard], maxPlugs 2 → encode(K) = T · `machine`
   - `why-no-self` · choice(4) · once · constantAnswer (reflector pairs contacts; distractor "the plugboard prevents it")
   - `compose-inverse` · code · 2/3 · fnNames [compose, inverse], maxLines 8 each; cases: 20 random permutations at n = 6 and n = 26, identity, compose(inverse(p), p) = id, and the reflector as an involution; probe "compose(p, q) sends D to ?" for the 6-letter p and q shown · `none` plus the first failing case
   - fallback `plug-one` · set-machine: the same as `plug-to-hit` with maxPlugs 1

#### i4-permutations · Act I · order 4 · closes Act I

1. `notation` · story · people F5 (Rejewski) · date F5 · facts F6
2. `symbols` · explore · worked · `symbols` · introduces [notation] · bet `inverse` (choice: E applied twice returns the letter / gives a new letter / depends on the plugboard), reveal play (hold: press X, then E(X)) · task `hover-all` (focusing each coloured symbol highlights its part)
3. `tables` · explore · worked · `symbols` · shows [notation], freePress · View: the seven component tables at the current offsets, composed step by step into E · task `compose-all`
4. `gate` · gate `keypress`:
   - `keypress` · code · 2/3 · `enigmaKeypress(state, key, parts)` → `{output, positions}` using the provided `parts = {step, plugIn, etwIn, rotorFwd(slot, c), reflect, rotorBwd(slot, c), etwOut, plugOut}`, instrumented (`instrument: 'keypress-parts'`); maxLines 12; cases: 30 random configurations (rings, 0–10 plugs, positions near turnovers) plus the BDZGO sequence; probe "which letter leaves the middle rotor on the way back?" · `path` (the learner's recorded hops against the engine trace)
   - `which-wrong` · ghost-pick · 2/3 · a random configuration and key, plus one of 6 seeded bugs (no step first, middle and left swapped, backward uses the forward wiring, ring sign flipped, plugboard applied once, reflector skipped) → the part of the first divergent hop · `path`
   - `hop-chain-full` · chain(12: the windows after stepping, then 11 letters) · 2/3 · rings ≠ AAA, 2–6 plugs, half of the instances within 2 presses of a turnover · `path`
   - fallback `which-wrong`

#### ii5-indicators · Act II · order 5

1. `recall` · recall (3 Act I items)
2. `warsaw` · story · clock {date F5 (9 Dec 1932), caption "The tables covered September and October 1932: keys already expired. What they could reveal was the wiring."} · people Rejewski, Zygalski, Różycki, Schmidt, Bertrand (F5)
3. `double-key` · explore · worked · `wire` · `dayKey('1932')` at the Grundstellung; everything locked except the keyboard · introduces [indicator] · bet `halves` (choice: the halves match / they differ / only the first letter matches), reveal press · task `type-key-twice`
4. `ad-from-65` · explore · worked · no stage · View: REJEWSKI_65 and an editable PermTable · introduces [AD] · bet `ad-fixed` (choice: yes / no, "can AD send a letter to itself?"), reveal play (fill-all shows AD = (a)(bc)(dvpfkxgzyo)(eijmunqlht)(rw)(s)) · tasks `fill5`, `fill-all`
5. `gate` · gate `indicators`:
   - `fill-ad` · custom (PermTable) · inPage · 2/3 · `dayKey('1932')` plus 12–20 indicators from `makeIndicators` → the 8 AD cells determined by the shown indicators · `perm`
   - `ad-fixed-point` · choice(4) · once · constantAnswer, scored ("AD maps S to S: a faulty machine?" → no, AD is a product of two Enigma permutations; distractor "Enigma never maps a letter to itself")
   - `build-ad` · code · 2/3 · `buildAD(indicators: string[]): string` (26 characters, `?` for unknown); maxLines 10; cases include REJEWSKI_65 → vector 13 AD; probe "AD sends G to ?" for the shown day · `perm`
   - fallback `fill-ad`

#### ii6-cycles · Act II · order 6 · problem-first from here

1. `theorem` · story · people F5 (Rejewski) · date F5 (late 1932) · facts F7
2. `hexagon` · explore · no stage · View: CycleDiagram animating (ab)(cd)(ef)·(bc)(de)(fa) = (ace)(bfd) · introduces [paired-cycles] · bet `pairs` (choice: cycles come in equal-length pairs / all cycles have length 2 / no pattern), reveal play
3. `stecker-toggle` · explore · `plugboard` · `dayKey('1932')` at the Grundstellung; plugboard unlocked · View: a live CycleDiagram of `productsFromMachine(snapshot).AD` · introduces [invariance] · bet `lengths` (choice: they change / unchanged / sometimes), reveal toggle (`reveal-lengths` toggles a cable; the letters relabel and the lengths stay) · task `toggle3`
4. `align` · explore · no stage · View: CycleAlign (drag one cycle backwards under its partner; 13 alignments) · shows [paired-cycles] · task `try3`
5. `gate` · gate `cycles`:
   - `lengths` · numbers(multiset, range [0,26]) · 2/3 · the product of two random fixed-point-free involutions on n ∈ {8, 10, 12}, shown in two-line notation → the cycle lengths, descending · `cycles`
   - `relabel` · letters · 2/3 · the day's AD plus a new cable X–Y → the cycle of the new AD that contains X, starting at X (S·AD·S⁻¹) · `cycles`
   - `stecker-set` · set-machine · 2/3 · a day at the Grundstellung; X and Y in different AD cycles, each of length ≤ 3; unlocked [plugboard], exactly one new cable → X and Y share a cycle of the machine's AD · `machine`
   - `cycle-lengths` · code · 2/3 · `cycleLengths(perm: number[]): number[]` (descending); maxLines 10; probe "cycleLengths(AD) for this day"; cases: random permutations with n from 2 to 26 · `cycles`
   - fallback `stecker-set`

#### ii7-catalogue · Act II · order 7

Rings are AAA throughout; a story note says the Poles recovered ring settings separately.

1. `cyclometer-story` · story · people F5 (Rejewski) · date F8 · facts F8
2. `cyclometer` · explore · no stage · View: Cyclometer, with two `createMachineStore()` stacks offset by 3 and lamps that light a whole cycle · introduces [cyclometer] · bet `lamps` (number), reveal press · task `press3`
3. `catalogue` · explore · no stage · View: `getCatalogue('A')` with a progress bar; CatalogueHistogram; "about 1.03 million possible characteristics (101³) for 105,456 settings" · introduces [catalogue] · bet `bucket` (choice: about 1 / about 10 / about 1,000), reveal run · task `built`
4. `gate` · gate `catalogue`:
   - `signature` · letters · 2/3 · `dayKey('1936', rings AAA)`, with AD, BE and CF in cycle notation → `AD:… BE:… CF:…` (an input helper assembles it) · `cycles`
   - `lookup` · set-machine · inPage · 2/3 · trial preview · the same day plus 60 indicators and a message whose first 5 plaintext letters are given; a catalogue query tool; the preview uses the day's hidden plugboard; unlocked [rotors, positions] → the day's rotor order and Grundstellung · `machine`
   - `set-plugs` · set-machine · once · trial preview · rotors and positions preset correctly, plugboard empty; unlocked [plugboard], maxPlugs 6 → the message decrypts · `machine`
   - `lookup-transfer` · set-machine · once · **transfer** · a wheel order other than I-II-III (the scenes use only I-II-III); only the raw indicators are given, so the learner computes the products and the characteristic · `machine`
   - `rejewski-parsons` · order(6: collect indicators → AD/BE/CF → cycle lengths → catalogue lookup → set rotors and Grundstellung → recover the plugboard from a partial decrypt) · once · constantAnswer · `order`
   - fallback `lookup`

#### ii8-sheets · Act II · order 8 · **optional** (never blocks III.9)

1. `zygalski` · story · people F5 (Zygalski) · date F9 · facts F9
2. `females` · explore · no stage · View: indicators with repeats at distance 3 highlighted · introduces [female] · bet `survive` (choice ~10% / ~40% / ~90% of apertures survive a sheet), reveal play
3. `light-table` · explore · no stage · View: LightTable stacking engine-computed 51×51 sheets for a generated day · shows [female] · task `converge` (stack until ≤ 2 apertures remain)
4. `gate` · gate `sheets`:
   - `females-needed` · numbers(1, range [1,30], tolerance ±1) · 2/3 · N ∈ {17,576, 105,456, 1,054,560}, p ∈ [0.35, 0.45] → ⌈log(N/2)/log(1/p)⌉
   - `survivors` · numbers(1, tolerance ±10% relative) · 2/3 · N, p, k → N·pᵏ
   - fallback `stack-to-one` · custom inPage · stack sheets in LightTable until one aperture remains → [k, aperture index]

#### iii9-cribs · Act III · order 9

1. `recall` · recall (2 Act II items + 1 Act I item)
2. `pyry` · story · clock {date F13 (1 May 1940), caption "Overnight the doubled indicator disappeared, and the Polish methods stopped working."} · people Rejewski, Knox (F10, F11), Herivel (F13)
3. `crashes` · explore · no stage · View: CribStrip WSNPNLKLSTCS / ATTACKATDAWN (F21) · introduces [crash] · bet `fits` (choice: yes / no, at an offset with a crash), reveal toggle (slide) · task `slide`
4. `gate` · gate `cribs`:
   - `crash-free` · custom (CribStrip) · inPage · 2/3 · `cribbedMessage` with `dayKey('1940')`, 40–60 letters, 1–3 valid offsets → an offset with zero crashes · `crib`
   - `crash-count` · numbers(1, range [0, crib length]) · 2/3 · an offset k with ≥ 1 crash → the crash count · `crib`
   - `is-consistent-crib` · code · 2/3 · `isConsistentCrib(cipher, crib, offset): boolean`; maxLines 6; probe "the index of the first crash at offset k (−1 if none)" · `crib`
   - fallback `crash-free`

#### iii10-menus · Act III · order 10

1. `turing` · story · people F12 (Turing) · date F12 · facts F19
2. `menu-builder` · explore · no stage · View: MenuGraph for ATTACKATDAWN with a closure counter (F21) · introduces [closure] · bet `closures` (number of closures after all 12 edges), reveal toggle (the last edge is added) · task `add-all`
3. `loop` · explore · no stage · View: an 8-letter toy loop A→T→L→K with scrambler tables, "assume A↔x" · introduces [loop] · bet `stops` (choice: 2.2 / 1,500 / 40,000 stops for 8 letters and 3 closures), reveal play (Turing's table, F18) · task `follow-loop`
4. `gate` · gate `menus`:
   - `build-menu` · custom (MenuGraph) · inPage · 2/3 · a 12–16-letter crib whose menu can reach ≥ 2 closures, with a flagged turnover position → edges forming ≥ 2 closures, connected, ≤ 14 links, none past the turnover · `menu`
   - `closures` · numbers(1, range [0,10]) · 2/3 · a random 6–10-edge list → E − V + C · `menu`
   - `loop-return` · letter(8) · 2/3 · 3–4 toy scramblers around a loop plus a hypothesis → the letter that returns · `menu`
   - fallback `build-menu`

#### iii11-bombe · Act III · order 11 · **novel artefact**

1. `victory` · story · people F12/F14 (Welchman) · date F13 (18 Mar 1940, 8 Aug 1940) · facts F14
2. `wire-8` · explore · no stage · View: WireGrid n=8 stepping through each scrambler, and a TestRegister · introduces [wires] · bet `live8` (choice 1 / 7 / 8), reveal run
3. `wire-26` · explore · no stage · View: WireGrid n=26 on a fixed-seed `cribbedMessage` over ATTACKATDAWN, at the true position and at a false one · shows [wires] · bet `live26` (choice 1 / 25 / 26), reveal run
4. `diagonal` · explore · no stage · View: the whole wheel order (17,576 positions) run in the worker with the board off and on, with stop counts · introduces [diagonal] · bet `diag` (choice: fewer / the same / more stops with the board on), reveal run · task `both-runs`
5. `gate` · gate `bombe`:
   - `click-through` · chain · 2/3 · `toyBombe(n 8, 3–4 scramblers)` plus a hypothesis → the letter after each scrambler around the loop, then the verdict token (C = consistent, X = contradiction) · `wires`
   - `live-count` · numbers(1, range {1,7,8}) · 2/3 · instance classes rotate: the true position with the true hypothesis → 1; the true position with a false hypothesis → 7; a false position → 8. The generator verifies each with `propagate` · `wires`
   - `board-myth` · choice(4) · once · constantAnswer (no: Victory, Mar 1940, lacked it; Agnus Dei, Aug 1940, had it. Distractor "part of Turing's 1939 design")
   - fallback `grid-probe` · custom inPage · click the live wires of the test register in WireGrid after propagation · `wires`

#### iii12-checking · Act III · order 12 · closes Act III

Rings are AAA; a story note says ring settings were worked out afterwards.

1. `wrens` · story · people F22 (Welchman, head of Hut 6) · date F15 (March 1941, the first Wrens arrive as bombe operators)
2. `stops` · explore · no stage · View: a stop list from one wheel-order run in the worker · introduces [checking] · bet `true-stops` (choice: all are the key / most are false / none), reveal run
3. `checking-machine` · explore · `checking` · a machine without a plugboard at a stop · View: implied steckers tried along the crib · shows [checking], freePress · task `check2`
4. `gate` · gate `checking`:
   - `stop-verdict` · custom inPage · 2/3 · one stop: with p = 1/2 the true stop, otherwise the first false stop found scanning from a random position → `{verdict, letter}`: for a true stop, the test letter's partner; for a false stop, the letter forced to have two partners · `machine`
   - `set-key` · set-machine · once · trial preview · a `cribbedMessage` day with 10 plugs and rings AAA, with the stop tools available; unlocked [rotors, positions, plugboard] → the whole message decrypts · `machine`
   - fallback `stop-verdict`

#### iv-capstone · Act IV · order 13 · puzzle gates (first hint at attempt 3)

1. `recall` · recall (1 item each from Acts I, II and III)
2. `midnight` · story · clock {time '00:00', caption "A training exercise, framed openly. The clock marks the story, not you: nothing here is timed."} · people Rejewski (F5), Turing (F12) · date F16 (the secret kept until 1974)
3. `polish-tools` · explore · no stage · View: indicators → products → characteristic → catalogue query → decrypt preview · shows [AD, catalogue] · task `open-tools`
4. `polish` · gate `polish` (puzzle): `polish-key` · set-machine · once · trial preview · a fresh `dayKey('1936')` with 70 indicators and a message → the full key decrypts it. A new day on every retry. Fallback `polish-plugs` (set-machine: only the plugs are missing).
5. `british-tools` · explore · no stage · View: CribStrip, MenuGraph, a bombe run over the 3 candidate wheel orders (given as intelligence), checking · shows [crash, closure, wires] · task `open-tools`
6. `british` · gate `british` (puzzle):
   - `british-key` · set-machine · once · trial preview · a fresh `dayKey('1940')` plus a cribbed message → the key decrypts it
   - `read-intercepts` · letters(10) · 2/3 · fresh intercepts of the same day under the post-May-1940 procedure (start position sent in clear, message key enciphered once) → the first 10 plaintext letters
   - fallback `british-plugs` (set-machine: only the plugs are missing)

   Documented exception: the key items are `once` because they recombine sub-skills that were already gated on 2 of 3.

---
## 5. PR stack

**Sizes.**

| Size | Added lines (LOC) |
|---|---|
| S | < 400 |
| M | 400–1,200 |
| L | 1,200–2,500 |
| XL | > 2,500 |

"Hours" means slot wall-clock time for build, review and fix rounds together.

**Base branch.**
- A PR's base is the integration branch when all of its dependencies have merged by the time it starts.
- Otherwise its base is the single unmerged dependency's branch. Only 02, 03 (both on 01) and 04 (on 02's checkpoint) are planned that way.
- No PR ever has two unmerged dependencies.
- Chapter PRs start only after the pilot (07) has merged.

### 5.1 PRs

| NN | Branch `claude/enigma/…` | Base at start | Depends on | Scope (one line) | Exclusively owns (besides its briefs' test files) | Acceptance (summary; full list in §6) | Size · h |
|---|---|---|---|---|---|---|---|
| 01 | `01-foundation` | integration | – | Engine, store, `__enigma`, Playwright, CI (exists) | as built | as built | – |
| 02 | `02-platform` | `01-foundation` | 01 | Dependencies, configs, contracts v1, stores, rng, toy, keyspace, symbols, StageHost, hooks, stubs, registry, ownership, budget, bans, CI, deploy-ready | package files, configs, `ownership.json`, `scripts/`, `web.yml`, `src/{contracts,lib,state,stage,content,debug}/`, `App.tsx`, `router.ts`, `main.tsx`, `index.css`, `lint/`, `pages/StageLabPage.tsx`, e2e `fixtures`, `helpers/app`, `smoke`, `platform`, `deploy`; stubs listed in §2.1 | Checkpoint commit ≤ 1.5 h; store locks and hold; playback truth table; `dimmedParts`; toy involution; keyspace exact; all routes load with no console errors; Node imports a pure module; 404 and deep links; bans | L · 4.5 |
| 03 | `03-oracles` | `01-foundation` | 01 | Three-oracle agreement over 1,000 random configurations | `tools/oracles/**`, `.github/workflows/oracles.yml`, `web/src/engine/__tests__/oracles.test.ts`, `web/src/engine/__fixtures__/oracle-vectors.json` | Oracles agree; engine matches every case; `--check` detects staleness | S · 1.5 |
| 04 | `04-machine-ui` | `02-platform` @ `[contracts-v1]` | 02 | DOM machine, trace, playback bar, announcer, tape, PermTable, share codec, Stage2D, sandbox | `src/machine-ui/**`, `src/stage2d/**`, `pages/SandboxPage.tsx`, e2e `machine-ui`, `sync`, `stage2d`, `helpers/machine` | Keyboard-only use; announcer text; locks disable controls; codec round trip × 1,000; 2D sync spec (50 presses, 5 readings); Stage2D reports `dimmedParts`; axe; 390 px | L · 4.5 |
| 05 | `05-lesson` | integration | 02 | Scoring reducer, item kinds, chapter machine, progress, gate/scene/story/bet/recall UI, rollback, return check, code runner (textarea), `__course`, validator, lint, guess bot, purity, fixture chapter, course map, walk and review scripts | `src/lesson/**`, `src/code/**`, `pages/{Course,Chapter,GateLab,Fixture}Page.tsx`, e2e `lesson`, `course`, `walk`, `helpers/course`, `review/**` | Truth tables (§3.5); ladder normal and puzzle; gaming; seeds; corrupt quarantine; runner kills an infinite loop; all §7 chapter-DoD assertions pass on the fixture | XL · 5 |
| 06 | `06-machine3d-core` | integration | 02 | Procedural 3D machine core with focus, labels, pawls, two-layer rotors, `__stage` report and stats, context-loss fallback | `src/machine3d/**` except the stubs it creates for 11 | Layout maths; test-renderer structure; `@3d`: SwiftShader string, presets report `dimmedParts`, windows sync through ADU, ≤ 120 calls, 0 idle frames, no geometry growth, context loss → 2D | L · 5 |
| 07 | `07-pilot-i2` | integration | 04, 05 (06 if merged) | **Contract pilot**: chapter I.2 end to end; optional `[contracts-v2]` commit | `src/chapters/i2-stepping/**`, `e2e/chapters/i2-stepping.spec.ts`; plus additive changes in the `[contracts-v2]` commit only | Chapter DoD (§7.1) in 2D, and in 3D if 06 has merged | M · 3 |
| 08 | `08-cryptokit` | integration | 02 | Rejewski kit, catalogue worker, cribs, menus, bombe worker, generators, viz, viz lab | `src/crypto/**`, `src/viz/**`, `pages/VizLabPage.tsx`, e2e `viz` | Vectors 13 and 14; invariance × 1,000; factorisations = 20; 105,456 entries; catalogue < 10 s in the browser; true stop found 20/20; board never adds stops; configurations valid | L · 4.5 |
| 09 | `09-act1-a` | integration | 07 | Prologue, I.1, HomePage guided entry | `chapters/{prologue,i1-anatomy}/**`, `pages/HomePage.tsx`, e2e `chapters/{prologue,i1-anatomy}`, `home` | Chapter DoD | L · 3.5 |
| 10 | `10-act1-b` | integration | 07 | I.3, I.4 (first code gates, ghost rollback) | `chapters/{i3-reflector-plugboard,i4-permutations}/**`, specs | Chapter DoD plus the code-gate DoD | L · 4 |
| 11 | `11-machine3d-signal` | integration | 06 | Signal tube and head, ghost tube, reflector arcs, cables, Bloom (lazy), M4 slot, toy geometry for n = 6 and 8 | `src/machine3d/{signal,effects}/**`, `parts/{Reflector,Cables,ToyGeometry}.tsx`, e2e `machine3d-signal` | `pathPoints` = 2 + 2·hops; the 3D sync spec; 13 arcs; cables = pairs; reduced motion draws the full path; toy renders | L · 4.5 |
| 12 | `12-act2-a` | integration | 07, 08 | II.5, II.6 | `chapters/{ii5-indicators,ii6-cycles}/**`, specs | Chapter DoD plus code-gate DoD; a stecker toggle keeps the lengths | L · 4 |
| 13 | `13-act2-b` | integration | 07, 08 | II.7, II.8 | `chapters/{ii7-catalogue,ii8-sheets}/**`, specs | Chapter DoD; catalogue built in the page in < 10 s | L · 4 |
| 14 | `14-act3-a` | integration | 07, 08 | III.9, III.10 | `chapters/{iii9-cribs,iii10-menus}/**`, specs | Chapter DoD plus code-gate DoD | M · 3.5 |
| 15 | `15-act3-b` | integration | 07, 08 | III.11, III.12 (bombe wire view) | `chapters/{iii11-bombe,iii12-checking}/**`, specs | Chapter DoD; test register = `propagate`; board toggle changes the stop count | L · 5 |
| 16 | `16-capstone` | integration | 07, 08 | IV capstone, both routes | `chapters/iv-capstone/**`, spec | Chapter DoD; puzzle ladder; a new day on retry | M · 3.5 |
| 17 | `17-release` | integration | all | CodeMirror editor, full 3D walk, axe on every route, 390 px, final budgets, README, deploy-ready, fixes for the minor backlog | `code/CodeEditor.tsx` (transfer), `web.yml` (transfer), `README.md`, e2e `a11y`, `layout`, `release`; any file for a listed fix (nothing else is in flight) | Full suite plus walk in 2D and 3D green; upload-pages-artifact green on the integration push; zero console errors | M · 3.5 |
| 90–99 | `9N-hotfix-*` | integration | – | Coordinator hotfixes: contract changes, integration breaks | as stated by the coordinator | Its own regression test | S |

### 5.2 Dependency graph

```
01 ─┬─ 03 (leaf)
    └─ 02 ─┬─[contracts-v1]─ 04 ─┐
           ├─ 05 ────────────────┼─ 07 pilot ─┬─ 09, 10                      (Act I)
           ├─ 06 ─── 11          │            └─ with 08: 12, 13, 14, 15, 16  (Acts II–IV)
           └─ 08 ────────────────┘
   everything ── 17 release
```

### 5.3 Wave schedule (2 concurrent agents in total, reviewers included)

The cap is `min(16, CPUs − 2) = 2` agents at once on this 4-CPU box (scratchpad `lessons.md`). **A slot runs one agent at a time**: the builder, then the reviewer, then the builder's fix round, then the reviewer again. The coordinator (the orchestrating session) merges, retargets and watches CI between agents; it runs no builds itself.

Each agent runs Playwright with 1 worker and Vitest with `maxWorkers: 2`. T0 is when 02's builder starts. All times are estimates in hours.

| Hours | Slot A | Slot B |
|---|---|---|
| 0–1.5 | 02 platform (`[contracts-v1]` pushed at ~1.5) | 03 oracles (build + review) |
| 1.5–4.5 | 02 (finish → review → merge) | 04 machine-ui, from the checkpoint |
| 4.5–6 | 05 lesson | 04 (merges final 02, review, merge ~6) |
| 6–9.5 | 05 (review, merge ~9.5) | 06 machine3d-core |
| 9.5–11 | 07 pilot I.2 | 06 (review, merge ~11) |
| 11–12.5 | 07 (review, merge ~12.5), with 3D if 06 has merged | 08 cryptokit |
| 12.5–15.5 | 09 act1-a | 08 (review, merge ~15.5) |
| 15.5–16 | 09 (merge ~16) | 11 machine3d-signal |
| 16–20 | 10 act1-b | 11 (review, merge ~20) |
| 20–24 | 12 act2-a | 13 act2-b |
| 24–27.5 | 14 act3-a | 15 act3-b (→ 29) |
| 27.5–31 | 16 capstone | 15 → buffer: hotfixes and minor backlog |
| 31–34.5 | 17 release | idle, or 17's reviewer |

**Queue rule.** When a slot frees up, it takes the highest-priority ready PR, in the order 02, 03, 04, 05, 06, 07, 08, 09, 10, 11, 12, 13, 15, 14, 16, 17. A PR is ready when its dependencies have merged, or when its checkpoint exists (04). A hotfix (90–99) jumps the queue. If the cap is verified to be 3 or more, a third slot pulls from the same queue and the makespan drops to about 25 h.

### 5.4 Critical path and milestones

- **Dependency critical path:** 01 → 02 → 05 → 07 pilot → 15 bombe chapter (also needs 08) → 17. That is 4.5 + 5 + 3 + 5 + 3.5 ≈ **21 h**.
- **Capacity-bound path**, which sets the makespan: slot A runs 02 → 05 → 07 → 09 → 10 → 12 → 14 → 16 → 17, which is **≈ 34.5 h**.
- The 3D chain (06 → 11) and the crypto kit (08) sit in slot B, have slack, and are never on the path to the pilot.

| Milestone | Content (every PR merged into integration, CI walk green on the integration push) | Planned | Checkpoint |
|---|---|---|---|
| M1: standalone explainer | 02, 04, 05, 06, 07, 09, 10, 11 (and 03). Platform, DOM and 3D machine with signal, gate engine, sandbox, Prologue and Act I | T+20 | CP2 = T+22 |
| M2: Rejewski attack | 08, 12, 13 (Act II) | T+24 | CP3 = T+27 |
| M3: bombe | 14, 15 (III.9–III.12) | T+29 | CP4 = T+32 |
| M4: course complete | 16, 17 (capstone, release) | T+34.5 | CP5 = T+37 |

An earlier checkpoint, **CP1 = T+11**, requires 02, 04 and 05 merged and 07 started. The cut rules tied to each checkpoint are in §8.

---
## 6. Per-PR builder briefs

**How the coordinator sends a brief.** The coordinator pastes §6.0 and the PR's own brief into the builder's prompt. It replaces `<PLAN>` with this file's absolute path (`/tmp/claude-0/-home-user-enigma-simulator/7b4cd966-efd5-5447-923a-f72b4aa913f2/scratchpad/plans/final.md`), `<ATTRIBUTION>` with the two commit trailer lines, and `<PR_FOOTER>` with the PR footer it supplies.

### 6.0 Standing orders (part of every brief)

````text
STANDING ORDERS: builder for PR NN. Apply them together with your PR brief.

1. Scope. You build exactly one PR, in one worktree. Read <PLAN> §2, §3, §7.1, and the §4 sections your brief names.
   Also read web/README.md and the files you extend. §3 and §4 are normative: implement their names and
   signatures verbatim.

2. Setup. Use the base branch named in your brief.
     git -C /home/user/enigma-simulator fetch origin
     git -C /home/user/enigma-simulator worktree add /home/user/wt/NN-name -b claude/enigma/NN-name origin/<base>
     cd /home/user/wt/NN-name/web && npm ci
   If the worktree already exists (a fix round), cd into it and run:
     git fetch origin && git merge --no-edit origin/<current base>

3. Ownership.
   - Touch only the paths your brief lists. web/ownership.json and scripts/ownership-check.mjs enforce this inside
     `npm run check`. For a stacked PR, set OWNERSHIP_BASE=origin/<base branch>.
   - If you need a change in a file you do not own, stop. Report:
       BLOCKED: <file> owned by <PR>: <exact proposed diff>
   - Never edit package.json or package-lock.json (only 02 may).
   - Never edit src/engine/** (frozen; only 03 may add its two test files).
   - Never edit CLAUDE.md.

4. Environment.
   - Node 22, 4 CPUs shared with one other agent.
   - @playwright/test stays at exactly 1.56.0. It matches the Chromium 141 in /opt/pw-browsers. NEVER run
     `npx playwright install` locally.
   - Always set E2E_PORT=41NN (NN = your PR number). The reviewer uses 51NN.
   - Playwright runs with --workers=1. Vitest runs with maxWorkers 2.
   - Keep each local e2e command under 6 minutes: run only your own tags plus @smoke|@platform. The full suite and
     the walk run in CI.

5. Code rules.
   - TypeScript strict with erasableSyntaxOnly: no enums, namespaces or parameter properties.
   - 2-space indent, no semicolons, single quotes, about 120 columns.
   - No console.log in src/.
   - No Math.random in gates, rules or crypto: use Rng from lib/rng.
   - Every *.test.tsx starts with the line: // @vitest-environment happy-dom
   - E2E specs:
     - import { test, expect } from './fixtures' (or '../fixtures');
     - assert state through __enigma, __stage and __course, never pixels;
     - never use waitForTimeout, test.only or toHaveScreenshot;
     - every spec has a tag: @smoke, @platform, @area:<x>, @chapter:<id>, @3d, @sync or @walk.
   - Budgets:
     - each chapter spec ≤ 60 s;
     - entry chunk ≤ 170 kB gz;
     - 3D chunk ≤ 400 kB gz, and never in the entry chunk;
     - effects chunk ≤ 130 kB gz;
     - each chapter chunk ≤ 80 kB gz;
     - code-editor chunk ≤ 150 kB gz.

6. Contracts. If a contract is insufficient, do not change it. The only exceptions are 02 before [contracts-v1],
   and 07's single [contracts-v2] commit. Solve the problem inside your own files if you can; otherwise report
   BLOCKED with a proposed additive amendment.

7. Commits and pushes.
   - Make small commits. Every message ends with a blank line followed by:
       <ATTRIBUTION>
   - Never rebase, amend a pushed commit, or force-push.
   - Integrate your base only with: git merge --no-edit origin/<base>
   - When the coordinator tells you your base was retargeted to claude/intelligent-hamilton-r0i6wz, run:
       git fetch origin && git merge --no-edit origin/claude/intelligent-hamilton-r0i6wz
     Then run the whole pre-push checklist again.

8. Before every push, run the <PLAN> §7.1 checklist and fix whatever fails.
   Push: git push -u origin claude/enigma/NN-name
   First push: open the PR with the GitHub MCP tool mcp__github__create_pull_request:
     owner 'abazabaaa', repo 'enigma-simulator', base <your base branch>, head claude/enigma/NN-name,
     title 'NN · <title>', body = <PLAN> §7.4 template, ending with <PR_FOOTER>.
   Later pushes: update the Verification section with mcp__github__update_pull_request.

9. Final message (your return value), plain text:
   - PR URL and head SHA
   - branch and base
   - every checklist command with its result and test counts (unit, e2e per project)
   - bundle sizes
   - ownership-check output
   - the slowest 3 specs with their durations
   - screenshots you read (paths)
   - known gaps
   - BLOCKED items
   - proposed contract amendments

10. Fix rounds. The coordinator forwards review findings.
    - Fix every BLOCKER and MAJOR.
    - Add one regression test for each BLOCKER.
    - Answer each MINOR (fix it, or defer it with a reason).
    - Push new commits, update the PR's "Review rounds" section, and report as in 9.
````

**Chapter PR template (applies to briefs 07, 09, 10, 12, 13, 14, 15 and 16):**

````text
CHAPTER PR TEMPLATE

Files, for each chapter <id> you own:
  src/chapters/<id>/index.ts         default export ChapterDef: { id, scenes, gates: bindGates(GATES, ITEM_UI), facts: FACTS }
  src/chapters/<id>/gates.ts         export const GATES: ChapterGates. PURE (see <PLAN> §3.13 L4). Build items with
                                     lesson/kinds builders. Generators use only engine, lib/rng, lib/toy, crypto.
  src/chapters/<id>/items.tsx        export const ITEM_UI: ItemUiMap: Prompt, Worked, Answer (custom), Feedback where required
  src/chapters/<id>/facts.ts         export const FACTS: Fact[], taken only from <PLAN> §4.3 (or the research notes, with https sources)
  src/chapters/<id>/scenes/*.tsx     scene Views (explore/gate bodies). No story prose. No 19xx years.
  src/chapters/<id>/__tests__/gates.test.ts   chapter-specific generator and check tests
  e2e/chapters/<id>.spec.ts          tag @chapter:<id>; ≤ 60 s at 1 worker in project 2d; plus one @3d smoke test
                                     of the first mechanism scene (skipped when MACHINE_3D_READY is false)

Implement the scenes, items, generators, hints, rollbacks and fallbacks exactly as listed in <PLAN> §4.4 for your chapters.
Use generic kinds wherever §4.4 names one. Custom items render their own Answer and Feedback with viz/ or
machine-ui/ components.

Definition of done:
 - `npm test` is green, including lesson/validate, lint (300 seeds), guess bot (< 1%), CC learner and purity, which
   now cover your chapter. Never weaken or skip them.
 - The chapter spec proves, using helpers from e2e/helpers/course.ts:
   0. Setup in beforeEach: gotoApp(page, '/c/<id>', { stage: '2d' }) with ?e2e=1, then
      __course.configure({ minLatencyMs: 0, burstMs: 0, playback: 'instant' }) and unlockAll() for chapters after
      the prologue. Recall scenes are answered with solveInNode, which also resolves recall-pool items.
   1. Every scene is visited in order. scene-next is aria-disabled before completion and enabled after.
   2. Every reveal:
      - before the bet: the trigger is disabled, __stage.playback().gated is true and t is 0, and
        __enigma.pressKey throws for press triggers;
      - after committing the bet through the UI (bet-option-*, bet-commit-*): the trigger fires and t reaches the end.
   3. Every staged scene: __stage.info().focus equals the declared focus, and dimmed equals dimmedParts(focus, model)
      (import dimmedParts from src/contracts/stage.ts in Node).
   4. Every item:
      a. One wrong answer through the UI. Then rollback[data-kind] equals the <PLAN> §4.1 table entry. Continue.
         Then hint-panel[data-hint-level="1"] is shown, and __stage.info().highlighted contains the L1 parts
         (for items with stage highlights).
      b. At least one correct instance entered through the real widget.
      c. The remaining instances via __course.answer(itemId, solveInNode(page)).
      d. item-<id>[data-passed] turns true exactly when the rule is met.
   5. assertNoAnswerLeak before each submit.
   6. Set-machine items: key-A is disabled; __enigma.pressKey('A') throws; lamps are hidden; moving controls
      emits no item.submit.
   7. A reload mid-gate keeps __course.gate().current.seed and the instance.
   8. The chapter.complete event fires, and the next chapter's link unlocks.
 - Code-gate chapters also prove:
   - code-run is disabled until gate-prediction has text;
   - the reference solution typed into code-editor with a wrong probe gives an incorrect result;
   - wrong code with the right probe gives an incorrect result;
   - the agent-paste probe: reference code and the Node-computed probe pass the code item, but the gate stays
     unpassed while the inPage item is wrong.
 - Commands (in addition to §7.1): E2E_PORT=41NN npx playwright test --project=2d --grep @chapter:<id> --repeat-each=3
````

### 6.1 Brief 02 · `02-platform` (base `claude/enigma/01-foundation`; worktree `/home/user/wt/02-platform`; E2E_PORT 4102)

````text
GOAL
Lay the platform every later PR builds on:
 - dependencies and configs;
 - contracts v1;
 - stores;
 - lib (rng, toy, keyspace, symbols);
 - StageHost and the __stage hook;
 - routes with lazy page stubs;
 - the chapter registry with placeholders;
 - ownership, budget and bans enforcement;
 - CI;
 - deploy-ready build output.
Push a CHECKPOINT early so 04 can branch from it.

READ
<PLAN> §2 (all), §3 (all), §4.1 G10/G11/G14, §5, §7.1. Also the foundation code: src/engine/index.ts,
state/machineStore.ts, debug/windowApi.ts, router.ts, App.tsx, main.tsx, playwright.config.ts, vite.config.ts,
.github/workflows/web.yml.

OWN
 - web/package.json, web/package-lock.json, web/vite.config.ts, web/playwright.config.ts,
   web/playwright.review.config.ts, web/tsconfig*.json, web/index.html, web/ownership.json
 - web/scripts/{ownership-check,budget,postbuild}.mjs
 - .github/workflows/web.yml
 - web/src/{contracts,lib,state,stage,content,debug,lint}/**
 - web/src/{App.tsx,router.ts,main.tsx,index.css}
 - web/src/pages/StageLabPage.tsx
 - web/e2e/{fixtures.ts,helpers/app.ts,smoke.spec.ts,platform.spec.ts,deploy.spec.ts}
 - web/README.md (Scripts, Flags and Layout sections)
STUBS you create, which are then owned by others (list them under "stubs" in ownership.json):
 - src/machine-ui/index.ts (→04), src/stage2d/index.tsx (→04), src/machine3d/{ready.ts,index.tsx} (→06)
 - src/pages/{SandboxPage→04, CoursePage→05, ChapterPage→05, GateLabPage→05, FixturePage→05, VizLabPage→08,
   HomePage→09}.tsx
 - src/chapters/<14 ids>/index.ts placeholders (→ the chapter PRs)

STEP 1: CHECKPOINT (≤ 90 min). One commit whose message contains [contracts-v1]. Push it at once and report its SHA
to the coordinator in a short message, then continue.
 a. Dependencies, exact pins, installed with npm i -E:
    - react 19.3.0, react-dom 19.3.0, zustand 5.0.15
    - three 0.186.1, @react-three/fiber 9.8.1, @react-three/drei 10.7.9
    - @react-three/postprocessing 3.1.3, postprocessing 6.39.5
    - xstate 5.33.2, @xstate/react 6.1.0
    - @codemirror/state 6.7.6, @codemirror/view 6.43.13, @codemirror/commands, @codemirror/language,
      @codemirror/lang-javascript (latest 6.x, exact)
    - dev: @types/three (0.186.x, exact), @react-three/test-renderer 9.1.1, happy-dom (latest, exact),
      @axe-core/playwright (latest 4.x, exact)
    - @playwright/test STAYS 1.56.0
    - Do NOT add gsap, react-spring, MDX, Monaco or Pyodide. Animation is a pure function of the playback clock.
 b. vite.config.ts:
    - test.include ['src/**/*.test.{ts,tsx}'], environment 'node', maxWorkers 2, testTimeout 30000;
    - build.manifest true;
    - base unchanged (VITE_BASE).
 c. playwright.config.ts:
    - PORT = E2E_PORT, required unless CI (throw 'Set E2E_PORT: builders 41NN, reviewers 51NN'); CI default 4173;
    - reuseExistingServer: false; workers: CI ? 2 : 1; retries: CI ? 1 : 0; failOnFlakyTests: !!CI; forbidOnly: true;
    - SwiftShader args plus --ignore-gpu-blocklist;
    - projects:
      2d:   grepInvert /@3d|@walk/, option stage '2d', reducedMotion 'reduce'
      3d:   grep /@3d|@sync/, option stage '3d', reducedMotion 'no-preference'
      walk: grep /@walk/, option stage '2d', timeout 300000
    playwright.review.config.ts: testDir e2e/review, the same webServer, outputDir review-artifacts/.
 d. package.json scripts:
      build     "vite build && node scripts/postbuild.mjs"
      check     "npm run typecheck && npm run test && npm run build && node scripts/budget.mjs && node scripts/ownership-check.mjs"
      e2e       "playwright test --project=2d --project=3d"
      e2e:pr    "playwright test --project=2d"
      e2e:3d    "playwright test --project=3d"
      e2e:walk  "playwright test --project=walk"
      review    "playwright test -c playwright.review.config.ts"
    Keep the existing scripts.
 e. src/contracts/{core,machine,stage,lesson,code,progress,hooks}.ts and index.ts: <PLAN> §3 verbatim, including
    the runtime helpers CHAPTER_IDS, STAGE_PRESETS (the §3.3 table), resolveStage, ALL_PARTS, dimmedParts, hopAt,
    isLit, STEP_MS and HOP_MS.
 f. All stubs with the exact §3.10 props:
    - machine-ui stubs render minimal working DOM (26 key buttons that call store.pressKey, with the test IDs);
    - stage2d/index.tsx exports a component that renders null and calls onReport with renderer 'placeholder';
    - machine3d/ready.ts: export const MACHINE_3D_READY = false;
    - machine3d/index.tsx renders null;
    - the page stubs render a heading;
    - chapter placeholders are one story scene reading "Being written".
 g. ownership.json:
      { version: 1,
        prs: { "NN": { owns: [...globs], stubs?: [...], amend?: { tag: "[contracts-v2]", paths: [...] } } },
        coordinator: ["CLAUDE.md", "web/ownership.json"] }
    Take the entries from <PLAN> §5.1. Globs are REPO-ROOT relative: §5.1's `src/…` and `e2e/…` mean `web/src/…` and
    `web/e2e/…`. 07 gets amend paths src/contracts/**, src/lesson/**, src/machine-ui/**,
    src/stage2d/**, src/state/**. 17 gets owns ["**"].
    scripts/ownership-check.mjs:
    - PR number from --pr, else OWNERSHIP_PR (CI sets it from github.head_ref), else the branch name claude/enigma/NN-*;
    - base = OWNERSHIP_BASE, else origin/claude/intelligent-hamilton-r0i6wz;
    - changed files = git log --no-merges --name-only --format= <base>..HEAD;
    - each file must match the PR's owns (or stubs for 02), or its amend paths when the commit message has the tag;
    - on other branches (integration, master) print "ownership: skipped" and exit 0.
 h. `npm run typecheck` and `npm run build` must be green at the checkpoint.

STEP 2: IMPLEMENT
 - state/machineStore.ts
   - Keep 01's MachineStore members verbatim. Add seq, locks and every setter from §3.2, with lock enforcement and
     MachineLockedError.
   - hold makes pressKey use encodeLetter and return PressResult { state unchanged, stepping: {stepped all false,
     doubleStep false, before = after = current} }.
   - setModel defaults as in §3.2.
   - snapshot(): the config with the CURRENT positions.
   - createMachineStore(init) returns isolated instances. useMachineStore = createMachineStore().
 - state/activeMachine.tsx: MachineProvider, useMachine, useMachineApi.
 - state/playbackStore.ts: §3.2 plus usePlaybackClock. The clock is rAF-driven, idles when not playing, and calls
   finish immediately when speed is 'instant' or motion is reduced.
 - state/stageStore.ts, state/toyStore.ts, state/uiStore.ts (prefs from flags and matchMedia).
 - state/sync.ts: installSync() subscribes to the default machine store's seq and the toy store's seq and calls
   playback.play. It also keeps locks.keyboard and playback.gated in step with the pending-bet flag (setPendingBet).
 - lib/rng.ts: identical mulberry32 (test against engine/__tests__/helpers.ts); seedFor (FNV-1a); helpers;
   randomConfig, which must always pass validateConfig.
 - lib/toy.ts: toyPress, toyPermutation, randomToy. Stages as §3.2; lamp letters A…F or A…H.
 - lib/keyspace.ts (BigInt), lib/symbols.ts, lib/Sym.tsx, lib/storage.ts (try/catch localStorage with a memory
   fallback), lib/flags.ts (parse ?e2e, ?stage, ?motion, ?seed before the hash; e2e persists in sessionStorage),
   lib/reducedMotion.ts.
 - stage/StageHost.tsx (§2.6):
   - static import of machine3d/ready.ts;
   - React.lazy of machine3d/index.tsx;
   - WebGL2 probe (a canvas getContext('webgl2'), cached);
   - fallback to 2D on onError with console.warn;
   - data-testid="stage" with data-renderer and data-focus.
   stage/StagePlaceholder.tsx prints the directive. stage/stageApi.ts installs window.__stage (StageInfo from the
   latest report + directive + playback; stats() returns null unless the 3D view registered a stats provider:
   registerStageStats(fn)).
 - debug/windowApi.ts: unchanged API. pressKey propagates MachineLockedError (the message names the lock).
 - router.ts: parse `#/path?query`. useRoute() returns { path, params, query }. matchRoute(pattern, path).
 - App.tsx: the routes in <PLAN> §2.3 with React.lazy pages, plus a Suspense fallback.
 - main.tsx: applySymbolTokens(); installWindowApi(); installStageApi(); installSync(); usePlaybackClock() mounted
   in App.
 - pages/StageLabPage.tsx: #/lab/stage?preset=<id>&locks=<csv>&model=<I|M3|M4>&ghost=demo&toy=6|8. It shows a
   StageHost with resolveStage(preset), a preset list, the locks applied to the default store, and a minimal key row.
   ghost=demo calls stageStore.setGhost with a fixed hop list that diverges at hop 4. toy=6|8 sets
   useToyStore to randomToy(seed 1) with source 'toy'. It also shows a keyspace line (formatSci(keyspace())).
 - content/registry.ts: 14 ChapterMeta. Acts P, I×4, II×4, III×4, IV. Orders 0–13. ii8 optional. dates strings.
 - scripts/budget.mjs: read dist/.vite/manifest.json.
   - entry = index.html chunk plus its static imports, gzip sum ≤ 170 kB;
   - 3D = the closure of src/machine3d/index.tsx minus entry, ≤ 400 kB;
   - effects = src/machine3d/effects/index.tsx, ≤ 130 kB;
   - each src/chapters/*/index.ts own file ≤ 80 kB;
   - code editor = src/code/CodeEditor.tsx closure, ≤ 150 kB;
   - print a table; exit 1 when over budget.
 - scripts/postbuild.mjs: copy dist/index.html to dist/404.html.
 - web.yml per <PLAN> §2.8:
   - push branches [master, claude/intelligent-hamilton-r0i6wz];
   - jobs check, e2e (2 shards), e2e-3d, walk (push/dispatch only), pages-artifact (push to integration or master),
     deploy (master only);
   - timeout-minutes 30; fetch-depth 0; OWNERSHIP_BASE on pull_request;
   - a loop `for f in tools/export_*.py; do python3 "$f" --check; done`;
   - upload the report on failure.
 - e2e/fixtures.ts:
   - extends test with a worker option stage ('2d'|'3d');
   - an auto fixture that fails the test on console 'error', pageerror or requestfailed (same-origin);
   - an addInitScript that records webglcontextlost into window.__contextLost, which fails the test unless the test
     calls allowContextLoss();
   - exports test and expect.
   e2e/helpers/app.ts: gotoApp(page, hash, { e2e = true, stage? }) builds './?e2e=1&stage=<stage>#<hash>' and waits
   for #root content.
 - src/lint/bans.test.ts: <PLAN> §3.13 L5.
 - README: document the scripts, flags, ports and ownership.

TESTS
 - Unit:
   - rng: 1,000 draws equal the engine helper; seedFor known values.
   - randomConfig: 1,000 configs pass validateConfig for I, M3 and M4.
   - toy: toyPermutation is a fixed-point-free involution for n = 6 and 8 over 1,000 specs × positions; stepping
     advances like an odometer; held toys don't step.
   - keyspace: plugboardCount(10) = 150738274937250n, keyspace() = 158962555217826360000n, rings × 676n,
     pairedPartitions() = 101.
   - store:
     - AAAAA → BDZGO through the store;
     - each setter throws MachineLockedError when locked, and setConfig ignores locks;
     - pressKey throws with the keyboard locked;
     - hold equals encodeLetter and leaves positions unchanged;
     - setModel gives valid configs;
     - snapshot has the current windows;
     - two store instances are isolated;
     - seq increments.
   - playback: hopAt truth table (t 0, 0.5, 1, 1.99, 2, 11.9, 12 with hops 11); instant; gated pins t; tick.
   - stage: resolveStage merges; dimmedParts for every preset and for M4.
   - symbols: symForStage covers all 13 stages.
   - ownership-check on a synthetic git repo in a temp dir.
 - E2E:
   - smoke.spec (@smoke):
     - every route in App loads with no console errors;
     - 01's engine.spec still passes;
     - WebGL2 probe: log the WEBGL_debug_renderer_info string and expect /SwiftShader/i.
   - platform.spec (@platform):
     - #/lab/stage?preset=pawls: __stage.info().renderer is 'placeholder' (2D stub), directive.focus is 'pawls',
       dimmed equals dimmedParts imported IN NODE from src/contracts/stage.ts (this proves the Node import of pure
       src modules);
     - &locks=keyboard: __enigma.pressKey('A') rejects with /keyboard/;
     - ?stage=3d with MACHINE_3D_READY false still renders the placeholder.
   - deploy.spec (@smoke): GET 404.html returns 200 and boots the app; each route in <PLAN> §2.3 deep-links under
     the base path.

COMMANDS: <PLAN> §7.1 with tags "@smoke|@platform".
REPORT: also the checkpoint SHA, and the budget table.
````

### 6.2 Brief 03 · `03-oracles` (base `claude/enigma/01-foundation`; worktree `/home/user/wt/03-oracles`; no e2e)

````text
GOAL
Check the engine against three independent oracles over 1,000 random configurations:
 - @ondoher/enigma 1.0.14 (npm);
 - py-enigma 1.0.2 (pip);
 - tools/reference_enigma.py (in the repo; import it, don't edit it).

OWN
 - tools/oracles/**
 - .github/workflows/oracles.yml
 - web/src/engine/__tests__/oracles.test.ts
 - web/src/engine/__fixtures__/oracle-vectors.json
You branch from 01. Do NOT touch web/package.json, the configs or web.yml.

IMPLEMENT
 - tools/oracles/package.json: private; the dependency @ondoher/enigma 1.0.14, exact; its own lockfile.
 - tools/oracles/generate.mjs [--check]:
   - Seeded (mulberry32 seed 20260928).
   - 1,000 cases:
     - models I, M3 and M4;
     - rotors including IV–VIII;
     - rings including A and Z extremes;
     - 0–13 plugs;
     - 200 texts of 1,000 letters and 800 texts of 20–60 letters.
   - Each case is computed by every oracle that supports it. Record `oracles: [...]`; each case needs at least 2,
     one of which is the reference.
   - Fail on any disagreement.
   - Write web/src/engine/__fixtures__/oracle-vectors.json (≤ 1.5 MB, stable key order).
   - --check regenerates in memory and diffs, exiting 1 when stale.
 - tools/oracles/ref_batch.py: sys.path-imports tools/reference_enigma.py and reads JSON batches on stdin.
   tools/oracles/py_batch.py does the same with py-enigma.
   - Use a venv at tools/oracles/.venv (git-ignored through tools/oracles/.gitignore).
   - If pip cannot install py-enigma locally, generate with the other two oracles. Mark the file
     "pyEnigma":"ci-only". CI must then verify all three.
 - oracles.test.ts (node env): the engine's encipher reproduces every case.
 - .github/workflows/oracles.yml:
   - triggers: push to [master, claude/intelligent-hamilton-r0i6wz] and pull_request, with paths tools/oracles/**
     and web/src/engine/**;
   - steps: setup-node 22, setup-python 3.11, pip install py-enigma==1.0.2, npm ci in tools/oracles,
     node generate.mjs --check;
   - then npm ci and npx vitest run src/engine/__tests__/oracles.test.ts in web/.

TESTS
Vitest, all cases. Also a test that generate.mjs --check exits 1 after a fixture byte is flipped: run it in a temp copy.

COMMANDS
 - cd web && npm ci && npm run check
 - cd ../tools/oracles && npm ci && node generate.mjs --check
 - python3 ../reference_enigma.py
No Playwright. Your reviewer checks the agreement tables and runs the commands.

REPORT
Which oracles cover which models; the case count; the fixture size.
````

### 6.3 Brief 04 · `04-machine-ui` (branch from 02's `[contracts-v1]` commit; worktree `/home/user/wt/04-machine-ui`; E2E_PORT 4104)

````text
GOAL
Build the accessible DOM machine, the synced trace and playback controls, the paper tape and share URL, the SVG
Stage2D, and the #/machine sandbox.

SETUP
 - Branch at the [contracts-v1] SHA the coordinator gives you:
     git worktree add /home/user/wt/04-machine-ui -b claude/enigma/04-machine-ui <sha>
 - PR base: claude/enigma/02-platform.
 - Before final verification: git merge --no-edit origin/claude/enigma/02-platform.
 - Set OWNERSHIP_BASE=origin/claude/enigma/02-platform.

READ
<PLAN> §2.5, §2.6 (Stage2D), §3.2, §3.3, §3.10, §3.12, §4.1 G8/G10/G11.

OWN
 - src/machine-ui/** (replacing the stub index.ts)
 - src/stage2d/** (replacing the stub)
 - src/pages/SandboxPage.tsx
 - e2e/{machine-ui,sync,stage2d}.spec.ts
 - e2e/helpers/machine.ts

IMPLEMENT (props exactly §3.10; `store` defaults to useMachineApi())
 - Keyboard: 26 <button>s in QWERTZ rows; key-X; aria-disabled and inert while locks.keyboard. Physical-key
   listener: global keydown A–Z, ignored in inputs, textareas and contenteditable, and ignored when locked.
 - Lampboard: lamp-X, lit from playback isLit. Hidden when locks.lampsHidden.
 - RotorControls:
   - rotor-pos-{slot} role=spinbutton, aria-valuetext the window letter, Up/Down arrows;
   - ring-{slot} spinbutton 1–26 with aria-valuetext '01'…'26'. Rings are NEVER shown as letters;
   - rotor-select-{slot} and reflector-select filtered by model validity;
   - windows show stepping.before while t < 1.
 - ModelSelect (I, M3, M4) via setModel.
 - PlugboardEditor: pairs list; no letter twice; ≤ 13 (maxPairs); errors in role=alert.
 - TracePanel:
   - trace-step shows windows before → after, with the double step flagged;
   - trace-row-i for every hop, with a Sym chip, input → output and contacts (showOffsets);
   - data-stage, data-input, data-output and data-lit (hopAt ≥ i);
   - outputs masked when lampsHidden.
 - PlaybackBar: playback-play, playback-scrub (0…1 + hops), playback-speed (0.25–4 and instant).
 - Announcer: role=status aria-live=polite, text exactly "Q lights E. Rotors now A E W." once lit. With lampsHidden:
   "Q pressed. Rotors now A E W.".
 - PaperTape: tape-input and tape-output in 5-letter groups; tape-copy writes to the clipboard; tape-paste types
   a pasted text key by key (round trip).
 - PermTable per §3.10, with keyboard-editable cells.
 - MachinePanel composes the panels named in `show`.
 - urlCodec: encodeConfig / decodeConfig; 'I.B.I-II-III.01-01-01.ADU.AV-BS'; M4 has 4 rotors and 4 rings.
 - stage2d/index.tsx: Stage2D per <PLAN> §2.6:
   - reads the stage store (directive, highlight, ghost), the machine or toy store, and playback;
   - calls onReport with renderer 'svg', dimmed = dimmedParts(focus, model), highlighted, litLamp, windows, hop,
     pathPoints = 2 + 2·hops drawn, ghost;
   - reduced motion gives static outlines;
   - responsive to 390 px.
 - SandboxPage #/machine?k=:
   - StageHost('wire'), MachinePanel with every panel, PaperTape, share-link (copies the URL with k=encodeConfig);
   - loads k on entry; invalid k gives the default plus a notice;
   - no bets.

TESTS
 - Unit (.test.tsx, happy-dom):
   - keys are disabled when locked;
   - ring spinbutton text is '05' and never 'E';
   - PlugboardEditor validation;
   - TracePanel rows: 11 (13 on M4) with correct data attributes after a press;
   - Announcer text;
   - urlCodec round trip over 1,000 randomConfig (all models);
   - Stage2D reports dimmedParts for every preset.
 - E2E:
   - machine-ui.spec (@area:machine-ui):
     - keyboard-only: Tab to key-A, press Enter, and the lamp and __enigma agree;
     - physical typing HELLO equals __enigma output;
     - announcer exact text;
     - switching to M4 gives 13 trace rows;
     - the ring spinbutton shows '05';
     - locks from #/lab/stage?locks=keyboard,positions disable the controls;
     - share URL reload restores the exact config;
     - tape round trip (ciphertext back gives plaintext);
     - axe on #/machine has no serious or critical issues;
     - at 390×844, scrollWidth ≤ innerWidth.
   - sync.spec (@sync): the <PLAN> §2.5 five-reading check over 50 random presses on 3 random configs, speed instant.
   - stage2d.spec (@area:machine-ui): each preset at #/lab/stage reports renderer 'svg' with focus and dimmed per
     dimmedParts; reduced motion makes t jump to the end.

COMMANDS: <PLAN> §7.1 with tags "@smoke|@platform|@area:machine-ui|@sync".
````

### 6.4 Brief 05 · `05-lesson` (base integration once 02 has merged; worktree `/home/user/wt/05-lesson`; E2E_PORT 4105)

````text
GOAL
Build the whole lesson runtime:
 - the pure scoring reducer and item builders;
 - the chapter flow;
 - progress persistence;
 - the gate, scene, story, bet, recall and rollback UI;
 - the return-visit check;
 - the code runner (textarea editor);
 - window.__course;
 - the validator, lint, guess bot and purity tests;
 - a fixture chapter that exercises everything;
 - the course map, e2e helpers, walk and review scripts.

READ
<PLAN> §2.2–2.4, §2.7, §3.4–3.9, §3.12, §3.13, §4.1, §4.2, §7.1, §7.2.

OWN
 - src/lesson/**, src/code/**
 - src/pages/{CoursePage,ChapterPage,GateLabPage,FixturePage}.tsx (replacing the stubs)
 - e2e/{lesson,course,walk}.spec.ts, e2e/helpers/course.ts, e2e/review/**

IMPLEMENT
 - lesson/rules.ts: every §3.5 declaration, exactly the normative rules 1–7.
 - lesson/kinds/index.ts: the §3.6 pure builders with their defaults.
   lesson/kinds/widgets/*.tsx: the generic Answer widgets:
   - letter (single input, uppercase, A–Z or A–F/H);
   - letters (segmented inputs of `length`);
   - numbers (count fields or a free list for 'any');
   - choice (radio group);
   - order (listbox with Alt+Up/Down and drag);
   - chain (one input per stage, labelled with Sym chips);
   - set-machine (Submit snapshots the store; a live decrypt preview when trial is 'preview');
   - ghost-pick (part buttons; also clicking the part in the stage report list);
   - code (see below).
 - lesson/bind.ts: bindGates.
   lesson/chapterMachine.ts: XState v5, flat scene states, NEXT guarded by canAdvance, BACK, GOTO(i ≤ reached),
   created from ProgressV1. No snapshots, no history states.
 - lesson/progress.ts:
   - zustand persist to PROGRESS_KEY with version 1;
   - on parse failure or a wrong version: copy the raw value to PROGRESS_CORRUPT_KEY, start fresh, raise a notice;
   - storage failure: memory store plus a banner;
   - salt from ?seed or random;
   - lastVisit updated on scene enter and on visibilitychange.
 - Runtime UI:
   - ChapterPlayer, with the route guards: a locked chapter shows LockedPage; a scene beyond reached redirects.
   - SceneFrame:
     - title;
     - StageHost(scene.stage);
     - MachinePanel(scene.panels);
     - the View;
     - BetPanel for scene.bets, where committing calls sync.setPendingBet(false) and unlocks that reveal;
     - RevealButton (reveal-<bet>), disabled until committed;
     - scene-next and scene-back.
   - StoryScene: story-card text plus act-clock (a static SVG clock and calendar reading the date from facts, with
     aria-label; no interval timers).
   - GateRunner:
     - items one at a time, item-<id> with data-passed and data-attempt;
     - Prompt + Answer + gate-submit;
     - after submit, the rollback view: path goes to stageStore.setGhost; windows gets a WindowsDiff plus stepping
       preview with highlights; machine goes to stage highlight plus message; order and none are generic; other
       kinds go to ItemUi.Feedback;
     - then gate-continue;
     - hint-panel with data-hint-level: L1 sets the stage highlight; L2 shows Worked on drawWorked with
       worked-example data-seed; L3 shows Worked(current, solve(current)) and "Got it" dispatches reveal;
     - each instance applies logic.setup(i) to the scene store and stage, and the previous setup is restored after;
     - fallback instances come from GateLogic.fallback when fallbackNext is set.
   - RecallScene: builds a 3-item gate from lesson/recall/pool.ts per <PLAN> §4.2.
   - ReturnCheck: a modal with return-check, per §4.2.
   - CoursePage: course-map with chapter-link-<id>, lock states, "bets made/right", reset (with confirm) and
     export JSON. Export the CourseMap component from src/lesson/index.ts; 09's HomePage uses it.
   - LockedPage (locked-page).
   - GateLabPage: #/lab/gate/:chapter/:gate.
   - FixturePage: #/lab/fixture.
 - lesson/recall/pool.ts (pure) and recall/items.tsx: the 7 items of <PLAN> §4.2.
 - lesson/fixture/{gates.ts,items.tsx,index.ts}: chapter 'lab-fixture'. At least one scene of each kind, one bet per
   trigger type, and one item of every generic kind: letter (toy lamp), letters (windows), numbers (lengths), choice
   (once, constant), order, chain, set-machine (trial locked), ghost-pick, code (task `double(x)` with probe
   "double(21)") and a custom item. Plus a puzzle gate.
 - lesson/courseApi.ts: window.__course (§3.9) and the event log. configure() sets RuleConfig, instant playback,
   the clock (now) and the salt.
 - code/runner.worker.ts and runner.ts:
   - module worker via new URL('./runner.worker.ts', import.meta.url);
   - shims (fetch, importScripts, XMLHttpRequest, WebSocket, indexedDB throw);
   - timeout → terminate and respawn;
   - syntax errors with line numbers;
   - 'keypress-parts' instrumentation records PathHops.
   code/CodeItem.tsx:
   - brief, signature and visible tests;
   - copy-brief;
   - code-editor (CodeEditor: textarea, Tab inserts 2 spaces);
   - gate-prediction (the probe input);
   - code-run, disabled until the probe is non-empty; the probe locks on Run;
   - countLines against maxLines gives 'too-long';
   - the answer {probe, run} is submitted automatically after the run;
   - source persisted per item in localStorage.
 - validate.test.ts, lint.test.ts, guessBot.test.ts, purity.test.ts: <PLAN> §3.13 over every registered chapter
   (placeholders included), the fixture and the recall pool.
 - e2e/helpers/course.ts:
   - enter(page, chapter), sceneTo, commitBet, assertRevealGated, answerViaUi (per kind), answerViaApi,
     solveInNode(page) (reads __course.gate(), dynamically imports ../../src/chapters/<id>/gates.ts,
     ../../src/lesson/recall/pool.ts or ../../src/lesson/fixture/gates.ts, and returns logic.solve(instance)),
     wrongAnswer, assertLadder, assertRollback, assertNoAnswerLeak, assertFocus, reloadKeepsSeed,
     typeCodeAndRun, agentPasteProbe;
   - everything the chapter template needs.
 - e2e/walk.spec.ts (@walk): from empty storage, every non-placeholder chapter in registry order through the UI
   (Next, bets via the UI, tasks via completeTasks where a task needs free exploration, items via answerViaApi),
   with no console errors, under 4 minutes.
 - e2e/review/walk.review.ts (run with npm run review -- --grep <tag>): for each scene in scope, screenshots at
   1280×800 and 390×844, motion reduced and full, and 2D plus 3D when available, written to
   review-artifacts/<NN>/screens/<chapter>-<scene>-<w>-<mode>.png. It also writes console.json, stage.json
   (__stage.info() and stats() per scene) and axe.json. Tag the tests with the chapter tags so reviewers can grep.

TESTS
 - Unit:
   - the §3.5 truth tables, all rows;
   - hint levels, normal and puzzle, including reset after a reveal and after a correct answer;
   - isGaming: fast, ladder and reveals;
   - fallbackNext lifecycle;
   - seeds: workedSeed ≠ current and next (1,000 cases); drawInstance redraws while same;
   - reload keeps seed and redraw;
   - progress: corrupt quarantine and memory fallback;
   - chapterMachine guards;
   - runner (in node through a fake worker adapter, or in happy-dom): countLines; timeout kill; syntax-error line;
     missing-fn; shims throw;
   - validate, lint, bot, CC and purity green.
 - E2E:
   - lesson.spec (@area:lesson) on #/lab/fixture: every chapter-template assertion (<PLAN> §6.0 CHAPTER PR TEMPLATE
     1–8 and the code-gate extras). Plus:
     - `while(true){}` is killed within 2 s and the UI stays responsive;
     - configure({minLatencyMs: 2000}) with two instant answers gives the gaming event and a fallback instance;
     - a corrupt progress value set before load is quarantined and a notice shown;
     - configure({now: +7 h}) shows return-check;
     - a double submit records one outcome.
   - course.spec (@area:lesson): course map; a deep link to a locked chapter shows locked-page; a deep link beyond
     reached redirects; back button; reset.
   - walk.spec (@walk).

COMMANDS: <PLAN> §7.1 with tags "@smoke|@platform|@area:lesson", then E2E_PORT=4105 npm run e2e:walk.
````

### 6.5 Brief 06 · `06-machine3d-core` (base integration; worktree `/home/user/wt/06-machine3d-core`; E2E_PORT 4106)

````text
GOAL
Build the procedural, accessible-by-proxy 3D Enigma behind StageHost:
 - two-layer rotors, pawls and notches;
 - focus dimming, highlights and labels;
 - window sync;
 - __stage reports and stats;
 - context-loss fallback.
The signal tube and effects come in PR 11. Leave stubs for them.

READ
<PLAN> §2.5, §2.6, §3.2, §3.3, §3.10 (3D part), §4.1 G11.

OWN
src/machine3d/** (replacing the stubs ready.ts and index.tsx), e2e/machine3d.spec.ts.
Create these STUBS for 11 and list them under ownership transfer in your PR description; the coordinator updates
ownership.json:
 - signal/index.tsx: export function SignalLayer(): null
 - effects/index.tsx: export default function Effects(): null
 - parts/Reflector.tsx: a plain disc, same props as the final one
 - parts/Cables.tsx: null
 - parts/ToyGeometry.tsx: null

IMPLEMENT
 - ready.ts: MACHINE_3D_READY = true.
 - index.tsx: default Machine3DView(StageViewProps).
   - <Canvas frameloop="demand" dpr={[1, 1.5]} gl={{ antialias: true }}>, aria-hidden.
   - Subscribes to the machine or toy store, playback and the stage store, calling invalidate() on change.
   - onReport after every change: renderer 'webgl2', gpu string, focus, dimmed = dimmedParts(...), highlighted,
     litLamp, windows, hop, pathPoints (0 until 11), ghost.
   - Registers registerStageStats(() => ({ calls, triangles, geometries, textures from gl.info,
     framesWhileIdle })). framesWhileIdle counts frames rendered while nothing changed for > 1 s.
 - layout.ts (§3.10): n-parametric (26 now; 6 and 8 must already work in the maths).
 - CameraRig: drei CameraControls with the shots in §3.3; reduced motion gives cuts (transition false).
 - Parts (all procedural, 1 unit = 1 cm):
   - Case with lid states;
   - Keyboard and Lampboard as <Instances> (key clicks call store.pressKey when directive.interactive and not
     locked; lamp emissive > 1 with toneMapped false when lit);
   - Sockets as <Instances>;
   - Etw;
   - RotorStack of 3 (or 4 on M4) rotors: AlphabetRing (26 troika <Text> glyphs, ring numbers 01–26 on the ring
     band when labels are on, extruded notch plate at the notch position) and a separately rotating WiringCore
     (instanced contacts coloured symbolColor(slot));
   - Pawls, engaged when isAtTurnover.
 - Stepping animation: during playback t ∈ [0, 1), interpolate core and ring angles from stepping.before to after.
 - Focus: materials of dimmed parts get opacity 0.25 (transparent). highlight pulses (static outline under
   reduced motion). Labels via drei <Text>/<Billboard> attached to parts; `symbols` mode shows N, M, L, U, H and S
   in symbol colours.
 - Context loss: listen on the canvas's webglcontextlost, call onError, and StageHost falls back to 2D.
   PerformanceMonitor lowers dpr on decline.

TESTS
 - Unit:
   - layout.ts: 26 contacts per face equally spaced; rotation shifts contact k to k − offset; contactPoint is
     deterministic.
   - @react-three/test-renderer (.test.tsx):
     - 26 key and 26 lamp instances;
     - 3 rotors (4 on M4);
     - setting the ring changes the core angle but not the ring glyph angle at a fixed window;
     - pawl engaged equals isAtTurnover for all 26 positions of rotor II.
 - E2E machine3d.spec (@3d):
   - __stage.info().renderer is 'webgl2', and the gpu string matches /SwiftShader/i (logged);
   - every preset at #/lab/stage?preset=… reports focus and dimmed equal to dimmedParts (imported in Node);
   - from ADU, 30 presses (including the double step) give __stage.info().windows equal to __enigma positions
     after each press;
   - stats: calls ≤ 120; framesWhileIdle is 0 after 1.5 s idle; geometries unchanged across 100 presses;
   - forced context loss (WEBGL_lose_context.loseContext via page.evaluate, with allowContextLoss()) gives renderer
     'svg' and no console error;
   - reduced motion: a shot change is immediate.

COMMANDS: <PLAN> §7.1 with tags "@smoke|@platform", then E2E_PORT=4106 npm run e2e:3d.
````

### 6.6 Brief 07 · `07-pilot-i2` (base integration after 04 and 05 have merged; worktree `/home/user/wt/07-pilot-i2`; E2E_PORT 4107)

````text
GOAL
This is the CONTRACT PILOT. Build chapter i2-stepping exactly as <PLAN> §4.4 specifies, end to end, on the merged
platform: bets that gate press and step reveals; a set-machine item with keyboard lock and predicate-on-submit;
pawl and notch focus; trace sync; the windows rollback; the M3 transfer; reload persistence. It must run on
Stage2D, and on 3D too if 06 has merged (check MACHINE_3D_READY on integration).
Fan-out waits for your merge, so report problems early.

READ
<PLAN> §3 (all), §4.1, §4.3 (F5, F6), §4.4 "i2-stepping", §6.0 CHAPTER PR TEMPLATE, §7.

OWN
src/chapters/i2-stepping/**, e2e/chapters/i2-stepping.spec.ts.
AMENDMENTS: if the pilot shows that a contract or runtime piece is missing or wrong, you may make ADDITIVE changes
(new optional fields, new helpers, bug fixes that keep signatures) in src/contracts/**, src/lesson/**,
src/machine-ui/**, src/stage2d/** and src/state/**. They must go in ONE commit whose message contains
[contracts-v2], and each must be listed under "Contract amendments" in the PR description. Anything non-additive:
report BLOCKED so the coordinator can open a hotfix.

IMPLEMENT
The chapter per the template and §4.4. Chapter-specific unit tests:
 - `windows`:
   - the instance starts within 3 presses of a right-rotor turnover;
   - even attempts include a double step (all 300 seeds);
   - check is exact;
   - the rollback firstWrong index is correct.
 - `middle-steps` and `left-steps` predicates agree with engine step() over 1,000 random snapshots.
 - `windows-m3`: model M3; contains at least one of VI–VIII; the setup passes validateConfig.
 - `ring-probe`: shuffled; the misconception option is present.
Extra e2e (in addition to the template):
 - at ADU, the step bets gate each of 3 Step reveals, and the windows go ADV, AEW, BFX;
 - at the rotor-layers scene, the ring spinbutton shows '05' after the reveal, while the window letter is unchanged;
 - under @3d (skip if not ready): the pawls scene reports focus 'pawls' and dimmed per dimmedParts.

REPORT
Also a "Pilot findings" list: every friction point in the contracts, even ones you did not amend.
````

### 6.7 Brief 08 · `08-cryptokit` (base integration; worktree `/home/user/wt/08-cryptokit`; E2E_PORT 4108)

````text
GOAL
Build the analysis kit that powers Acts II–IV, and the SVG views, with the API frozen in your FIRST commit.
Push that commit early and send the coordinator its SHA.
 - Rejewski: indicators, products, characteristic, catalogue in a worker.
 - Cribs, menus, and the bombe (propagation, diagonal board, stop search in a worker, checking).
 - Generators.

READ
<PLAN> §3.11, §4.3 (F18–F21), §4.4 Acts II–IV, the report's vectors 13 and 14.

OWN
src/crypto/**, src/viz/**, src/pages/VizLabPage.tsx (replacing the stub), e2e/viz.spec.ts.

IMPLEMENT
 - The §3.11 API, verbatim.
 - Pure modules import only engine and lib/rng. Workers use new Worker(new URL('./x.worker.ts', import.meta.url),
   { type: 'module' }) and live only in *.worker.ts and *Client.ts files.
 - data/rejewski65.ts: F20 verbatim, including SYZ SCW. products() reports conflicts and resolves them by majority.
 - Catalogue:
   - use precomputed rotor permutations (ROTOR_PERMS) and typed arrays;
   - characteristic via cycle types of compose(A, D), compose(B, E) and compose(C, F);
   - 6 orders × 17,576 positions, rings AAA.
 - Bombe:
   - scramblerAt with drum semantics;
   - propagate is a BFS over (bank, wire) nodes, with an edge per menu scrambler and diagonal edges (a,b) ↔ (b,a)
     when enabled;
   - runBombe tests the menu's test letter against every hypothesis per position and reports stops where the live
     count is not n;
   - checkStop derives steckers along the crib and reports the first letter with two partners.
 - Generators per §3.11. cribbedMessage never lets the middle rotor turn over inside the crib span.
 - viz/*: SVG, keyboard-operable (arrow keys move the CribStrip offset; Enter adds a MenuGraph edge; the Tab order
   is logical), with colours via var(--sym-*).
 - VizLabPage #/lab/viz: every view fed with fixture data (REJEWSKI_65 AD; vector 14 menu; the toy bombe).

TESTS (unit, node)
 - Vector 13: exact AD, BE and CF cycles and lengths from REJEWSKI_65; conflicts reported once for SYZ SCW;
   factorizationCount(AD) = 20.
 - The toy hexagon (ab)(cd)(ef)·(bc)(de)(fa) = (ace)(bfd).
 - Invariance: 1,000 random stecker sets leave the characteristic unchanged.
 - productsFromMachine agrees with products(indicators) over 200 generated days.
 - Catalogue:
   - buildCatalogue: 105,456 entries;
   - every one of 100 generated 1936 days is found among the candidates for its characteristic;
   - distinct count ≤ 101³.
 - Vector 14: crashes = []; closures = 3; loops include ATLK, TNS and TAWCN.
 - Bombe:
   - on 20 cribbedMessage days the true position is among the stops, and its live count is 1 (true hypothesis) or
     n − 1 (false hypothesis);
   - the diagonal board never adds stops (50 menus, property);
   - toyBombe truth is consistent.
 - checkStop rejects every false stop in 20 runs.
 - dayKey and cribbedMessage configs pass validateConfig.
 - Timings logged: catalogue build in node, runBombe on one order.
TESTS (e2e viz.spec, @area:crypto)
 - #/lab/viz renders every view with no console errors;
 - the CribStrip offset moves with arrow keys; the MenuGraph closure count updates on Enter;
 - getCatalogue('A') in the browser completes in < 10 s (report the time);
 - axe clean.

COMMANDS: <PLAN> §7.1 with tags "@smoke|@platform|@area:crypto".
REPORT
Also the timings, and the frozen-API commit SHA.
````

### 6.8 Brief 09 · `09-act1-a` (base integration; E2E_PORT 4109)

````text
GOAL
Build the Prologue, chapter i1-anatomy, and the guided HomePage.
Apply the CHAPTER PR TEMPLATE (<PLAN> §6.0) and <PLAN> §4.4 "prologue" and "i1-anatomy".

OWN
src/chapters/{prologue,i1-anatomy}/**, src/pages/HomePage.tsx (replacing the stub),
e2e/chapters/{prologue,i1-anatomy}.spec.ts, e2e/home.spec.ts.

SPECIFICS
 - HomePage #/:
   - StageHost('type-a-word');
   - one "type a word" affordance: the keyboard panel plus a visible hint;
   - "Begin" goes to #/c/prologue;
   - the course map below, via the CourseMap component from lesson/.
 - Prologue brute-force: the keyspace figure comes from lib/keyspace (formatSci). Never type the numbers.
 - i1 disclosure: hold, rings AAA, no plugs, plugboard hidden (wire-noplug). No generator may use plugs, rings ≠ AAA
   or stepping.
 - Custom fallback `toy-set`: rotor-position pickers for the toy; keyboard locked.

UNIT TESTS
 - toy-lamp: backward-ghost divergeAt is correct against toyPress.
 - hop-chain: exactly 11 stages; plugboard stages are identity.
 - path-order-m4: 13 blocks.
 - toy-set: a solution exists for all 300 seeds.

E2E
The template, plus home.spec (@area:home): typing on the home stage lights lamps; Begin opens the prologue; the
roundtrip task completes through tape reset and retype.
````

### 6.9 Brief 10 · `10-act1-b` (base integration; E2E_PORT 4110)

````text
GOAL
Build chapters i3-reflector-plugboard and i4-permutations: the first code gates, and the ghost-path rollback of the
learner's own enigmaKeypress.
Apply the CHAPTER PR TEMPLATE, the code-gate extras, and <PLAN> §4.4 "i3…" and "i4…".

OWN
src/chapters/{i3-reflector-plugboard,i4-permutations}/**, e2e/chapters/{i3-reflector-plugboard,i4-permutations}.spec.ts.

SPECIFICS
 - compose-inverse:
   - fnNames [compose, inverse]; maxLines 8;
   - cases per §4.4;
   - reference in the task; probe is a letter of ABCDEF.
 - keypress:
   - `provided` defines `parts`. The worker's 'keypress-parts' instrumentation wraps every part call and records a
     PathHop with the same stage names as the engine trace;
   - cases compare {output, positions};
   - the probe config's hops come back in run.hops and become rollback.path.ghost against
     encodeLetter/pressKey of the engine.
 - which-wrong: implement the 6 buggy reference functions in gates.ts (pure). The ghost comes from the buggy trace.
 - plug-to-hit: the prompt shows E0 through machinePermutation with the plugboard removed. maxPlugs 2.
 - self-search: the Run reveal iterates all 17,576 positions with encodeLetter, counts A→A (0), and animates a
   counter. The "give up" button appears after 30 manual presses.

UNIT TESTS
 - which-wrong: each of the 6 bugs diverges at the claimed first hop on 300 seeds.
 - plug-to-hit: a solution with ≤ 2 cables exists for every seed.
 - keypress reference passes all cases.
 - hop-chain-full: stepping precedes encoding.

E2E
The template, plus the code-gate extras for both code items: the keypress rollback shows rollback[data-kind=path] and
__stage.info().ghost is true after a deliberately buggy submission (typed code with middle and left swapped).
````

### 6.10 Brief 11 · `11-machine3d-signal` (base integration; E2E_PORT 4111)

````text
GOAL
Complete the 3D machine:
 - the glowing signal tube and head drawn up to playback t;
 - the ghost tube against the reference with a divergence marker;
 - the reflector as 13 arcs, and plug cables;
 - Bloom in a lazily loaded effects chunk dropped by PerformanceMonitor;
 - the M4 fourth slot and thin reflector;
 - toy geometry for n = 6 and 8.

READ
<PLAN> §2.5, §2.6, §3.3, §3.10.

OWN
src/machine3d/{signal,effects}/**, src/machine3d/parts/{Reflector,Cables,ToyGeometry}.tsx (replacing 06's stubs),
e2e/machine3d-signal.spec.ts.
You may NOT edit other machine3d files. They already import these modules.

IMPLEMENT
 - pathPoints use: build a CatmullRomCurve3 through pathPoints(hops, layout).
 - TubeGeometry drawn up to fraction f(t) (the stepping phase draws nothing).
 - Emissive head at getPointAt(f), with signal colour and toneMapped false.
 - Reduced motion: the whole path is drawn at the end state.
 - Ghost: red tube for stageStore.ghost.hops, gold reference, a marker at divergeAt.
 - Reflector: 13 arcs from REFLECTOR_PERMS, one pair lit when the path uses it.
 - Cables: a tube per plug pair between sockets; the used cable glows.
 - Effects: EffectComposer + Bloom (mipmapBlur, luminanceThreshold 1), React.lazy, only when not reduced and
   PerformanceMonitor allows.
 - M4: the Greek slot geometry (non-stepping) and a thin reflector.
 - ToyGeometry: RotorStack or parts in n = 6 or 8 mode when directive.source is 'toy'.
 - Update onReport: pathPoints and ghost.

TESTS
 - Unit: pathPoints length = 2 + 2·hops for 11, 13 and the toy; points are continuous (hop k's exit = hop k+1's
   entry).
 - Test-renderer: 13 reflector arcs; cable count = plug pairs.
 - E2E (@3d):
   - the signal head advances with hop order 0…10 (sample __stage.info().hop at scrub points);
   - the sync spec from 04 runs in the 3d project automatically (@sync): make it pass;
   - the ghost appears when stageStore.ghost is set (#/lab/stage?preset=wire&ghost=demo): __stage.info().ghost is
     true, and there is a divergence marker;
   - #/lab/stage?preset=toy&toy=6 renders the toy (pathPoints for toy hops);
   - M4 through #/machine?k=<M4> renders 13 hops;
   - stats budgets still hold (calls ≤ 120);
   - the effects chunk is separate (budget script).

COMMANDS: <PLAN> §7.1 with tags "@smoke|@platform", then E2E_PORT=4111 npm run e2e:3d.
````

### 6.11 Brief 12 · `12-act2-a` (base integration; E2E_PORT 4112)

````text
GOAL
Build chapters ii5-indicators and ii6-cycles: the indicators, AD/BE/CF, and invariance under the stecker.
Apply the CHAPTER PR TEMPLATE, the code-gate extras, and <PLAN> §4.4 "ii5…" and "ii6…".

OWN
src/chapters/{ii5-indicators,ii6-cycles}/**, e2e/chapters/{ii5-indicators,ii6-cycles}.spec.ts.

SPECIFICS
 - ii5 starts with a recall scene. The warsaw story carries the act clock.
 - `fill-ad` custom Answer: a PermTable, editable only in the 8 target cells. Its Feedback animates the defining
   indicator pair for each wrong cell.
 - build-ad cases include REJEWSKI_65 → vector 13 AD.
 - ii6 stecker-toggle: a live CycleDiagram of productsFromMachine(store.snapshot()).AD.
 - stecker-set predicate: X and Y share a cycle of productsFromMachine(snapshot).AD, with exactly one new cable.
 - relabel answer: the cycle string starting at X, in AD' = the conjugate by the new cable.

UNIT TESTS
 - fill-ad target cells are determined by the indicators.
 - stecker-set: a solution exists; the random-cable success rate is < 3%.
 - lengths are always a paired type (isPairedType).
 - relabel agrees with engine conjugate().

E2E
The template plus the code-gate extras (build-ad, cycle-lengths). Also: toggling 3 cables in stecker-toggle leaves
the CycleDiagram lengths equal, read through data attributes.
````

### 6.12 Brief 13 · `13-act2-b` (base integration; E2E_PORT 4113)

````text
GOAL
Build chapters ii7-catalogue (the novel Rejewski artefact: cyclometer, catalogue, lookup, plugs, transfer) and
ii8-sheets (optional).
Apply the CHAPTER PR TEMPLATE and <PLAN> §4.4 "ii7…" and "ii8…".

OWN
src/chapters/{ii7-catalogue,ii8-sheets}/**, e2e/chapters/{ii7-catalogue,ii8-sheets}.spec.ts.

SPECIFICS
 - Cyclometer view: two createMachineStore() instances in MachineProviders, offset by 3; pressing a key lights the
   whole cycle containing it.
 - Catalogue scene and the lookup tool use getCatalogue('A') with a progress bar, built once per session.
 - lookup, set-plugs and lookup-transfer are set-machine items with trial 'preview'. The preview decrypts the item's
   message with store.snapshot() and the hidden day plugboard as specified. Keyboard locked.
 - lookup-transfer: the wheel order is never I-II-III.
 - Rings AAA throughout, with the story note.
 - ii8 LightTable sheets: computed from the engine for a generated 1938-style day (female apertures per position).
 - ii8 `stack-to-one`: a custom inPage item.

UNIT TESTS
 - The transfer order is never I-II-III (300 seeds).
 - signature normalisation.
 - The candidates for each generated day include the truth (using buildCatalogue once, memoised).
 - females-needed formula.

E2E
The template. Also: the catalogue builds in the page in < 10 s. The lookup item is solved through the real UI once:
query, then set rotors and positions with the spinbuttons, then Submit.
````

### 6.13 Brief 14 · `14-act3-a` (base integration; E2E_PORT 4114)

````text
GOAL
Build chapters iii9-cribs and iii10-menus.
Apply the CHAPTER PR TEMPLATE, the code-gate extras, and <PLAN> §4.4 "iii9…" and "iii10…".

OWN
src/chapters/{iii9-cribs,iii10-menus}/**, e2e/chapters/{iii9-cribs,iii10-menus}.spec.ts.

SPECIFICS
 - iii9 starts with a recall scene; the pyry story carries the act clock.
 - crash-free uses a CribStrip with arrow keys; its generator guarantees 1–3 zero-crash offsets.
 - build-menu uses MenuGraph with available edges from the crib and a warnings position from turnoverWithin.
 - loop scene: Turing's table values from F18 (in facts).

UNIT TESTS
 - Exactly 1–3 valid offsets on 300 seeds.
 - build-menu has a solution on every seed.
 - closures formula against crypto.closures.
 - loop-return against a direct composition.

E2E
The template plus the code-gate extras for is-consistent-crib. Also: vector 14 is displayed with 0 crashes, and the
closure counter reads 3 after all edges.
````

### 6.14 Brief 15 · `15-act3-b` (base integration; E2E_PORT 4115)

````text
GOAL
Build chapters iii11-bombe (the novel artefact: live 8- then 26-wire state, test register, diagonal-board toggle) and
iii12-checking.
Apply the CHAPTER PR TEMPLATE and <PLAN> §4.4 "iii11…" and "iii12…".

OWN
src/chapters/{iii11-bombe,iii12-checking}/**, e2e/chapters/{iii11-bombe,iii12-checking}.spec.ts.

SPECIFICS
 - wire-8: step through each scrambler with a Step reveal. WireGrid and TestRegister are fed by crypto.propagate
   with an increasing step.
 - wire-26: a fixed seed; both the true and a false position.
 - diagonal: runBombe in the worker twice (board off and on) with a progress bar; show both stop counts.
 - click-through verdict token: C or X.
 - live-count classes: rotate true/true → 1, true/false → 7, false → 8, each verified with propagate.
 - iii12 checking-machine: a createMachineStore() instance without a plugboard in a MachineProvider, with
   stage 'checking'.
 - stop-verdict generator: finds the first false stop by scanning runBombe from a random position with a limit, and
   is deterministic.

UNIT TESTS
 - The live-count class answers equal liveCount(propagate(...)) on 300 seeds.
 - click-through chain letters equal the scrambler composition.
 - stop-verdict letters are correct (checkStop).
 - The set-key predicate accepts the true key only.

E2E
The template. Also: the diagonal scene shows board-on stops ≤ board-off stops. The TestRegister live count equals
liveCount from Node for the displayed state (read data attributes). The click-through item is solved once through the
UI.
````

### 6.15 Brief 16 · `16-capstone` (base integration; E2E_PORT 4116)

````text
GOAL
Build chapter iv-capstone: "the day key", both routes, with puzzle gates.
Apply the CHAPTER PR TEMPLATE and <PLAN> §4.4 "iv-capstone".

OWN
src/chapters/iv-capstone/**, e2e/chapters/iv-capstone.spec.ts.

SPECIFICS
 - Recall across 3 acts.
 - The midnight story clock says explicitly that nothing is timed.
 - Tool scenes compose viz and crypto views. Never import another chapter.
 - Both gates are puzzle: true. Their key items are set-machine once with trial preview, and a new day is drawn on
   every retry.
 - british-tools: offer 3 candidate wheel orders only, so bombe runs stay within budget.
 - read-intercepts uses the post-1940 procedure.

UNIT TESTS
 - Every generated day is solvable with the given tools (the truth is within the candidates).
 - The puzzle ladder: hintLevel stays 0 after 1 wrong and becomes 1 after 2.

E2E
The template. Also:
 - no hint-panel level > 0 after 1 wrong answer, and level 1 after 2;
 - each key item is solved once through the UI (set rotors, positions and plugs with the controls);
 - a retry draws a different day (the seed changes).
````

### 6.16 Brief 17 · `17-release` (base integration after everything has merged; E2E_PORT 4117)

````text
GOAL
Take the integration branch to release: CodeMirror editor, full-course verification in 2D and 3D, accessibility,
layout, budgets, README, deploy-ready proof, and fixes for the MINOR backlog the coordinator lists.

OWN
 - src/code/CodeEditor.tsx (transferred from 05)
 - .github/workflows/web.yml (transferred from 02)
 - web/README.md
 - e2e/{a11y,layout,release}.spec.ts
 - any file needed for a listed backlog fix (every other PR has merged; list each touched file in the PR).

IMPLEMENT
 - CodeEditor: CodeMirror 6 (state, view, commands, language, lang-javascript), lazily imported, with the same props
   and test id. Typing through Playwright must still work: target the .cm-content inside code-editor. Keep the
   textarea as a fallback if the import fails.
 - a11y.spec (@release): axe on every route and on one scene per chapter; no serious or critical issues.
 - layout.spec: every route at 390×844 has no horizontal scroll; the stage is visible.
 - release.spec:
   - a build with VITE_BASE=/enigma-simulator/;
   - every hash deep link and a share URL load;
   - 404.html boots;
   - __course walk is complete (all 14 chapters complete).
 - Run the walk under 3D too: add a `walk-3d` project in playwright.config.ts (transferred to you) with stage '3d'.
 - Adjust budgets only with the coordinator's approval.
 - README: user guide, architecture, scripts, testing, deploy handoff steps.

VERIFY
 - The full suite locally, once: npm run e2e and npm run e2e:walk, in both walk projects.
 - After merge, the coordinator confirms that the integration push has green check, e2e, e2e-3d, walk and
   pages-artifact jobs.
````

---
## 7. Verification protocol

### 7.1 Builder pre-push checklist (run in `/home/user/wt/NN-name/web`; every step must be green)

```sh
git fetch origin && git merge --no-edit origin/<base>          # merge commit; never rebase
git diff --quiet HEAD@{1} -- package-lock.json || npm ci       # only if the lockfile changed
OWNERSHIP_BASE=origin/<base> npm run check                     # typecheck · vitest (maxWorkers 2) · build · budget · ownership
python3 ../tools/reference_enigma.py && for f in ../tools/export_*.py; do python3 "$f" --check; done
E2E_PORT=41NN npm run e2e:pr -- --grep "@smoke|@platform|<own tags>"     # ≤ 6 min wall; 1 worker
E2E_PORT=41NN npm run e2e:3d                                             # only if you touched machine3d/, stage/ or stage2d/
E2E_PORT=41NN npx playwright test --project=2d --grep "<own tag>" --repeat-each=3   # flake screen for your own specs
E2E_PORT=41NN npm run review -- --grep "<own tags>"    # screenshots → review-artifacts/NN/; Read at least 3 of them
git push   # then create or update the PR (§6.0 item 8)
```

**Budgets.**
- Each chapter spec takes ≤ 60 s. The platform and area specs take ≤ 90 s each. The walk takes ≤ 4 min in CI. Each CI e2e shard takes ≤ 12 min.
- Chunk sizes are set in §6.0 item 5 and enforced by `budget.mjs`.
- An over-budget result counts as a **MAJOR** review finding.

**Local and CI scope.** Builders run only smoke, platform and their own areas locally. The full suite, the 3D project and the walk run in CI on every PR, and again on every push to integration.

### 7.2 Review agent (a separate agent, in the same slot, after the builder; it reads and runs but never pushes)

The coordinator sends the reviewer this prompt, filled in for the PR:

````text
REVIEW PR NN (claude/enigma/NN-name). You are the headless-browser review agent. Do not push and do not edit the
PR branch.
Plan: <PLAN>. Read §3, §4 (the sections for this PR), §6 (the PR's brief) and §7.

R0 Setup
     git -C /home/user/enigma-simulator fetch origin
     git -C /home/user/enigma-simulator worktree add --detach /home/user/wt/review-NN origin/claude/enigma/NN-name
     cd /home/user/wt/review-NN/web && npm ci
   Use E2E_PORT=51NN for everything.

R1 Re-run the builder checklist (§7.1) yourself. A failure is a BLOCKER. Record every spec's duration.

R2 Scripted walk:
     E2E_PORT=51NN npm run review -- --grep "<tags>"
   It writes review-artifacts/NN/{screens/*.png, console.json, stage.json, axe.json}.
   - Any console error, pageerror or failed request: BLOCKER.
   - An axe finding of serious or critical impact: MAJOR.

R3 Visual pass. Open EVERY screenshot with the Read tool and look for:
   - a blank or black canvas;
   - glow off the live wire, or a glowing part that is not on the path;
   - labels detached from their parts;
   - clipping or horizontal overflow at 390 px;
   - windows that disagree with the trace;
   - RINGS SHOWN AS LETTERS (they must be 01–26), or positions shown as numbers;
   - focus that fails to dim the other parts;
   - a symbol whose colour differs from its part's colour;
   - story text over a calculation;
   - any timer or countdown on an assessment.
   Each hit is MAJOR (BLOCKER if the page is unusable).

R4 Teaching pass, for each gate in scope (chapter PRs, and 05's fixture):
   a. SOLVABILITY: solve at least one instance per item from the screen alone, without reading code or calling
      solveInNode. If you cannot, and the prompt lacks information: MAJOR.
   b. LADDER: submit 3 wrong answers.
      - hint-panel data-hint-level goes 1, then 2, then 3;
      - L1 highlight appears in __stage.info().highlighted and on the trace row;
      - L2 worked-example data-seed differs from the current seed and from the next instance's seed (see the
        item.show events);
      - L3 reveals the current solution; "Got it" records 'revealed' and draws a fresh instance.
      Puzzle gates: no hint before the 3rd attempt.
   c. ROLLBACK: after a wrong answer, rollback[data-kind] matches the §4.1 table, and the animation or figure shows
      where the learner's own answer diverges.
   d. BETS: for each reveal, before the commit the trigger is disabled and __stage.playback() shows gated with t 0;
      after the commit it plays.
   e. FOCUS: __stage.info().focus equals the scene's declared focus, and dimmed equals dimmedParts. Check both in
      2D and in 3D (?stage=3d, when MACHINE_3D_READY).
   f. Pass 2 instances per window item through the UI.

R5 Loophole probes:
   - a deep link to the next chapter shows locked-page;
   - a deep link to a scene beyond `reached` redirects;
   - scene-next before a pass is a no-op;
   - a double submit gives one outcome;
   - a reload mid-gate keeps the same seed and instance;
   - clearing storage mid-chapter gives a clean restart with no errors;
   - the back button behaves;
   - set-machine items: key-A is disabled, __enigma.pressKey('A') throws, lamps are hidden, and changing controls
     emits no item.submit;
   - assertNoAnswerLeak (an innerHTML and innerText scan) before each submit;
   - CODE GATES:
     - code-run is disabled with an empty probe;
     - reference code with a wrong probe → incorrect;
     - AGENT-PASTE PROBE: paste the task's reference solution, answer every TEXT probe with values computed in Node
       (solveInNode), but leave the inPage item wrong. The gate must NOT pass.
   - GAMING: configure({minLatencyMs: 2000}), then two instant answers → a gaming event and a fallback instance with
     the keyboard locked.
   - In a ?stage=3d session, a forced context loss falls back to 2D (platform PRs 02, 06, 11).
   Any loophole that lets a gate pass without the required understanding is a BLOCKER.

R6 Content:
   - every date and number in stories and prompts matches §4.3 (or a cited research-notes fact with an https source);
   - each story is ≤ 120 words and names a real person and a date;
   - no invented facts;
   - key-space numbers come from lib/keyspace.
   Violations: MAJOR.

R7 Diff hygiene:
   - ownership-check passes;
   - no edits to contracts (except 07's [contracts-v2] commit, each change additive);
   - no package.json edits (except 02);
   - no disabled, skipped or weakened tests (validate, lint, bot, purity);
   - no waitForTimeout.
   Violations: BLOCKER.

R8 Budgets: spec durations and bundle sizes against §7.1. Over budget: MAJOR.

Per-PR additions:
 - 02: every route; the #/lab/stage presets; the locks query; 404 and deep links; the renderer smoke test.
 - 03: run generate.mjs --check; read the oracle coverage table; flip a byte and see --check fail.
 - 04: #/machine keyboard-only session; the sync spec in 2D; the share URL; the tape; 390 px.
 - 05: all of R4/R5 on #/lab/fixture; the return check; corrupt-progress quarantine; the runner kill test.
 - 06 and 11: #/lab/stage every preset in 3D; stats budgets; 3D screenshots of every preset against the R3 checklist.
 - 07: everything in R3–R5 for i2 in 2D AND 3D; list any contract friction.
 - 08: #/lab/viz; catalogue timing; keyboard operation of CribStrip and MenuGraph.
 - 09–16: R3–R6 for each chapter.
 - 17: the full walk in 2D and 3D; the deploy checks; every route with axe.

OUTPUT (your return value): a list of findings, one per line. Each finding has:
  {id, severity: BLOCKER|MAJOR|MINOR, area, repro steps, expected, actual, screenshot path}
Then VERDICT: APPROVE (no BLOCKER and no MAJOR) or CHANGES. Include the spec durations and the paths of the
screenshots you read.
````

### 7.3 Fix loop

1. **Build.** The builder builds, pushes and opens the PR. Then the reviewer reviews.
2. **CHANGES.** The coordinator sends the findings to a builder in the same worktree. The builder fixes every BLOCKER and MAJOR, adds one regression test for each BLOCKER, answers each MINOR, and pushes new commits.
3. **Re-review.** The reviewer re-runs R1, the scripted walk for the affected tags, and every previously failing check.
4. **Round limit.** After 3 rounds that still end in CHANGES, the coordinator either splits the PR (remaining work goes to a new PR number) or applies a §8 cut.
5. **MINOR findings** that are not fixed go into the PR's "Known gaps" and into the coordinator's backlog for 17.

**Merge requires all of the following:**
- verdict APPROVE;
- green GitHub checks on the PR's head;
- a PR base of integration (retarget first if it is not);
- a Verification section that is complete.

### 7.4 PR description template

```markdown
**NN · <title>**
**Scope.** <what this PR adds, 3–6 bullets>
**Base / depends on.** <base branch>; depends on <PRs>
**Owned paths.** <globs>; **ownership transfers**: <stubs created for other PRs, if any>
**Contracts.** implements <§3 items>; amendments: none | <list, [contracts-v2] only>
**Verification**

| Command | Result |
|---|---|
| `npm run check` | ✔ typecheck · N unit tests · build · budget (entry X kB, 3D Y kB, chapter Z kB) · ownership ✔ |
| `npm run e2e:pr -- --grep …` | ✔ N passed (slowest: spec a 41 s, b 33 s, c 20 s) |
| `npm run e2e:3d` | ✔ N passed / n/a |
| `--repeat-each=3` | ✔ |
| review walk | screenshots read: <paths> |
**Review rounds**

| Round | Verdict | Findings fixed |
|---|---|---|
**Known gaps**

<MINORs deferred, with reasons>

<PR_FOOTER>
```

### 7.5 Coordinator runbook

1. **Start.**
   - Confirm that 01's PR is open and that its CI is green (or wait until it is).
   - Queue 02 and 03 on base `claude/enigma/01-foundation`.
   - Send each builder §6.0 plus its brief, with `<PLAN>`, `<ATTRIBUTION>` and `<PR_FOOTER>` filled in.
2. **Checkpoint.** When 02 reports the `[contracts-v1]` SHA, start 04 from that SHA in the free slot. Do the same with 08's frozen-API SHA, telling 12–16 they may rely on it.
3. **Watching CI.**
   - Subscribe to every open PR with `mcp__github__subscribe_pr_activity`. If that is unavailable, poll `mcp__github__pull_request_read` for check runs about every 10 minutes while waiting.
   - For a failure that happens only in CI, read the logs with `mcp__github__get_job_logs` and fetch the `playwright-report` artifact through `mcp__github__actions_get`/`actions_list`. Forward both to the builder as a BLOCKER.
4. **Merge.**
   - Merge only with `mcp__github__merge_pull_request`, `merge_method: "merge"`. **Never squash or rebase.**
   - Merge a PR only when its base is `claude/intelligent-hamilton-r0i6wz`. If the base is still a parent branch, the parent must merge first.
   - Do not delete head branches until the release, so worktrees stay valid.
5. **Retarget.** Immediately after a parent merges, retarget every open child with `mcp__github__update_pull_request` (base = integration). Then tell each child builder to run `git merge origin/claude/intelligent-hamilton-r0i6wz` and re-run §7.1. This covers 01 → 02 and 03, and 02 → 04.
6. **Integration check after every merge.**
   - Watch the integration push's `web` workflow: check, e2e shards, e2e-3d, walk and pages-artifact.
   - A red integration run stops all merges. Open the next hotfix `9N-hotfix-<topic>` at the head of the queue, and have the owning slot's next agent fix it.
7. **Pilot gate.** No chapter PR (09–16) starts until 07 has merged. If 07 carries `[contracts-v2]`, tell every in-flight builder (06 or 08) to merge integration before its next verification.
8. **Ownership.** Update `web/ownership.json` directly on integration for ownership transfers that PR descriptions report (06's stubs go to 11). Commit as the coordinator, with the attribution lines.
9. **Checkpoints and cuts.** At CP1–CP5 (§5.4), compare the actual state with the plan and apply the §8 cuts in order. Record each decision in the next PR's description and in CLAUDE.md.
10. **Lessons.** After each milestone, append durable lessons to `CLAUDE.md` on integration, including the `lessons.md` facts: ports, the Playwright pin, the concurrency cap, the merge method, pitfalls, and how to run the review.

### 7.6 Final integration review and user handoff

1. After 17 merges, the integration push must be green in every job: `check`, both `e2e` shards, `e2e-3d`, `walk` (2D and 3D) and `pages-artifact`. The `pages-artifact` job is the in-session proof that the site is ready to deploy.
2. A final review agent (a fresh agent in `/home/user/wt/review-final`) runs R1–R8 across the **whole course**:
   - the full walk from empty storage in 2D and 3D;
   - every route under `VITE_BASE=/enigma-simulator/` preview;
   - `404.html`;
   - the share URL;
   - zero console errors.
3. The coordinator writes the final `CLAUDE.md` update, then hands off to the user. The handoff includes the list of PRs with links and the milestone results, plus two steps only the user can take:
   - (a) open a PR from `claude/intelligent-hamilton-r0i6wz` to `master` and merge it;
   - (b) set **Settings → Pages → Source = GitHub Actions**.

   The master push then runs the `deploy` job.

---

## 8. MVP, cut lines and non-goals

### 8.1 Milestones (each merged to integration with a green CI walk)

- **M1: standalone explainer** (T+20; checkpoint CP2 = T+22).
  - Platform, the DOM machine and sandbox, the 3D machine with its signal, the gate engine with every rule in §4.1, and the Prologue plus Act I (I.1–I.4).
  - Covers definition-of-done items 1, 2 (Act I) and 4 (partly).
- **M2: Rejewski attack** (T+24; CP3 = T+27). The crypto kit, II.5–II.8, the recall, and novel artefact 1.
- **M3: bombe** (T+29; CP4 = T+32). III.9–III.12 and novel artefact 2.
- **M4: course complete** (T+34.5; CP5 = T+37). The capstone, and 17 release with deploy-ready and handoff.

**The MVP is M1 + M2 + M3 + M4 after cuts 1–6 below.** It still meets every definition-of-done item:
- the core chapters of all four acts are gated;
- both novel artefacts are present;
- 3D and DOM operation work;
- e2e covers every route;
- the review walk is clean;
- deploy-ready is proven, pending the user's handoff.

### 8.2 Cut lines (apply in order; each is tied to a checkpoint)

| # | Trigger | Cut |
|---|---|---|
| 1 | CP1 (T+11) missed by more than 1 h | Close 03 if it has not merged: the Python reference oracle in CI remains. Trim 05's fixture to one item per *category* (free response, set-machine, code, custom). The rules and tests stay complete |
| 2 | CP2 (T+22) missed | 3D level **L1**: 11 ships the signal tube, head, reflector arcs and the M4 slot. Cables become lit sockets, toy geometry stays 2D, and Bloom becomes emissive only |
| 3 | 06 not merged by CP2 | 3D level **L2**: 3D is used only in the sandbox, the home page and the Prologue. Every chapter stays on Stage2D (StageHost fallback), with no code change in the chapters |
| 4 | CP3 (T+27) missed | II.8 becomes story plus an ungated explore scene. Its gate is removed and V2 moves Act II's ending to II.7. CycleAlign is removed from II.6 |
| 5 | CP4 (T+32) missed | III.12's `set-key` folds into the capstone British route and III.12 becomes story plus explore. The full-wheel-order run in III.11 shrinks to a 676-position window |
| 6 | CP5 (T+37) at risk | The capstone keeps the British route only: `british-key` and `read-intercepts`, with the Polish tools as an ungated explore. 17 drops CodeMirror and keeps the textarea |
| 7 | only when explicitly approved by the user | The 26-wire view in III.11 keeps its 8-wire version plus one 26-wire position |

**Never cut:**
- engine accuracy (vectors and oracles);
- every gate rule in §4.1 (2-of-3, the ladder, rollback, pairing, set-machine locks, bets gating reveals, no timers);
- DOM and keyboard parity and the synced trace;
- the Rejewski invariance and catalogue lookup;
- the bombe wire view with the diagonal toggle;
- the console-clean walk;
- zero BLOCKERs at merge.

### 8.3 Non-goals

- Tamper-proofing against devtools, localStorage edits or calls to `__course.answer`, which are the same path as the UI. The gates stop guessing and agent-pasting, not a determined cheater with devtools.
- Servers, accounts, analytics, i18n and offline mode.
- Pyodide or Python exercises, Monaco, and MDX.
- gsap and react-spring: every animation is a pure function of the playback clock.
- WebGPU and R3F v10.
- Downloaded, photoreal or share-alike 3D assets, and copying code from unlicensed repositories.
- A 36-drum 3D bombe: link to Virtual Bombe instead.
- Side quests: Herivel square, cillies, hill-climb, M4 and Shark, Banburismus.
- Ring-setting recovery (stated as a simplification in II.7, III.12 and the capstone).
- Spaced repetition beyond the act recalls and the return-visit check.
- Sound.
- Pixel-baseline screenshot assertions in CI; screenshots are for reviewers only.
- Merging to `master` and enabling Pages inside the session: these are the user's handoff.

---

## 9. Risks and mitigations

### 9.1 Risk register

| Risk | Likelihood / impact | Mitigation · detection |
|---|---|---|
| Engine regression (double step, rings) | Low / critical | 01 frozen; 19 vectors plus property tests; the three-oracle job (03); 03's `--check` |
| Crypto kit wrong (catalogue, bombe semantics) | Medium / critical | Vectors 13 and 14, invariance and true-stop property tests, a board-never-adds-stops property, and a frozen API from 08's first commit · 08's unit suite, then chapter e2e |
| Gate loopholes (guessing, rerolls, deep links, DOM leaks, pasted code, trial presses) | High / high | Pure reducer truth tables; a guess bot below 1%; persisted seeds; route guards; a no-leak scan; the probe-before-Run lock; an in-page pairing item; set-machine keyboard locks; the agent-paste probe · reviewer R5 on every chapter |
| Bets become fatiguing or get skipped | Medium / medium | Bets only on first-time reveals, at most 3 per scene; freePress afterwards; V6 lint · e2e gating assertions |
| Contract churn after fan-out | Medium / high | `[contracts-v1]` freeze; the pilot (07) is the single amendment point (`[contracts-v2]`, additive); later changes only through a hotfix; no chapter PR before 07 merges |
| Merge conflicts or ownership drift | High / high | Dependencies only in 02; stub-and-own; per-chapter folders; `ownership-check` inside `npm run check` and CI |
| Stacked-PR breakage (squash orphaning) | Medium / high | Merge commits only; explicit retargeting to integration; children merge integration and re-verify (§7.5) |
| Integration broken by disjoint merges | Medium / high | CI on every integration push (check, e2e, 3D, walk, pages-artifact); a hotfix jumps the queue; merges stop while it is red |
| CPU and agent contention (4 CPUs, 2 agents) | High / medium | 2 slots with reviewers counted; 1 Playwright worker and 2 Vitest workers per agent; local e2e limited to own tags; full suite in CI; unique ports 41NN/51NN; `reuseExistingServer: false` |
| Headless WebGL blank or flaky | Medium / high | SwiftShader flags plus a renderer smoke test; state-based `__stage` assertions; 2D by default in e2e; a separate 3d project; no pixel diffs |
| 3D slips | High / medium | StageHost's 2D fallback means content never waits; L1 and L2 cuts at CP2; 3D sits in slot B off the critical path |
| Slow catalogue or bombe runs in the browser | Medium / medium | Workers with typed arrays and a progress bar; the < 10 s budget; three candidate wheel orders in the capstone; window-limited scans for stop generation |
| Vitest silently skipping `.tsx` tests | Medium / medium | 02 widens `include` to `{ts,tsx}`; the happy-dom docblock is enforced by a ban test |
| Node-side import of `gates.ts` breaks Playwright | Medium / high | The L4 purity lint; 02's platform spec proves a Node import; `solveInNode` covered in 05 |
| Historical or numeric errors | Medium / high | The §4.3 fact register with sources; `keyspace.ts`; the R6 reviewer check |
| XState restore bug (#5178) | Low / medium | No snapshots and no history states; rebuilt from plain `ProgressV1`; versioned key and quarantine |
| Anti-gaming misfires in e2e | High / low | `configure({minLatencyMs: 0})` by default in e2e; a dedicated gaming test |
| Transfer items unreachable | Was high; now none | Transfer is a separate `once` item; L3 CC-learner test |
| Model-invalid generated setups (VI–VIII under model I) | Medium / medium | V12 validates every setup over the lint seeds; `setModel` and `setConfig` switch models |
| Deploy unverifiable in session | Certain / low | The `pages-artifact` job on integration pushes plus deploy.spec and release.spec; master merge and the Pages setting handed to the user |
| Scope overrun (about 65 slot-hours) | High / high | Milestones with wall-clock checkpoints and ordered cuts (§8.2); a queue that prioritises M1 |
| The 65-indicator transcription typo (SYZ SCW) | Certain / low | `products()` reports conflicts and resolves them by majority; the vector-13 test pins the result |

### 9.2 Judge findings resolved (where each "mustFix" lives)

| Finding | Resolution |
|---|---|
| The transfer instance is unreachable | G9 and §3.4 (`transfer` requires `once`); V9; L3 CC-learner test (§3.13) |
| Bet coverage and bet fatigue | `SceneDef.introduces`, `reveals` and `bets`, and `freePress` (§3.4); G10; V6; the chapter e2e reveal assertions (§6.0 template 2); `playback.gated` (§3.2) |
| Guessability should be computed, not declared | L2 guess bot below 1% (§3.13); `sampleAnswer` on every item (§3.4, §3.6); constant or binary answers are `once` or sit beside free-response items |
| Set-the-machine items solvable by trial presses | G8; `set-machine` locks the keyboard and hides lamps, and checks the predicate on Submit only (§3.6); e2e template 6; reviewer R5 |
| Agent-resistant pairing | G7; V8 (an `inPage` item is required); reviewer agent-paste probe (R5); `copy-brief` |
| One component per scene, checkable in 3D | `Focus` is a single part or group (§3.3); `dimmedParts` is the single definition; V5; `__stage.info()` focus and dimmed; e2e template 3; 06's `@3d` preset test; reviewer R4e in both 2D and 3D |
| Story rules enforceable, and the act clock | Data-only `StorySpec` (§3.4); V3 and V4; L5 year ban; `ClockSpec` is static and story-only; G12 and G17; clocks in the Prologue, II.5, III.9 and the capstone |
| Rollback for non-path items | The `Rollback` union (§3.4); the per-kind table (§4.1); `Feedback` required (V1); e2e template 4a |
| Unified pass rule and hint timing | §3.5 rules 1–7 with a truth table; puzzle L1 at attempt 3; `isGaming` covers ladder and reveals |
| Spaced and interleaved retrieval | §4.2: act recalls across all earlier acts, and a return-visit check after 6 h or more (`lastVisit`) |
| Merge method for the stack | §7.5 steps 4 and 5: merge commits only, explicit retargeting, children merge integration |
| CI on the integration branch | §2.8 push triggers plus the walk and pages-artifact jobs; §7.5 step 6 |
| Config ownership and a DOM test environment | 02 owns the configs; `include {ts,tsx}` plus happy-dom (§6.1); 03 barred from configs (§6.2) |
| Agent and CPU capacity | §5.3: 2 slots including reviewers; worker limits; local and CI e2e scope (§7.1) |
| One gate-scoring contract, and seeds | §3.5 (per-item windows, how code and probe combine, `workedSeed` distinct from current and next) |
| Model-valid generators | G18; V12; `randomConfig` and `dayKey` validity; `setModel`; `windows-m3` uses M3 |
| Playwright pinned at 1.56.0 | §6.0 item 4; §6.1 pin list; no `playwright install` locally |
| Concurrency cap of 2 | §5.3 schedule, recomputed critical path (§5.4) |
| A tiered MVP with wall-clock cuts | §5.4 milestones M1–M4 and CP1–CP5; §8.2 |
| Pages deploy cannot be verified in session | §2.8 pages-artifact on integration; deploy and release specs; §7.6 user handoff |
| Unit-test configuration contract | §6.1 step 1b; the L5 docblock ban; pure crypto, with workers kept in separate files (§3.11) |
| E2E runtime budget and scope | §7.1 budgets and tags; CI sharding; over-budget is a MAJOR finding |
| Stacked-PR mechanics and CI observation | §7.5 steps 3–6 |
| A contract pilot before fan-out | 07 pilot (§6.6); no chapter PR before its merge; `[contracts-v2]` batch (§7.5 step 7) |
