# Open problems and unfinished work

Every known problem and unfinished piece of work, with an ID that never changes. Add new items with the next free ID. Remove an item when it is solved, and record its ID and commit in your shift doc. The next free ID is P-32.

## Broken now

- **P-1 Windows unit tests fail in CI.** `check (windows-latest)` fails in `validate.test.ts`, `session.test.ts`, `hooksFiles.test.ts` and `repoFacts.test.ts`, as in run 40316109729. Ubuntu and macOS pass. This is ENG-01's open `[ci]` half.
- **P-2 The e2e job fails in CI.** On Linux under xvfb, LRN-01's Claude session test, SAF-06's hook test and SKL-02's tour test's setup fail, as in run 40316109729. The same suite passes locally on macOS.
- **P-3 The cloud deploy workflow fails on every push.** The repository variable `AISUS_DEPLOY` is `true`, but the secret `AISUS_DEPLOY_HOOK` is empty, so `curl` exits 3. Set the hook (a hard stop) or set the variable to `false`.
- **P-4 `/docs` on aisus.dev answers 500.** The cloud's image copies neither `README.md` nor `docs/`, which `apps/cloud/src/lib/docs.ts` reads at request time.
- **P-25 On a phone, the map page's side panel covers the freshness bar.** Below the phone breakpoint, `.map-side` in `apps/cloud/src/app/globals.css` docks at the foot of the window, 12 pixels from the bottom and up to 40% of its height. The viewer's `.freshness` bar sits 8 pixels from the bottom too, so the panel hides it with its Refresh link on the map, pull request and share link pages. A first step is to dock the panel above the bar, or to fold the panel to its title until it is tapped.
- **P-26 Run estimates are far below what runs spend.** On this repository with Codex, two Ask questions read 167k and 184k input tokens against the shown "About 20k–70k tokens". A focused Generate run read 958k against "About 130k–270k". The figures come from the usage line each run prints. `apps/vscode/src/estimates.ts` sizes the estimate from the folder (CST-01), and `@aisus/core/model/estimate` holds the ranges. A first step is to compare the ranges with the usage log over a few runs, and to check whether Codex's cached input is counted as input.
- **P-27 Start Learning Session can look as if nothing happened on macOS.** After the agent is chosen, `ensureSkillIntact` in `apps/vscode/src/integrity.ts` asks to reinstall the `aisus-bugfix` skill in a modal warning. On macOS that is a native dialog, which can open behind the window. Until it is answered, no terminal, session panel or notification appears. Bug hunt is hidden behind `aisus.bugHunt.enabled` since 5581589, and the command still behaves this way. A first step is to show the reinstall question before the mode and task pickers, or as a notification.
- **P-28 Review changes counts a commit range two ways.** For `afaaaa3~1..0316c6b`, the sidebar says "1 touched · 0 stale · 0 gone · 1 not on the map". The map panel's overlay says "0 boxes touched, 1 more in the same files". A first step is to find which count is right when a box's file changed outside its cited lines.
- **P-29 The Bug hunt leaderboard shows an end time for an active run.** `packages/viewer/session.ts` prints `endedAt` whenever it is set. An active run showed "2026-10-30 01:02", and the value moved forward as the run went on. The time is the UTC part of the ISO string, while the user's clock read 09:02.
- **P-30 Two places break the words rules.** The sidebar's view title reads "Aisus" in VS Code 1.141, though `apps/vscode/package.json` names the container and the view "aisus". Investigation should find whether VS Code capitalises the title and whether a different field avoids it. `apps/vscode/src/learn.ts` shows em dashes in the Bug hunt mode's description, the task prompt's validation message and the hook warning.
- **P-31 Two layout faults in the extension.** In the focused map "Ask: sidebar question to cited answer", an arrow and its "streamed answer" label cross the "VS Code extension host" group label. In the sidebar, a citation wraps inside its line number, as `staleness.ts:1` above `09`.

## Unfinished work

- **P-5 The toolkit cut, the rest.** The renames and the move to `.aisus/maps/` and `.aisus/sessions/` are built (ADR 0070). Still to do:
  - Skills installed into a repository become real copies in `.agents/skills/` and `.claude/skills/`, with no symbolic link. `packages/core/install/skillFiles.ts` still links.
  - Every link names `aisusdev/aisus`. `git grep kerktaiheng` still finds the README, `apps/vscode/package.json`, `infra/` and `docs/architecture.md`.
  - Every file copied from the project named in `THIRD_PARTY_NOTICES.md` gets replaced: the two map schemas in `packages/core/model/schemas/` (`architecture` and `common`), every fixture under `fixtures/maps/`, `skills/aisus-architecture/references/example.json`, `skills/aisus-refresh/references/example.json` and both skills' `references/map-format.md`.
  - Write the schemas clean-room. One agent describes the format's fields from the current schemas and validator, in its own words. A second agent writes new schemas from that description without opening the old files. A script then checks that the new and old schemas accept and refuse the same documents.
  - Write the new fixtures as invented systems with the same coverage: nesting, wide graphs, Japanese and Korean labels, portrait cards, first drafts, a base and head pair, and a skill run. First list what every test reads from every fixture.
  - Once nothing copied remains, remove that project's section from `THIRD_PARTY_NOTICES.md` and from `tools/scripts/notices.mjs`.
  - Apply [design/landing-copy.md](design/landing-copy.md) to the README opening, `package.json`, the plugin description and `docs/vision.md`.
  - Check with `git grep -i` for the project's name, its author's handle, the old product name, the earlier prototype's name, the former team repository and the previous owner's GitHub account. Only `.git` history and `docs/archive/` may still hold them.
