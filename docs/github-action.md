# The aisus GitHub Action

The aisus Action compares each pull request with your repository's architecture map and comments on it. The comment lists the boxes the change touches, the boxes it leaves stale and the new code that no box covers. The check runs on GitHub's runners, costs no agent tokens and sends nothing outside GitHub unless you turn on uploads.

## Before you start

Commit a map. Generate one with the extension or with `/aisus-architecture` in Claude Code, then commit its run folder in `.aisus/maps/`. The README's section [Commit your map](../README.md#commit-your-map) lists what the folder holds.

When the repository has more than one map, name the one to compare with in `aisus.config.json` at the repository root. Without it, the Action uses the newest map with an empty focus.

```json
{ "map": "architecture-payment-flow-20261018-101500" }
```

## Set it up

1. Add `.github/workflows/aisus.yml` to your repository.

   ```yaml
   name: aisus
   on: pull_request
   permissions:
     contents: read
     pull-requests: write
   jobs:
     check:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v5
           with:
             fetch-depth: 0
         - uses: aisusdev/aisus/apps/action@main
   ```

   `fetch-depth: 0` gives the Action the history it compares against. `pull-requests: write` lets it post its comment.

2. Commit the file on your default branch.
3. Open a pull request that changes some code. The aisus check runs, and a comment from github-actions appears on the pull request.
4. Push more commits. The Action updates its one comment rather than adding new ones.

To pin a version, replace `main` with a release tag such as `v0.3.4`.

## Read the comment

- **Touched boxes** are the boxes whose files the pull request changes. Each says whether its cited lines changed or only other lines in its files.
- **Stale boxes** are boxes whose cited code changed since the map was made, or whose cited file is gone. Refresh them with the extension's Refresh This Box, or with `refresh` below.
- **Not on the map** lists changed files that no box cites.

The job's `result` output is `pass` or `fail`, for later steps that need it.

## Options

Set these in the Action's `with:` block.

| Option | What it does | Default |
|---|---|---|
| `fail-on` | Fails the check on the listed findings, `stale`, `new-box` or both, separated by a comma | Never fails |
| `map` | The run folder of the map to compare with | `aisus.config.json`'s map, then the newest map with an empty focus |
| `comment` | Whether to post the comment | `true` |
| `refresh` | Updates the map on the pull request's branch with `claude` or `codex` when it has stale boxes or new folders | Off |
| `upload` | Uploads the check and its map to aisus cloud | `false` |
| `cloud-url` | aisus cloud's address, for `upload` | None |
| `github-token` | The token that posts the comment | The job's token |

For example, this step fails the check when a pull request leaves a box stale.

```yaml
- uses: aisusdev/aisus/apps/action@main
  with:
    fail-on: stale
```

## Refresh the map in the pull request

With `refresh: claude` or `refresh: codex`, the Action asks that agent to update the map on the pull request's branch and commits the result. The job then needs these things:

- The agent's CLI on the runner's `PATH`.
- `ANTHROPIC_API_KEY` or `OPENAI_API_KEY` in the step's `env`, from a repository secret.
- The pull request's head checked out, with `ref: ${{ github.head_ref }}` on the checkout step.
- `permissions: contents: write`.

Refresh never runs on a pull request from a fork, because the job would hand the fork's code your API key. Each refresh is a paid agent call.

## Upload to aisus cloud

With `upload: true` and `cloud-url` set, each pull request gets its own page in aisus cloud, and a push to the default branch merges the landed branch's map. The Action signs in with GitHub's OIDC token, so the job needs `permissions: id-token: write` and no stored secret. Without `upload`, nothing leaves the runner.
