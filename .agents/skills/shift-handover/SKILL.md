---
name: shift-handover
description: Writes the end-of-shift handover in this shift's doc under docs/shifts/, covering what shipped, what was fixed from the previous shift, what remains open, the project's state and a prompt for the next shift. Use when a shift ends, or when asked for a handover, a handoff or a shift summary in the aisus repository.
---

# Shift handover

Write the Handover section of the current shift doc, following the template in `docs/shifts/README.md`. Every claim comes from git, CI, the shift doc or `docs/open.md`. Nothing is written from memory alone.

## 1. Find the shift

```bash
git pull --rebase
ls docs/shifts/            # the newest dated file is this shift's doc
```

- This shift's doc is the newest dated file. The previous shift's doc is the one before it.
- The shift's first commit is the one that added its doc: `git log --diff-filter=A --format=%H -- docs/shifts/<this doc>`.
- The shift's range is `<first commit>^..HEAD`. If the doc does not exist yet, create it from the template now, and take the range from the previous doc's last commit: `git log -1 --format=%H -- docs/shifts/<previous doc>`.

## 2. Gather the facts

Run these and read their output.

```bash
git log --reverse --format='%h %ad %an %s' --date=short <range>
git diff --stat <range> -- docs/open.md
git diff <range> -- docs/open.md
git status -sb; git branch -a; git stash list; git worktree list
gh run list -R aisusdev/aisus -b main -L 6
gh release list -R aisusdev/aisus -L 3
```

Also read this shift's Proposals and Log, and the previous doc's "Still open" list.

## 3. Write each part

- **Shipped.** Group the range's commits by feature, using the proposals as the groups. Name each feature by what a user can now do, give its IDs, and list its commits. Docs-only and test-only commits join the feature they serve, or go under one "Maintenance" line.
- **Fixed from the previous shift.** For each item in the previous doc's "Still open", say whether it was solved. An item that `docs/open.md` no longer holds was solved, so find its commit. List unsolved ones under Still open, not here. Add problems fixed in this shift that the previous shift did not list.
- **Still open.** Take every item in `docs/open.md` that this shift added or touched, then the items the next shift should start with. Give each its P-ID, where it stands, the file to start from and a first step. Make sure each problem the Log names as unsolved is in `docs/open.md`.
- **State.** Fill in every line from the commands above. Write "unknown" rather than guess, for example for the commit aisus.dev runs, which its health endpoint does not report.
- **Prompt for the next shift.** Name the two or three P-IDs to start with, in order, with one line each on why.

Keep the handover under a page. Follow the writing style in AGENTS.md.

## 4. Check and push

1. Confirm `docs/open.md` matches the handover: every Still open ID exists there, and no fixed ID remains.
2. Run `npm run check:docs`.
3. Commit as `docs: shift handover <start date> to <end date>` and push to `origin/main`.
4. Print the Prompt for the next shift block, so the person ending the shift can pass it on.
