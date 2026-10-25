---
status: accepted
date: 2026-10-25
decision-makers: owner
---

# Sequence maps are laid out from message order

## Context and Problem Statement

An architecture map shows what a repository is made of, but not how one request moves through it. The owner asked for sequence diagrams. Diagram tools that draw them often have the author place each message and activation in pixels and then check the result for overlaps. aisus's maps are written by an agent and must open the code they cite. What does a sequence map hold, and who decides where things go?

## Considered Options

* aisus's own format with no coordinates, citations on participants and messages, and layout from message order
* A format where the author gives each message's height and each activation's span in pixels
* Sequence mode inside the architecture format, as connections with an order

## Decision Outcome

Chosen option: "aisus's own format with no coordinates, citations on participants and messages, and layout from message order", because an agent then writes only what it read in the code, and each message opens the line that makes the call.

* The document is `{schema_version: 1, diagram_type: "sequence", meta, participants, messages, phases?}`, as SEQ-01 lists. Its schema is `packages/core/model/schemas/sequence.schema.json`, which reuses the architecture map's component types and source references.
* Participants and messages share one id namespace, so `fingerprints.json` and freshness key both by id.
* A run is `sequence-<slug>-<YYYYMMDD-HHMMSS>[-N]` beside architecture runs. Readers that know only architecture maps list only `architecture-…` runs.
* Calls to the same participant are allowed and drawn as loops.

### Consequences

* Good, because the agent cannot produce overlapping layouts, so the validator needs no geometry checks.
* Good, because staleness, citations and the secret scan work unchanged on the cited items.
* Bad, because the author cannot tune spacing. A long label widens its column.
* Bad, because audits, tours, refreshes, rules and comparisons do not cover sequence maps yet.

### Confirmation

Unit tests validate sequence drafts and lay them out. A DOM test draws one and clicks a message. An e2e test opens one from the Maps page.
