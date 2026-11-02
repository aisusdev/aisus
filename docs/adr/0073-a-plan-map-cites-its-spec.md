---
status: accepted
date: 2026-11-02
decision-makers: Jianxi
---

# A plan map cites its spec

## Context and Problem Statement

Jianxi asked on 2026-11-02 for an `aisus-plan` skill that draws a repository as a spec will leave it. Every box of a map must cite a file in the repository, and the deny-list keeps maps from citing anything under `.aisus/`. A box for code the spec adds has nothing in the repository to cite yet. What does such a box cite, and where does the spec live?

## Considered Options

* The skill saves the spec as `spec.md` in the plan's run folder, and a box tagged `new` may cite it
* A planned box cites only the existing code it plugs into
* A planned box may have no sources

## Decision Outcome

Chosen option: "The skill saves the spec as `spec.md` in the plan's run folder, and a box tagged `new` may cite it", because every box then opens real text, and an empty repository still gets a plan.

* **Run folder.** A plan lives in `.aisus/maps/plan-<slug>-<YYYYMMDD-HHMMSS>[-N]/`, created by `plan-facts.mjs`, with `run.json` of kind `plan` and `base` naming the map it started from. `spec.md` holds the extracted spec and is committed with the map.
* **Validation.** In a plan run, `validate.mjs` first checks that `spec.md` exists, holds text, is at most 200 KB and holds no secret-like string. The deny-list exempts that one file, and only a box tagged `new` may cite it. Its citations get no fingerprints, and the evidence review leaves out `new` boxes and the arrows that touch them.
* **Tags.** `changed` and `removed` boxes cite existing code. A plan with no tagged box is accepted with the `PlanWithoutChange` warning.
* **Viewer.** The tolerant reader marks a map as a plan when its `meta.output` lies in a `plan-` run folder. Its `new` boxes are drawn dashed and its `removed` boxes faded.

### Consequences

* Good, because the citation rule holds for every box, and clicking a planned box shows the requirement behind it.
* Good, because maps outside `plan-` folders keep the deny-list as it was.
* Bad, because the spec text is committed, so the skill must leave private conversation out of it. The secret scan catches credentials only.
* Bad, because a plan never turns stale as its new boxes get built. Comparing a plan with a later map is left to P-37.
