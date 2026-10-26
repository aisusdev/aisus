---
status: accepted
date: 2026-10-26
decision-makers: owner
---

# Maps sync through personal and team spaces per branch

## Context and Problem Statement

aisus cloud only received maps, from the CLI and the Action. A teammate could not open a branch's map without drawing it again, and a merged branch left the default branch's map behind. The owner asked on 2026-10-26 for a personal space and a team space, team maps kept per branch, pulling from the extension, a fixed load order, and a merge when a branch lands. Free gets the personal space for three branches. How do the extension and the Action reach the cloud, how does the cloud tell the spaces apart, and where does a merge run?

## Considered Options

* The extension signs in with VS Code's GitHub session, the cloud checks that token against GitHub, and merges run in the Action
* Per-user aisus API keys, and merges run in the cloud
* Maps synced through git only, with no pulling from the cloud

## Decision Outcome

Chosen option: "The extension signs in with VS Code's GitHub session, the cloud checks that token against GitHub, and merges run in the Action", because GitHub already decides who may read and write a repository, and only a runner with the code can give a merged map fresh fingerprints.

* **Network in the extension.** With `aisus.cloud.enabled` on, the extension shares and pulls maps through `packages/cloud-client/client.ts`, the one file the no-network test allows. The setting is off by default.
* **Authentication.** A request signed with a GitHub token is checked with GitHub's `/user` and the repository's permissions (CLD-01). The cloud keeps no copy of the token. Upload tokens and Actions OIDC tokens keep working and reach the team space only.
* **Spaces.** `uploads` gains `space` (`team` or `personal`) and `user_id`. A personal upload belongs to its user, and only that user reads it. A team upload by a GitHub token needs write access.
* **Upload format.** An upload gains an optional `space`, and its metadata an optional `merge` of `{branch, pull, conflicts}`. Nothing else in the format changes.
* **Plans.** This amends ADR-0067. Free keeps personal maps for at most three branches across all repositories, and still has no team space. Pro, Team and Enterprise keep personal maps without a limit.
* **Load order.** The extension opens local unshared work first, then the branch's cloud map, then the default branch's, comparing commits to tell which is newer. Pulled maps live in `.aisus/cloud/`, which git excludes.
* **Merges** run in the Action on a push to the default branch, with three maps paired as FRS-07 pairs boxes. A conflict keeps the default branch's version and is recorded in the upload.

### Consequences

* Good, because a teammate opens a branch's map without an agent run, and the default branch's map follows merges.
* Good, because roles still come from GitHub, so aisus has no invitations or role editor to keep in step.
* Bad, because every pull asks GitHub who the token belongs to, which costs one request per pull.
* Bad, because a merge that conflicts keeps the default branch's version of the conflicting elements until someone refreshes the map.
