# Contributing to aisus

aisus welcomes bug reports, fixes, docs and new ideas. This page takes you from a fresh clone to a merged pull request.

## Set up

You need Node 22.12 or newer. `.nvmrc` pins Node 26, so with nvm you can run `nvm use` in the repository.

```bash
git clone https://github.com/aisusdev/aisus.git
cd aisus
npm ci
npm run build
```

To try the extension, package it and install the file into VS Code or Cursor, then reload the window.

```bash
npm run package
code --install-extension aisus-<version>.vsix
```

Generating a map needs Claude Code or Codex installed and signed in. Viewing maps, running the tests and working on the viewer need neither.

## Find your way around

| Folder | What it holds |
|---|---|
| `apps/vscode/` | The VS Code extension |
| `apps/cloud/` | aisus cloud, the Next.js server behind aisus.dev |
| `apps/intellij/` | The IntelliJ plugin |
| `apps/action/` | The GitHub Action that checks pull requests |
| `packages/core/` | The map model, layout and checks that every app shares |
| `packages/viewer/` | The map viewer that the extension, the cloud and the plugin share |
| `packages/cli/` | The CLI that installs skills, runs checks and publishes maps |
| `skills/` | The agent skills that write and update maps |

[docs/architecture.md](docs/architecture.md) describes the modules and the contracts between them. [docs/maintaining.md](docs/maintaining.md) says how to build, test and run each part.

## Pick something to work on

- Issues labelled `good first issue` are small and self-contained.
- Issues labelled `help wanted` are ones the team would like a hand with.
- [docs/open.md](docs/open.md) lists every known problem and unfinished piece of work, each with a stable ID such as P-25.

Comment on an issue before you start on something large, so that two people don't build the same thing. A new idea is welcome as an issue first.

## Make a change

- Keep each commit to one idea. Write the message as `<scope>: <summary>`, where the scope is an area such as `viewer`, `cloud` or `docs`, or an ID from `docs/open.md`.
- Add tests for the behaviour you change. Break that behaviour once on purpose and check that the test fails before you keep it.
- Write docs and comments in plain, full sentences. State what happens first, then any condition. "aisus" is always lowercase.
- A change that alters a message between modules, a sidecar file, a config shape or an API also updates `docs/architecture.md`.
- A change to the cloud or the viewer that people can see comes with a screenshot at desktop and phone widths.

## Run the checks

These must pass before a pull request is merged. CI runs them too.

```bash
npm run check
npm run test:e2e
```

`npm run check` runs the typecheck, the unit tests, the docs check, the build and the licence notices. `npm run test:e2e` runs the extension in two versions of VS Code. Unset `ELECTRON_RUN_AS_NODE` first if your terminal is inside an editor.

When you change `apps/cloud/` or `packages/viewer/`, also run the cloud's checks.

```bash
npm run -w apps/cloud typecheck
npm run -w apps/cloud test
npm run -w apps/cloud build
npm run -w apps/cloud test:web
```

When you change `apps/intellij/` or `packages/viewer/`, run `./gradlew test` in `apps/intellij/` with JDK 21. Without Java, say so in the pull request and CI's `plugin` job runs it.

Some CI jobs on `main` fail today for known reasons, listed under "Broken now" in [docs/open.md](docs/open.md). A pull request should add no new failure.

## Open a pull request

Fork the repository, push your branch to the fork and open a pull request against `main`. The template asks what changed, why and how you tested it. A maintainer reviews it, and may ask for changes or merge it.

## Licence of contributions

aisus is licensed under the Apache License 2.0, in [LICENSE](LICENSE). The cloud server in `apps/cloud/` is licensed under the GNU Affero General Public License v3.0 only, in [apps/cloud/LICENSE](apps/cloud/LICENSE). Your contribution is licensed under the licence of the folder it changes.

## Conduct and security

Everyone taking part follows the [code of conduct](CODE_OF_CONDUCT.md). Report security problems privately, as [SECURITY.md](SECURITY.md) describes, rather than in a public issue.
