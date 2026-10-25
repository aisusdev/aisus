# Handoff

This guide is for the agent that takes over aisus. Read AGENTS.md first, because its rules still apply. This file covers three things: what is unfinished, the owner's standing preferences, and how to change each part of the project. Delete each item under "Unfinished work" once it lands, and delete this file when the list is empty.

## State on 2026-10-24

- The repository is github.com/aisusdev/aisus, with `main` as the only branch.
- https://aisus.dev runs commit `17cdcaf`. Later commits change only the extension and docs.
- Release v0.3.0 is the only release, and `/install` serves its `.vsix`. It was built before the website redesign and the sidebar tabs.
- Stripe runs in test mode, with Pro at $5 a month and Team at $10 per seat a month.
- `git stash@{0}` holds an abandoned partial attempt at the toolkit cut. Drop it with `git stash drop` rather than apply it.

## Unfinished work, in order

1. **The toolkit cut.** Read the section "A toolkit for sustainable development" in `docs/progress-v0.3.md`. Its two proposal tables are approved. Nothing from them is built yet.
   - Maps move from the old map folder (the constant in `src/model/runFolder.ts`) to `.aisus/maps/<run>/`, and learning sessions move to `.aisus/sessions/<run>/`.
   - The git exclude lines aisus writes change to match. A plain `.aisus/` line written earlier must go, because it would hide committed maps.
   - Skills installed into a repository become real copies in `.agents/skills/` and `.claude/skills/`, with no symbolic link.
   - Every link names `aisusdev/aisus`.
   - Every file copied from the open-source project named in `THIRD_PARTY_NOTICES.md` gets replaced with aisus's own: the two map schemas in `src/model/schemas/` (`architecture` and `common`), every fixture under `fixtures/`, `skills/aisus-architecture/references/example.json`, and both skills' format guides under `references/`.
   - Write the schemas clean-room. One agent describes the format's fields from the current schemas and validator, in its own words. A second agent writes new schemas from that description without opening the old files. A script then checks that the new and old schemas accept and refuse the same documents.
   - Write the new fixtures as invented systems with the same coverage as the old ones: nesting, wide graphs, Japanese and Korean labels, portrait cards, first drafts, a base and head pair, and a skill run. First list what every test reads from every fixture.
   - Once nothing copied remains, remove that project's section from `THIRD_PARTY_NOTICES.md` and from `tools/scripts/notices.mjs`.
   - Finally, apply `kerk/landing-copy.md` to the README opening, `package.json`, the plugin description and `docs/vision.md`.
   - Check with `git grep -i` for the project's name, its author's handle, the old product name, the earlier prototype's name, the former team repository and the owner's personal GitHub account. Only `.git` history may still hold them.
2. **Day 1, the signed-in cloud.** See the "Day 1 proposal" table in `docs/progress-v0.3.md`, `kerk/onboarding-mockup.html` and `kerk/cloud-first-run.md`.
   - The landing page and design system are done.
   - Still to build: the signed-in home ("Your repositories") and the three-step first run (account, plan, set up a repository), one plan gate for every locked feature, the filled-in publish command next to a new upload token, and the settings page that non-owners see.
   - Billing today offers Upgrade only for accounts that already own a repository aisus has seen. The home must let users buy for their own account and for organizations they administer.
3. **Private repositories through the GitHub App.** The app exists as `aisus-cloud` under the aisusdev organization. It has one permission, Metadata read-only, with no webhook. Its keys are in the owner's secrets file as `GITHUB_APP_CLIENT_ID`, `GITHUB_APP_CLIENT_SECRET` and `GITHUB_APP_SLUG`.
   - Sign-in still uses the older OAuth app through `GITHUB_CLIENT_ID`. Build the app's sign-in (phase 3 in `kerk/cloud-first-run.md`), write its ADR, then switch the keys in one deploy.
   - Until then, private repositories answer "not found" on aisus.dev.
4. **Day 2.** A repository without a map shows a setup checklist. The Action uploads the main map from the default branch. See the Day 1 proposal's sibling rows in the "Plans and first run" table.
5. **Release v0.3.1** after item 1. The owner pushes the tag. After that, the owner deletes the v0.3.0 release with `gh release delete v0.3.0 -R aisusdev/aisus --cleanup-tag --yes`.
6. **Rerun the e2e suite on VS Code 1.141.0** for the sidebar tabs. The last run could not download that version because of a DNS failure, and 1.126.0 passed.

## What the owner wants

- **No ties outside aisus.** No mention of other projects, old names or the former team repository anywhere in the tree. No links that work only through a redirect, no symbolic links, and no migration shims that name old folders. History is never rewritten.
- **Words.** Prose, and few words. Nothing on any page or panel is smaller than body text. If a sentence isn't worth body size, delete it. No slop words, rhetorical questions, em dashes or exclamation marks. "aisus" is always lowercase.
- **Design.** Start from the approved mockups in `kerk/` and screenshot at desktop and phone widths before you call UI done. The site is dark with the lime accent #c5f24a.
- **Money and safety.**
  - Keep running costs low. Today that is one t4g.small server.
  - Ask before anything that costs money.
  - Never print secret values.
  - Creating OAuth or GitHub Apps, switching Stripe to live mode, creating accounts and pushing release tags are the owner's steps.
