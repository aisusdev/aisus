// FRS-08: whether a map can be updated or must be drawn again, and the change an update works
// from, grouped by box.
import { describe, expect, test } from "vitest";
import { collectChanges, groupByBox, renderChange, runChanges } from "@aisus/core/model/changeMap";
import { redrawReason, type Lineage, type ModeFacts } from "@aisus/core/model/lineage";

function lineage(fields: Partial<Lineage>): Lineage {
  return { schema: 1, mode: "update", reason: "update", previousRun: null, baseRevision: null, revision: "b".repeat(40), baseCommit: null, headCommit: null, dirty: [], dirtyCount: 0, updatesSinceRegeneration: 1, ...fields };
}

const ok: ModeFacts = { hasGit: true, previous: lineage({}), base: "b".repeat(40), reachable: () => true };

describe("FRS-08 redraw decision", () => {
  test("an updatable map has no reason to be drawn again", () => {
    expect(redrawReason(ok)).toBeNull();
    expect(redrawReason({ ...ok, previous: null })).toBeNull();
    expect(redrawReason({ ...ok, previous: lineage({ dirtyCount: 200, updatesSinceRegeneration: 4 }) })).toBeNull();
  });

  test("each reason applies on its own, and the earlier reason wins when several do", () => {
    expect(redrawReason({ ...ok, hasGit: false, base: null })).toBe("no-git");
    expect(redrawReason({ ...ok, base: null, previous: lineage({ dirtyCount: 201 }) })).toBe("no-base-revision");
    expect(redrawReason({ ...ok, previous: lineage({ dirtyCount: 201, updatesSinceRegeneration: 5 }), reachable: () => false })).toBe("dirty-baseline");
    expect(redrawReason({ ...ok, previous: lineage({ updatesSinceRegeneration: 5 }), reachable: () => false })).toBe("base-unreachable");
    expect(redrawReason({ ...ok, previous: lineage({ updatesSinceRegeneration: 5 }) })).toBe("scheduled");
  });
});

const DIFF = [
  "diff --git a/src/api.ts b/src/api.ts",
  "--- a/src/api.ts",
  "+++ b/src/api.ts",
  "@@ -1,3 +1,3 @@",
  " a",
  "-b",
  "+c",
  "diff --git a/src/old.ts b/src/new.ts",
  "similarity index 90%",
  "rename from src/old.ts",
  "rename to src/new.ts",
  "--- a/src/old.ts",
  "+++ b/src/new.ts",
  "@@ -1 +1 @@",
  "-x",
  "+y",
  "diff --git a/config/.env b/config/.env",
  "--- a/config/.env",
  "+++ b/config/.env",
  "@@ -1 +1 @@",
  "-SECRET=1",
  "+SECRET=2",
  "diff --git a/logo.png b/logo.png",
  "Binary files a/logo.png and b/logo.png differ",
  "diff --git a/.aisus/maps/run/candidate.json b/.aisus/maps/run/candidate.json",
  "--- a/.aisus/maps/run/candidate.json",
  "+++ b/.aisus/maps/run/candidate.json",
  "@@ -1 +1 @@",
  "-{}",
  "+[]",
  "",
].join("\n");

const BOXES = [
  { id: "api", label: "API", sources: [{ path: "src/api.ts" }] },
  { id: "store", label: "Store", sources: [{ path: "src/new.ts" }] },
  { id: "jobs", label: "Jobs", sources: [{ path: "src/old.ts" }] },
  { id: "web", label: "Web", sources: [{ path: "web/app.ts" }, { path: "web/gen/a.ts" }] },
  { id: "docs", label: "Docs", sources: [{ path: "README.md" }] },
];

function changes(previousDirty: string[] = []): ReturnType<typeof collectChanges> {
  return collectChanges({
    diff: DIFF,
    untracked: ["src/fresh.ts", "web/app.ts", ".aisus/maps/other/draft.json", "secrets/id_rsa"],
    previousDirty,
    cited: new Set(BOXES.flatMap((box) => box.sources.map((source) => source.path))),
    exists: (path) => path !== "web/gen/a.ts",
    readUntracked: (path) => (path === "src/fresh.ts" ? "export const fresh = 1;\n" : null),
  });
}

describe("FRS-08 change map", () => {
  test("lists the diff's files and untracked files with their status, without .aisus/maps/", () => {
    expect(changes().map((file) => file.entry)).toEqual([
      { status: "modified", path: "src/api.ts" },
      { status: "renamed", path: "src/new.ts", oldPath: "src/old.ts" },
      { status: "modified", path: "config/.env" },
      { status: "modified", path: "logo.png" },
      { status: "added", path: "src/fresh.ts" },
      { status: "added", path: "web/app.ts" },
      { status: "added", path: "secrets/id_rsa" },
    ]);
  });

  test("shows deny-listed, binary and unreadable files by name only, and readable untracked files in full", () => {
    const text = Object.fromEntries(changes().map((file) => [file.entry.path, file.text]));
    expect(text["config/.env"]).not.toContain("SECRET");
    expect(text["config/.env"]).toContain("deny list");
    expect(text["logo.png"]).toContain("binary");
    expect(text["secrets/id_rsa"]).toContain("content not shown");
    expect(text["web/app.ts"]).toContain("content not shown");
    expect(text["src/fresh.ts"]).toContain("+export const fresh = 1;");
    expect(text["src/api.ts"]).toContain("+c");
  });

  test("counts files uncommitted at the base map as modified, or deleted when gone, and a folder through its cited files", () => {
    const entries = changes(["README.md", "web/gen/", "src/api.ts", ".aisus/maps/x/run.json"]).map((file) => file.entry);
    expect(entries.slice(7)).toEqual([
      { status: "modified", path: "README.md" },
      { status: "deleted", path: "web/gen/a.ts" },
    ]);
  });

  test("a rename touches the boxes citing either path, and files no box cites are uncited", () => {
    const map = groupByBox(BOXES, changes());
    expect(map.touched.map((box) => [box.id, box.files.map((file) => file.entry.path)])).toEqual([
      ["api", ["src/api.ts"]],
      ["store", ["src/new.ts"]],
      ["jobs", ["src/new.ts"]],
      ["web", ["web/app.ts"]],
    ]);
    expect(map.untouched).toEqual([{ id: "docs", label: "Docs" }]);
    expect(map.uncited.map((entry) => entry.path)).toEqual(["config/.env", "logo.png", "src/fresh.ts", "secrets/id_rsa"]);
  });

  test("change.md and changes.json hold the same boxes and uncited files", () => {
    const map = groupByBox(BOXES, changes());
    const markdown = renderChange("a".repeat(40), "b".repeat(40), map);
    expect(markdown).toContain("### `api` (API)");
    expect(markdown).toContain("- `docs` (Docs)");
    expect(markdown).toContain("modified config/.env");
    expect(runChanges(map, "a".repeat(40), "b".repeat(40))).toEqual({
      schema: 1,
      baseRevision: "a".repeat(40),
      revision: "b".repeat(40),
      touched: [
        { id: "api", files: [{ status: "modified", path: "src/api.ts" }] },
        { id: "store", files: [{ status: "renamed", path: "src/new.ts", oldPath: "src/old.ts" }] },
        { id: "jobs", files: [{ status: "renamed", path: "src/new.ts", oldPath: "src/old.ts" }] },
        { id: "web", files: [{ status: "added", path: "web/app.ts" }] },
      ],
      uncited: map.uncited,
    });
  });
});