- **P-8 Private repositories through the GitHub App.** The app exists as `aisus-cloud` under the aisusdev organization, with only Metadata read-only and no webhook. Its keys are in the shared secrets file as `GITHUB_APP_CLIENT_ID`, `GITHUB_APP_CLIENT_SECRET` and `GITHUB_APP_SLUG`. Sign-in still uses the older OAuth app through `GITHUB_CLIENT_ID`. Build the app's sign-in (phase 3 in [design/cloud-first-run.md](design/cloud-first-run.md)), write its ADR, then switch the keys in one deploy. Until then, private repositories answer "not found" on aisus.dev.
- **P-9 Day 2.** A repository without a map shows a setup checklist, and the Action uploads the main map from the default branch. See the Day 1 proposal's sibling rows in the "Plans and first run" section of [archive/progress-v0.3.md](archive/progress-v0.3.md).
- **P-10 Release v0.3.2** after P-5. A teammate pushes the tag. Then delete the v0.3.0 release with `gh release delete v0.3.0 -R aisusdev/aisus --cleanup-tag --yes`.
- **P-23 The team page shows no seats bought after a first purchase.** Stripe's `checkout.session.completed` carries no seat count, and `applyEvent` in `apps/cloud/src/lib/billing.ts` stores seats only from `customer.subscription.updated`. Until the seats change in the portal, a new Team account's page says "N seats in use" without "of M". A first step is for `checkoutUrl` to add the seat count to the session's metadata, beside the account and plan it already sends, and for `applyEvent` to store it.
- **P-24 People removed on GitHub stay on the team page.** `teamOf` in `apps/cloud/src/lib/team.ts` and `seatsOf` read the stored access rows. `checkAccess` rechecks a row only when that same person signs in or opens one of the account's repositories, so someone who left the organization and never returns stays listed and counts as a seat. A first step is to recheck the account's rows older than `ACCESS_TTL_MS` when an owner opens the page, with the owner's token or the GitHub App (P-8).

## Waiting on a hard stop or a manual check

The steps for each are in the "Waiting" section of [archive/progress-v0.3.md](archive/progress-v0.3.md). Its paths predate the folder layout: read `cloud/` as `apps/cloud/`, `deploy/` as `infra/`, `intellij/` as `apps/intellij/`, `src/` as `apps/vscode/src/` or `packages/core/`, `.archify/` as `.aisus/maps/` and `kerktaiheng/aisus` as `aisusdev/aisus`.

- **P-11 Agent smoke checks.** Each needs the agent CLIs installed and signed in, and some need paid calls: UI-02 (streamed runs, with recorded streams for `test/fixtures/streams/`), UI-06 (Ask), SET-01 (per-user skills), LRN-01 (learning sessions on Claude Code, Codex and Devin), RCH-04 (Devin and copied prompts), CST-06 (the bench) and PRC-05 (map update in CI).
- **P-12 RCH-01 diagram page smoke.** Open an exported page on Windows, macOS and Linux and try each "Open in" target.
- **P-13 PRC-04 Action on this repository.** Commit a map of this repository under `.aisus/maps/`, open a pull request, and confirm the `aisus-check` job comments once and updates that comment.
- **P-14 RCH-02 skills from GitHub and as a plugin.** Run `npx skills add aisusdev/aisus` in a scratch folder, install the plugin from a release's `aisus-skills.zip`, and confirm `/aisus-architecture` runs its scripts in Claude Code.
- **P-15 RCH-05 store installs.** Install the extension from Open VSX and the Marketplace into a clean profile.
- **P-16 ACC-04 ground truth.** Run `npm run eval:check-truth` once with network access, and confirm it prints `ok` for each corpus repository.
- **P-17 IDE-01 plugin smoke.** Install the plugin's zip into IntelliJ IDEA 2026.1, generate a map of AB3, and confirm a box opens its cited lines.
- **P-18 DOC-01 demo.** Record `docs/media/demo.gif` (generate a map, click a box, Show Changes) and put it under the README's first paragraph.
- **P-19 CLD-10 Postgres.** The cloud runs on PGlite. Adding `pg@8` with `@types/pg` to `apps/cloud/` needs a go. `apps/cloud/src/db/client.ts` would then use Postgres when `AISUS_DB` is a Postgres URL.

## Ideas

Not planned. A shift may propose any of these.

- **P-20 Learning-session ideas.** A guided mode with per-step check commands, a Buddy Tour mode, a shared leaderboard (it needs network access and an ADR), an Open Learning Session command separate from Start Learning Session, a node finder and a history browser.
