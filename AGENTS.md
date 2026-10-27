# aisus

aisus is a VS Code extension with agent skills. A coding agent maps a repository into a diagram whose boxes open the code they cite. aisus cloud at https://aisus.dev shares maps with a team, and an IntelliJ plugin and a GitHub Action reuse the same viewer and model. Bug-hunt learning sessions are an experimental second track.

## Shifts

The team works on `main` in shifts of a few days. Each shift keeps one shift doc in `docs/shifts/`, and ends with a handover in that doc for the next person.

**Start of a shift**
1. Run `git pull`, then check `git status`, `git log` and the CI runs on `main`.
2. Read this file, the newest file in `docs/shifts/` and `docs/open.md`.
3. Copy the template in `docs/shifts/README.md` to `docs/shifts/<start date>-<your handle>.md` and commit it as your first change.

**During the shift**
- Write a proposal table into your shift doc before a feature's first line of code. Give one row per file or logical unit, with the change and an estimated size such as `+40 / -12`, then list the tests the feature needs.
- Add a log line to your shift doc for each decision, departure from the proposal, or problem found. The build never departs from a proposal unannounced.
- Add each problem you leave unsolved to `docs/open.md` with the next free ID. Remove an item from `docs/open.md` when you solve it, and record its ID and commit in your shift doc.

**End of a shift**
- Write the handover with the `shift-handover` skill (`.agents/skills/shift-handover/SKILL.md`). An agent without skills reads that file and follows it.
- Commit and push the shift doc. The next shift starts from it.

## Where things are

| File | What it holds |
|---|---|
| `docs/shifts/` | One doc per shift: proposals, the log and the handover |
| `docs/open.md` | Every open problem and unfinished piece of work, with stable IDs |
| `docs/maintaining.md` | How to build, test, run and change each part, and how to deploy and release |
| `docs/architecture.md` | The modules and the contracts between them |
| `docs/messages.md` | Every notification the extension shows, checked by a test |
| `docs/vision.md` | Why aisus exists. It adds no requirements |
| `docs/adr/` | Decisions on security, data formats, runtime dependencies and changes to accepted ADRs |
| `docs/design/` | Approved designs and mockups that are not fully built yet |
| `docs/archive/` | Docs kept for history and no longer maintained. Each opens with a line saying why |

## Working agreement

- Build what the shift's proposal describes. Ambitious ideas go into `docs/open.md` under Ideas, and the code stays minimal.
- Keep moving without waiting for others. Only the hard stops below pause a piece of work, and other work continues meanwhile.
- When a feature closes, add a Built column with the real sizes to its proposal table, and list where the build differs. Keep the proposed estimates as they were.
- Write a contract into `docs/architecture.md` when it crosses modules: messages, sidecars, config or API shapes.
- Make small changes, one idea per commit. The history should read as the product being built up.
- Ask before settling anything genuinely debatable. Make routine calls yourself and say in the log what you assumed.
- Write docs only when the work or a teammate asks for them.
- Describe conventions on their own merits. Name no other project or repository in commits, docs or comments.

## Hard stops

These need a teammate's explicit go, every time. Record each one you hit in `docs/open.md` with exact steps.

- Deploying the cloud, and pushing release tags or publishing to any store.
- Creating or changing OAuth apps, GitHub Apps, Stripe products or Stripe's mode.
- Anything that costs money, including paid agent calls and new AWS resources.
- Installing anything (see Installs).
- New network access in shipped extension code beyond `packages/cloud-client/`.
- Contacting anyone outside the team.

## Product rules

- **No ties outside aisus.** Name no other project, old product name or former repository anywhere in the tree. Use no links that work only through a redirect, no symbolic links and no migration shims that name old folders. History is never rewritten.
- **Words.** Use prose and few words. Nothing on any page or panel is smaller than body text. If a sentence isn't worth body size, delete it. Use no slop words, rhetorical questions, em dashes or exclamation marks. "aisus" is always lowercase.
- **Design.** Start from the approved designs in `docs/design/`. Screenshot at desktop and phone widths before you call UI done. The site is light, with pale green paper, forest ink and the lime accent #c8ef72. `docs/design/site-style.md` describes it.
- **Money and secrets.** Keep running costs low. Today that is one t4g.small server. Never print secret values.
- **Licence.** Never propose the MIT licence.

## Writing style

These rules cover docs, code comments, test comments and commit messages.

