---
status: accepted
date: 2026-10-26
decision-makers: owner
---

# Maps and learning sessions live in the .aisus folder

## Context and Problem Statement

Maps sat in a folder named after the open-source project their format came from, and learning sessions sat directly in `.aisus/`. The owner asked that aisus name no other project, so the map folder needs a new home. Maps are committed and sessions are not. Where does each live, and how does git tell them apart?

## Considered Options

* Maps in `.aisus/maps/<run>/` and sessions in `.aisus/sessions/<run>/`
* Maps in a second top-level folder, such as `.aisus-maps/`, with sessions left in `.aisus/`
* Maps and sessions side by side in `.aisus/<run>/`, told apart by the run's prefix

## Decision Outcome

Chosen option: "Maps in `.aisus/maps/<run>/` and sessions in `.aisus/sessions/<run>/`", because aisus then keeps one folder in a repository, and git can keep maps and drop sessions by path.

* `MAP_DIR` in `packages/core/model/runFolder.ts` is `.aisus/maps`, and `SESSIONS_DIR` in `packages/core/model/session.ts` is `.aisus/sessions`. The session lock is `.aisus/sessions/active`.
* `.git/info/exclude` gets `.aisus/sessions/`, `.aisus/maps/**/draft.json` and `.aisus/maps/**/*.html`. A plain `.aisus/` line, which earlier versions wrote, is removed, because it would hide committed maps.
* The citation deny-list holds `.aisus`, so no map cites aisus's own files. The change map and the pull request check leave `.aisus/` out.
* aisus reads no map from the earlier folder. A map made before this change is moved by hand or drawn again.
* This supersedes the folder layout in ADR 0013. The map format it describes is unchanged.

### Consequences

* Good, because removing aisus from a repository deletes one folder.
* Good, because a run folder's name keeps meaning one thing, with maps and sessions apart.
* Bad, because a repository with committed maps in the earlier folder has to move them itself.
