# Open problems and unfinished work

Every known problem and unfinished piece of work, with an ID that never changes. Add new items with the next free ID. Remove an item when it is solved, and record its ID and commit in your shift doc. The next free ID is P-21.

## Broken now

- **P-1 Windows unit tests fail in CI.** `check (windows-latest)` fails in `validate.test.ts`, `session.test.ts`, `hooksFiles.test.ts` and `repoFacts.test.ts`, as in run 40316109729. Ubuntu and macOS pass. This is ENG-01's open `[ci]` half.
- **P-2 The e2e job fails in CI.** On Linux under xvfb, LRN-01's Claude session test, SAF-06's hook test and SKL-02's tour test's setup fail, as in run 40316109729. The same suite passes locally on macOS.
- **P-3 The cloud deploy workflow fails on every push.** The repository variable `AISUS_DEPLOY` is `true`, but the secret `AISUS_DEPLOY_HOOK` is empty, so `curl` exits 3. Set the hook (a hard stop) or set the variable to `false`.
- **P-4 `/docs` on aisus.dev answers 500.** The cloud's image copies neither `README.md` nor `docs/`, which `apps/cloud/src/lib/docs.ts` reads at request time.

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
- **P-6 CLD-18 Team page.** The last item of I9 (team cloud sync). Its proposal and tests are in the "Team cloud sync proposal" of [archive/progress-v0.3.md](archive/progress-v0.3.md), and its requirement in [archive/spec-v0.3.md](archive/spec-v0.3.md).
- **P-7 Day 1, the signed-in cloud.** See the "Day 1 proposal" in [archive/progress-v0.3.md](archive/progress-v0.3.md), [design/onboarding-mockup.html](design/onboarding-mockup.html) and [design/cloud-first-run.md](design/cloud-first-run.md). The landing page and design system are done. Still to build:
  - the signed-in home ("Your repositories");
  - the three-step first run (account, plan, set up a repository);
  - one plan gate for every locked feature;
  - the filled-in publish command next to a new upload token;
  - the settings page that non-owners see.

  Billing today offers Upgrade only for accounts that already own a repository aisus has seen. The home must let users buy for their own account and for organizations they administer.
- **P-8 Private repositories through the GitHub App.** The app exists as `aisus-cloud` under the aisusdev organization, with only Metadata read-only and no webhook. Its keys are in the shared secrets file as `GITHUB_APP_CLIENT_ID`, `GITHUB_APP_CLIENT_SECRET` and `GITHUB_APP_SLUG`. Sign-in still uses the older OAuth app through `GITHUB_CLIENT_ID`. Build the app's sign-in (phase 3 in [design/cloud-first-run.md](design/cloud-first-run.md)), write its ADR, then switch the keys in one deploy. Until then, private repositories answer "not found" on aisus.dev.
- **P-9 Day 2.** A repository without a map shows a setup checklist, and the Action uploads the main map from the default branch. See the Day 1 proposal's sibling rows in the "Plans and first run" section of [archive/progress-v0.3.md](archive/progress-v0.3.md).
- **P-10 Release v0.3.1** after P-5. A teammate pushes the tag. Then delete the v0.3.0 release with `gh release delete v0.3.0 -R aisusdev/aisus --cleanup-tag --yes`.

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