- **Lead with what happens.** State the behaviour or the instruction first, then any condition or exception.
- **Give each idea its own sentence.** A reason or a consequence starts a new sentence, rather than following a colon or a ", so".
- **Describe intended behaviour in positive terms,** rather than what a check guards against.
- **Explain only what a reader would ask about.**
- **Write full sentences,** without arrows or fragment shorthand.
- **Say investigation or research,** never spike.

For example, "A skill whose files differ from the bundled copy is reinstalled before launch." replaces "Integrity check: guards against tampered skills, so we reinstall."

## Tests

- Write the tests a feature's proposal calls for and no others.
- A test's comment states the behaviour it checks and claims only what the test asserts.
- Break the behaviour once on purpose and see the test fail before keeping it.
- Test our code. Library behaviour and test helpers get no tests of their own.
- Change an existing test only when new work replaces the rule it asserts.
- Run the tests as their own step and read the result before committing. A pipe such as `| tail` reports the last command's exit status and hides a failure.

## Gates

These are green before every push. `docs/maintaining.md` says how to run each.

- Always: `npm run check` (typecheck, tests, docs check, build, notices) and `npm run test:e2e`.
- When `apps/cloud/` or the viewer changes: the cloud's `test`, `typecheck`, `build` and `test:web`.
- When `apps/intellij/` or the viewer changes: `./gradlew test` in `apps/intellij/`. It needs JDK 21. On a machine without Java, say so in the log and let CI's `plugin` job run it.

CI on `main` is not fully green yet. `docs/open.md` lists the failing jobs. A push must not add a new failure.

## Git

- Commit on `main` as `<scope>: <summary>`, where the scope is a feature ID or an area such as `cloud`, `viewer` or `docs`. Stage only that change's files.
- Push to `origin/main` whenever the gates are green. Pull with `git pull --rebase` first.
- Never rewrite pushed history. Before a reset, revert or squash that drops or changes commits, state the resulting history and wait for a yes. Rebasing your own unpushed commits needs no yes.
- Others push between your commits. Re-read a file before changing it.

## Installs

Install nothing without a teammate's go. That covers toolchains, system packages, browsers, agent CLIs and every new npm dependency, including Playwright's browser download. List exactly what is needed, with versions, and wait. In an Amp orb, `.agents/setup` has already installed what the gates need.

## Repository hygiene

Keep tool output and scratch files out of the repository. Build and probe in a scratch folder or in the folders git already ignores (`dist/`, `out/`, `node_modules/`, `.scratch/`).

## Shell and environment

Shifts run on different machines. Note anything new about your machine in your shift doc's log.

- **Node.** The toolchain needs Node 22.12 or newer, and `.nvmrc` pins 26. Check `node -v` first. Where nvm provides Node, start each command that runs `node`, `npm` or `npx` with `source ~/.nvm/nvm.sh && nvm use >/dev/null &&`.
- Run tools through the npm scripts or `node_modules/.bin`. A bare `npx <tool>` can pick up a stale cache built for an older Node.
- Unset `ELECTRON_RUN_AS_NODE` before `npm run test:e2e`. Terminals inside editors set it.
- Other agent sessions may run on the same machine. Give any server or database you start its own port and name, and remove it afterwards.
- **On WSL.** Non-interactive shells resolve `node` to system Node 18. Docker Desktop's integration drops out and comes back, so run `docker version` before concluding Docker is off. WSL forwards only IPv4 to Windows, so a server meant for a Windows browser listens on `0.0.0.0`. Headless Chromium lacks `libnss3` and `libnspr4`, and there is no sudo. With a go, `apt-get download` both into a scratch folder, extract each with `dpkg -x`, and set `LD_LIBRARY_PATH` to the extracted `usr/lib/x86_64-linux-gnu` for the browser run.
- **On macOS.** Node may come from Homebrew rather than nvm. The e2e runner already avoids the keychain prompt and hides any real agent CLIs from the VS Code under test.
- **In an Amp orb.** Run the e2e gate as `xvfb-run -a npm run test:e2e`, because the orb has no display.

## Decisions

Write an ADR only for a security property, a data format, a new runtime dependency, or a change to an accepted ADR. Use the MADR template in `docs/adr/`, keep it short, and add it to the index in the same change. `npm run check:docs` checks both. Accepted ADRs are edited only to change their status or fix a link. Every other decision gets one line in the shift doc's log.
