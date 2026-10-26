# Maintaining aisus

How to build, test, run and change each part, and how to deploy and release. [AGENTS.md](../AGENTS.md) holds the rules this follows.

## The gates

| Gate | Command | Run it when |
|---|---|---|
| Root check | `npm run check` | Always |
| Extension e2e | `npm run test:e2e`, with `ELECTRON_RUN_AS_NODE` unset | Always |
| Cloud | `npm run -w apps/cloud test`, `typecheck`, `build` and `test:web` | `apps/cloud/` or `packages/viewer/` changed |
| IntelliJ plugin | `./gradlew test` in `apps/intellij/` | `apps/intellij/` or `packages/viewer/` changed |

- The e2e suite downloads VS Code 1.126.0 and 1.141.0 into `.vscode-test/` and runs every scenario on both.
- `test:web` starts the cloud with mock GitHub and Stripe servers on ports 3210 to 3213. Two runs on one machine collide on those ports.

## The VS Code extension

- The code is in `apps/vscode/src/` (the host), `packages/core/model/` and `packages/core/layout/` (shared logic), and `packages/viewer/` (the sidebar and the map panel).
- Tests live in `test/unit/`, `test/dom/` and `apps/vscode/test/e2e/`.
- `npm run package` builds the `.vsix` in the repository root. Users get it from a release.
- Every notification is listed in [messages.md](messages.md). `test/unit/messages.test.ts` fails when that file and the code differ.

To try your build, install it into VS Code and reload. Cursor installs the same file with `cursor --install-extension`.

```bash
npm ci
npm run package
code --install-extension aisus-0.3.0.vsix
```

## The map viewer

- `packages/viewer/` holds the one viewer that the extension, the cloud and the IntelliJ plugin share.
- `node esbuild.mjs --cloud` writes the cloud's copy, and the cloud's build runs it for you.
- `node esbuild.mjs --intellij` writes the plugin's copy into `out/intellij/`.
- Run the tests of every host after you change the viewer.

## The skills

- Each skill is a folder under `skills/`, holding `SKILL.md`, `references/` and script sources that `npm run build` bundles into `apps/vscode/dist/skills/`.
- The build also regenerates the integrity hashes the extension checks before it launches a skill. Commit them with the change.
- Users install the skills with `npx skills add aisusdev/aisus`, or through the extension's **aisus: Install Agent Skills**.
- To put the skills in another project from a terminal, build once and run the CLI. Use `--scope user` for your home folder instead.

  ```bash
  node apps/vscode/dist/cli/aisus.mjs install --root /path/to/project --scope project
  ```

## The core CLI

The CLI lives in `packages/cli/`. A build bundles it into `apps/vscode/dist/cli/aisus.mjs`, and a release ships it as `aisus.mjs`. It installs skills, reports staleness, runs pull request checks and publishes to the cloud.

## The GitHub Action

- The source is in `apps/action/src/`.
- Run `npm run action` to rebuild `apps/action/dist/index.js`, and commit the rebuilt file, because the Action runs from it. CI's `action-dist` job fails when the two differ.

## aisus cloud

- The cloud is the Next 16 app in `apps/cloud/`, using PGlite and Drizzle, with next-auth for GitHub sign-in and plain CSS in `apps/cloud/src/app/globals.css`.
- **Plans** are in `apps/cloud/plans.ts`, and Stripe calls are in `apps/cloud/src/lib/billing.ts`. To change plans or prices, update ADR 0067 and `infra/stripe-setup.sh`.
- **Migrations:** append new ones to `apps/cloud/src/db/migrations.ts` and never edit old ones.
- **The docs pages** at `/docs` render the files listed in `apps/cloud/src/lib/docs.ts`.

### Run it locally

A stand-in for GitHub signs you in as `dev` and treats every repository under `acme` as yours, so no OAuth app is needed. Start it in one terminal.

```bash
node apps/cloud/test/web/mockGithub.mjs 3211
```

