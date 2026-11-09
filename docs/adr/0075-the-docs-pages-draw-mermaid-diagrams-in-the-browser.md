---
status: accepted
date: 2026-11-09
decision-makers: dennie
---

# The docs pages draw Mermaid diagrams in the browser

## Context and Problem Statement

`docs/architecture.md` holds four Mermaid diagrams. GitHub draws them, but aisus.dev's docs pages show their source as code, because the site's renderer only knows plain Markdown. How does the site draw them?

## Considered Options

* Add `mermaid` 12.2.0 to aisus cloud and draw each diagram in the browser
* Commit an image of each diagram in `docs/media/`, with a check that finds images older than their diagrams

## Decision Outcome

Chosen option: "Add `mermaid` 12.2.0 to aisus cloud and draw each diagram in the browser", because each diagram then always matches its Markdown and nobody redraws images by hand.

* **Version.** `mermaid` is pinned to 12.2.0, released 2026-10-13. It is MIT-licensed and a dependency of `apps/cloud/` only. The extension, the viewer and the IntelliJ plugin do not ship it.
* **Loading.** The page loads `mermaid` only when it shows a diagram, from the site's own server. A docs page without a diagram loads none of it, and no page requests another host.
* **Safety.** Diagrams are drawn with Mermaid's `strict` security level, which leaves out scripts and click handlers. The diagrams come from the repository's own docs.
* **Before it draws.** Until the library has loaded, and if it fails, the page shows the diagram's source as a code block.

### Consequences

* Good, because the site's diagrams stay in step with the Markdown that GitHub shows.
* Bad, because the cloud's image carries about 2 MB more JavaScript, which a reader downloads on the pages that have a diagram.