- **Licence.** Never propose the MIT licence.

## Changing each part

Every change follows AGENTS.md:
1. A proposal table in `docs/progress-v0.3.md` before the code.
2. Tests seen to fail once.
3. Every gate green before the commit.
4. One idea per commit.
5. A log line after.

All gates are listed under "Gates" in AGENTS.md. In practice they are:
- root `npm run check` and `npm run test:e2e`;
- in cloud, `npm run -w cloud test`, `typecheck`, `build` and `test:web`;
- for plugin changes, `./gradlew test` in `intellij/`.

### The VS Code extension

- The code is in `src/extension/` (the host), `src/model/` and `src/layout/` (shared logic) and `webview/` (the sidebar and the map panel).
- Tests live in `test/unit/`, `test/dom/` and `test/e2e/`. The e2e suite downloads VS Code 1.126.0 and 1.141.0 into `.vscode-test/`. Unset `ELECTRON_RUN_AS_NODE` before running it.
- `npm run package` builds the `.vsix`. Users get it from a release.
- Every user-facing message is listed in `docs/messages.md`. Keep that file in step with the code.

### The map viewer

- `webview/` holds the one viewer that the extension, the cloud and the IntelliJ plugin share.
- `node esbuild.mjs --cloud` writes the cloud's copy, and the cloud's build runs it for you.
- `node esbuild.mjs --intellij` writes the plugin's copy.
- Run the tests of every host after you change the viewer.

### The skills

- Each skill is a folder under `skills/`, holding `SKILL.md`, `references/` and script sources that `npm run build` bundles into `dist/skills/`.
- The build also regenerates the integrity hashes the extension checks before it launches a skill. Commit them with the change.
- Users install the skills with `npx skills add aisusdev/aisus`, or through the extension.

### The core CLI

- The CLI lives in `src/cli/`. A release bundles it as `aisus.mjs`, which installs skills, reports staleness, runs pull request checks and publishes to the cloud.

### The GitHub Action

- The source is in `action/src/`.
- Run `npm run action` to rebuild `action/dist/index.js`, and commit the rebuilt file, because the Action runs from it.

### aisus cloud

- The cloud is the Next 16 app in `cloud/`, using PGlite and Drizzle, with next-auth for GitHub sign-in and plain CSS in `cloud/src/app/globals.css`.
- **Plans** are in `cloud/plans.ts`, and Stripe calls are in `cloud/src/lib/billing.ts`.
- **Migrations:** append new ones to `cloud/src/db/migrations.ts` and never edit old ones.
- **Browser tests:** `test:web` starts the app with mock GitHub and Stripe servers on ports 3210 to 3213. Take care when two runs share one machine.
- **Changing plans or prices:** update ADR 0067 and `infra/stripe-setup.sh`.

### Deploying the cloud

- `infra/deploy.sh [ref]` deploys `origin/main`, or the named ref, to the server. The server then builds the image itself.
- **Local files:** the script needs the owner's `~/.config/aisus/` folder with `secrets.env`, `aisus.pem`, `server.env` and `known_hosts`. Get these from the owner by a private channel, never through git. A new person should add their own SSH key to the server rather than share `aisus.pem`.
- **The stack:** `infra/compose.yaml` runs Caddy, the cloud, Umami, Prometheus, node-exporter and Grafana. Their configs are under `infra/`.
- **Other scripts:** `infra/aws-up.sh` and `infra/aws-down.sh --yes` create and remove the server. `infra/stripe-setup.sh` sets up Stripe.
- **The deploy workflow:** `.github/workflows/deploy-cloud.yml` does nothing until the repository variable `AISUS_DEPLOY` is set.

### The IntelliJ plugin

- The plugin is Kotlin under `intellij/`, built with the Gradle wrapper and JDK 21, targeting IntelliJ 2026.1.
- Run `node esbuild.mjs --intellij` and `npm run build` first. The plugin packs the viewer and the CLI from `out/intellij/` and `dist/`.
- Then run `./gradlew test` and `./gradlew buildPlugin`. The second writes `intellij/build/distributions/*.zip`, which users install from disk.
- `./gradlew verifyPlugin` checks compatibility.
- The plugin's home panel is Swing, separate from the VS Code sidebar.

### Releases

- Pushing a `v*` tag runs `.github/workflows/release.yml`, which publishes the `.vsix`, the skills zip, `aisus.mjs`, the Action bundle and `SHA256SUMS`.
- `/install` on aisus.dev redirects to the newest release's `.vsix`. It reads `AISUS_RELEASES_REPO`, which the server sets to `aisusdev/aisus`.

### Docs

- **Specs:** `docs/spec-v0.3.md` is the contract. `docs/vision.md` explains the reasons and adds no requirements.
- **Progress:** `docs/progress-v0.3.md` holds every proposal, tick and log line.
- **ADRs** live in `docs/adr/`. They use the MADR template, and each one is added to the index. `npm run check:docs` checks the ADRs and every relative link.
- **Owner's folder:** `kerk/` holds the owner's notes and mockups.
