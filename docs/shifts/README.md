# Shift docs

Each shift keeps one doc here, named `<start date>-<handle>.md`, such as `2026-10-28-dennie.md`. The newest file is the current state of the project. [AGENTS.md](../../AGENTS.md) says when to write each part.

- Create your doc as the first commit of your shift, from the template below. The handover skill finds your shift's commits from that commit onwards.
- Fill in Proposals and Log while you work.
- Fill in the Handover at the end with the `shift-handover` skill (`.agents/skills/shift-handover/SKILL.md`), then push.
- Never edit another shift's doc, except to fix a broken link.

## Template

````markdown
# Shift <start date> to <end date>, <handle>

Previous shift: [<file>](<file>).

## Proposals

### <feature or area> (<date>)

<One or two sentences on what was asked and why.>

| File or unit | Change | Estimate | Built |
|---|---|---|---|
| `path` | What changes | +40 / -12 | |

Tests:
- `[unit]` <behaviour the test checks>

Where the build differs: <filled in when the feature closes>

## Log

- <date> — <decision, departure, problem found or machine note, with the gates' results when a feature lands>

## Handover

### Shipped

- **<feature>** (<IDs>). <What a user can now do.> Commits: <sha>, <sha>.

### Fixed from the previous shift

- **P-<n> <title>.** <What was wrong and what fixed it.> Commit: <sha>.

### Still open

The next shift may pick any of these. Full list: [open.md](../open.md).

- **P-<n> <title>.** <Where it stands, the code to look at, and a first step.>

### State

- `main` at <sha>, pushed: <yes or no>. CI on that commit: <green, or the failing jobs>.
- aisus.dev runs <sha or "unknown">. Latest release: <tag>.
- Other branches, worktrees and stashes: <list, or none>.
- Machine notes: <anything the next person's machine may hit>.

### Prompt for the next shift

```text
You are starting a shift on aisus (github.com/aisusdev/aisus, branch main).
Read AGENTS.md, docs/shifts/<this file> and docs/open.md.
Then start your own shift doc and work on: <P-ids in order, with one line each>.
```
````
