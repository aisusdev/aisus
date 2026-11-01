---
status: accepted
date: 2026-11-01
decision-makers: Jianxi
---

# A drill-down records the box it details

## Context and Problem Statement

A drill-down map recorded only the run folder of the map it came from (ADR 0045). The overview could not tell which of its boxes had a detail map, and drawing the same box again started with fresh box ids. Jianxi asked on 2026-11-01 for nested maps that follow the map's own boxes. What does a drill-down record, and how does a box find its detail map?

## Considered Options

* `run.json` records the box id as `parentBox`, and a box's detail map is found by the parent map's focus slug and the box id
* `run.json` records the box id, and a box's detail map is found by the parent's run folder and the box id
* The map format gains a link from each box to its detail map

## Decision Outcome

Chosen option: "`run.json` records the box id as `parentBox`, and a box's detail map is found by the parent map's focus slug and the box id", because `match-ids.mjs` keeps box ids when an overview is drawn again, so a regenerated overview keeps its detail maps.

* **Format.** `run.json` gains an optional `parentBox`, the id of the parent map's box. `repo-facts.mjs --parent <run> --box <id>` writes it, and refuses a box the parent map lacks. A `run.json` without it is read as before.
* **Lookup.** `detailMaps(root, run)` in `lineage.ts` gives each box its newest accepted drill-down with that `parentBox` whose parent map has `run`'s focus slug. Drawing a box again prints that map as `previous`, so `match-ids.mjs` keeps its ids.
* **Viewer.** The host sends the maps above the shown map and its boxes' detail maps in `overview`. A box with a detail map carries a Detail mark, and a drill-down shows its trail in place of Back to overview.

### Consequences

* Good, because nesting needs no change to the map format, whose schemas P-5 rewrites.
* Good, because the trail follows `parent` links to any depth.
* Bad, because a regenerated overview that gives a box a new id loses that box's detail map until the box is drawn again.
* Bad, because the cloud and the IntelliJ plugin read no `run.json`, so they show no mark and no trail.
