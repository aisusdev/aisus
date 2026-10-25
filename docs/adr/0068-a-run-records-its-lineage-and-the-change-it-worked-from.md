---
status: accepted
date: 2026-10-25
decision-makers: owner
---

# A run records its lineage and the change it worked from

## Context and Problem Statement

A refresh updates a map from the code change since the map was made, but it kept no record of that change or of the map it continued. The viewer could only compare two finished maps, and it guessed which boxes matched. A box whose code changed but which the agent left alone looked unchanged. Nothing stopped updates from piling up drift, or from starting at a commit a rebase had removed. Which files does a run keep, and what do they hold?

## Considered Options

* Two JSON files beside the candidate, `lineage.json` and `changes.json`, and `change.md` for the agent
* More fields in `run.json`
* No files, with the viewer computing the change from git when it opens a map

## Decision Outcome

Chosen option: "Two JSON files beside the candidate, `lineage.json` and `changes.json`, and `change.md` for the agent", because the comparison then works from what the run itself saw, after the working tree has moved on, and in a pull request where only committed files exist.

* `lineage.json` is `{schema: 1, mode: "update"|"regenerate", reason, previousRun, baseRevision, revision, baseCommit, headCommit, dirty, dirtyCount, updatesSinceRegeneration}`. Each commit is `{subject, committedAt}` or `null`. `dirty` holds at most 200 paths. `refresh-facts.mjs` writes it for an update and `repo-facts.mjs` for a full drawing.
* `changes.json` is `{schema: 1, baseRevision, revision, touched: [{id, files}], uncited: [file]}`. A file is `{status: "added"|"deleted"|"modified"|"renamed", path, oldPath?}`, with `oldPath` only for a rename. Only an update writes it.
* `change.md` is the same change as a unified diff grouped by box, for the refresh skill. Deny-listed and binary files appear by name only.
* A map is drawn again, rather than updated, for the reasons FRS-08 lists in order. `planRefresh` makes that decision for the skill, the extension and the Action.
* `run.json` stays as ADR-0045 describes it.

### Consequences

* Good, because the viewer marks kept boxes and lists uncited files without running git.
* Good, because a committed run folder carries its own history, so a teammate sees the same comparison.
* Bad, because each run folder holds three more files. `change.md` can reach 2 MiB, and a larger change draws the map again instead.

### Confirmation

Unit tests run `refresh-facts.mjs` and `repo-facts.mjs` on temporary repositories and read the files they write.
