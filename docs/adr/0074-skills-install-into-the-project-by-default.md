---
status: accepted
date: 2026-11-02
decision-makers: Jianxi
---

# Skills install into the project by default

## Context and Problem Statement

[ADR 0044](0044-skills-install-per-user-by-default.md) installed the skills in the user's home folder by default, with `aisus.skillScope: "project"` for the repository. Jianxi asked on 2026-11-02 for the project to be the default. Where do the skills install when nothing is set?

## Considered Options

* Install into the project by default, with `aisus.skillScope: "user"` for the home folder
* Keep installing into the home folder by default

## Decision Outcome

Chosen option: "Install into the project by default, with `aisus.skillScope: "user"` for the home folder", because a repository then carries the exact skills its maps were drawn with, and a teammate who opens it gets them without an install.

* **Hosts.** The VS Code setting, the CLI's `install` and `verify-skills` and the IntelliJ plugin's Setup all default to `project`. `user` keeps ADR 0044's layout.
* **Layout.** Inside the base folder nothing changes: real files in `.agents/skills/<name>/` and a relative `.claude/skills/<name>` link (ADR 0006).
* **Sizes.** The repository's size and the import list leave out `aisus-*` folders under an agent's `skills/` folder, so installed skills do not raise estimates or reach the evidence review.

### Consequences

* Good, because the skills travel with the repository and match its maps.
* Good, because a repository's copy and aisus's copy are the same folder, so Claude Code's precedence of personal skills no longer matters by default.
* Bad, because installing aisus now adds files to the repository, which the user commits or ignores.
* Bad, because each repository holds its own copy, which needs reinstalling after an upgrade.