Build and start the cloud in a second terminal. The database lives in `apps/cloud/.data/dev`, which git ignores.

```bash
npm run -w apps/cloud build
cd apps/cloud && AISUS_DB=.data/dev NEXTAUTH_URL=http://localhost:3000 NEXTAUTH_SECRET=dev-secret-dev-secret-dev-secret GITHUB_CLIENT_ID=dev GITHUB_CLIENT_SECRET=dev GITHUB_OAUTH_URL=http://localhost:3211 GITHUB_API_URL=http://localhost:3211 AISUS_OIDC_JWKS_URL=http://localhost:3211/.well-known/jwks npm run start -- -p 3000 -H 0.0.0.0
```

Open http://localhost:3000 and sign in. To put a map on it, create an upload token at http://localhost:3000/settings/acme/demo, then publish from a clone of a project whose map is committed on `main`.

```bash
git clone /path/to/project /tmp/demo && cd /tmp/demo
git remote set-url origin https://github.com/acme/demo.git
AISUS_TOKEN=<token> node <aisus checkout>/apps/vscode/dist/cli/aisus.mjs publish --url http://localhost:3000
```

The map then shows at http://localhost:3000/acme/demo. To sign in with your real GitHub account, create an OAuth app whose callback is `http://localhost:3000/api/auth/callback/github`, use its ID and secret, and leave out the three mock URLs. `infra/local/compose.yaml` runs the same app in Docker.

## Deploying the cloud

Deploying is a hard stop. Get a teammate's go first.

- `infra/deploy.sh [ref]` deploys `origin/main`, or the named ref, to the server. The server builds the image itself.
- **Local files:** the script needs `~/.config/aisus/` with `secrets.env`, `aisus.pem`, `server.env` and `known_hosts`. Get these from a teammate by a private channel, never through git. Add your own SSH key to the server rather than share `aisus.pem`. `infra/env.example` lists the secrets.
- **The stack:** `infra/compose.yaml` runs Caddy, the cloud, Umami, Prometheus, node-exporter and Grafana. Their configs are under `infra/`. Visit counts are at `https://stats.aisus.dev` and metrics at `https://aisus.dev/grafana/`.
- **Other scripts:** `infra/aws-up.sh` and `infra/aws-down.sh --yes` create and remove the server. `infra/stripe-setup.sh` sets up Stripe.
- **The deploy workflow:** `.github/workflows/deploy-cloud.yml` runs on pushes to `main` when the repository variable `AISUS_DEPLOY` is `true`, and calls the secret `AISUS_DEPLOY_HOOK`.

## The IntelliJ plugin

- The plugin is Kotlin under `apps/intellij/`, built with the Gradle wrapper and JDK 21, targeting IntelliJ 2026.1 and later.
- Run `node esbuild.mjs --intellij` and `npm run build` first. The plugin packs the viewer and the CLI from `out/intellij/` and `apps/vscode/dist/`.
- Then run `./gradlew test` and `./gradlew buildPlugin`. The second writes `apps/intellij/build/distributions/*.zip`, which users install from disk.
- `./gradlew verifyPlugin` checks compatibility.
- The plugin's home panel is Swing, separate from the VS Code sidebar.

## Releases

Pushing a release tag is a hard stop. Get a teammate's go first.

- Pushing a `v*` tag runs `.github/workflows/release.yml`. It publishes the `.vsix`, `aisus-skills.zip`, `aisus.mjs`, `aisus-action.js` and `SHA256SUMS`.
- `/install` on aisus.dev redirects to the newest release's `.vsix`. It reads `AISUS_RELEASES_REPO`, which the server sets to `aisusdev/aisus`.

## Docs

- `npm run check:docs` checks the ADRs against the MADR template and the index, and checks every relative link under `docs/` except in `docs/research/` and `docs/archive/`.
- To archive a doc, move it into `docs/archive/` and start it with one line: `> Archived <date>. <why, and where its content went>.`
