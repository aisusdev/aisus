---
status: accepted
date: 2026-10-24
decision-makers: owner
---

# The product is named aisus

## Context and Problem Statement

The owner renamed the product from Sustain to aisus, written in lowercase everywhere, and the website from Sustain Cloud to aisus cloud. The old name is also inside identifiers that users and repositories hold: the `.sustain/` folder, `sustain.config.json`, the skill names, command IDs and settings, environment variables and comment markers. Nothing had been released under the old name. Does the rename stop at what people read, or go through the identifiers too?

## Considered Options

* Rename the name and every identifier
* Rename only what people read, and keep the identifiers

## Decision Outcome

Chosen option: "Rename the name and every identifier", because no release carries the old identifiers, so the clean break costs only local reinstalls.

* Text: Sustain becomes aisus, Sustain Cloud becomes aisus cloud, and "a Sustain" becomes "an aisus". A code name keeps its case pattern, so `SustainConfig` becomes `AisusConfig`.
* Identifiers: `sustain.*` command IDs, settings and views become `aisus.*`; the skills are `aisus-architecture`, `aisus-refresh`, `aisus-audit`, `aisus-tour` and `aisus-bugfix`; the session folder is `.aisus/` and the config `aisus.config.json`; the CLI is `aisus.mjs`; `SUSTAIN_*` environment variables become `AISUS_*`; `--sustain-*` viewer tokens become `--aisus-*`; the pull request comment's marker is `aisus-check`; the extension's ID is `aisus.aisus`; the cloud workspace is `@aisus/cloud`.
* Links to the old repository, `xplus2g4/sustain`, point at `kerktaiheng/aisus`.
* Accepted ADRs keep their text and are read with these names. ADR-0034 keeps its file name, and its `.sustain/` folder is now `.aisus/`. The research reports in `docs/research/` keep their text too.

### Consequences

* Good, because every name, file and setting a user meets says aisus.
* Bad, because skills installed under the old names, the `.sustain/` folder and `sustain.config.json` in existing repositories, and the installed extension `sustain.sustain` are not migrated, and need reinstalling or renaming by hand.

### Confirmation

Every gate passes after the rename. Outside `docs/adr/`, `docs/research/`, the links to ADR 0034's file, the "Rename to aisus" section of `docs/progress-v0.3.md` and the motto's "Sustainable", `git grep -i sustain` finds nothing.
