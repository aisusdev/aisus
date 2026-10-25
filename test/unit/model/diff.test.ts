// FRS-07, FRS-10: what changed between two maps, element by element, with the fields that changed.
import { expect, test } from "vitest";
import { diffMaps, diffSummary } from "@aisus/core/model/diff";

const BEFORE = {
  components: [
    { id: "web", label: "Web", type: "frontend", sources: [{ path: "src/web/a.ts" }] },
    { id: "api", label: "API", type: "backend", sources: [{ path: "src/api/a.ts" }, { path: "src/api/b.ts" }] },
    { id: "cache", label: "Cache", type: "database", sources: [{ path: "src/cache/a.ts" }] },
    { id: "jobs", label: "Jobs", type: "backend", sources: [{ path: "src/jobs/a.ts" }] },
    { id: "db", label: "DB", type: "database", sources: [{ path: "src/db/a.ts" }] },
  ],
  connections: [
    { from: "web", to: "api", label: "calls" },
    { from: "api", to: "cache" },
    { from: "jobs", to: "api", label: "polls" },
  ],
  boundaries: [
    { kind: "region", label: "Edge", wraps: ["web"] },
    { kind: "region", label: "Backend", wraps: ["api", "jobs"] },
    { kind: "region", label: "Data", wraps: ["cache"] },
  ],
};

const AFTER = {
  components: [
    { id: "web", label: "Web app", type: "frontend", sources: [{ path: "src/web/a.ts" }] },
    { id: "server", label: "API", type: "backend", sources: [{ path: "src/api/a.ts" }, { path: "src/api/b.ts" }, { path: "src/api/c.ts" }] },
    { id: "jobs", label: "Jobs", type: "backend", sources: [{ path: "src/jobs/a.ts" }] },
    { id: "mail", label: "Mail", type: "external", sources: [{ path: "src/mail/a.ts" }] },
    { id: "db", label: "DB", type: "database", sources: [{ path: "src/db/a.ts" }] },
  ],
  connections: [
    { from: "web", to: "server", label: "requests" },
    { from: "jobs", to: "server", label: "polls" },
    { from: "server", to: "mail" },
  ],
  boundaries: [
    { kind: "region", label: "Edge", wraps: ["web"] },
    { kind: "region", label: "Services", wraps: ["server", "jobs"] },
    { kind: "security-group", label: "Mail", wraps: ["mail"] },
  ],
};

test("FRS-07 FRS-10 each element gets a status and the fields that changed; boxes match by id or by files, and boundaries by label or members", () => {
  const diff = diffMaps(BEFORE, AFTER, new Set(["db", "web"]));
  expect(diff.boxes).toEqual([
    { status: "changed", fields: [{ field: "label", before: "Web", after: "Web app" }] },
    // The renamed boundary still holds api, now server, and jobs, so neither changed boundary.
    { status: "changed", fields: [{ field: "id", before: "api", after: "server" }, { field: "sources" }] },
    { status: "unchanged", fields: [] },
    { status: "added", fields: [] },
    // db's code changed and the update kept it; web's changed too, but web was edited, so it is changed.
    { status: "kept", fields: [] },
  ]);
  expect(diff.arrows).toEqual([
    { status: "changed", fields: [{ field: "label", before: "calls", after: "requests" }] },
    { status: "unchanged", fields: [] },
    { status: "added", fields: [] },
  ]);
  expect(diff.boundaries).toEqual([
    { status: "unchanged", fields: [] },
    { status: "renamed", fields: [{ field: "label", before: "Backend", after: "Services" }] },
    { status: "added", fields: [] },
  ]);
  expect(diff.removed).toEqual({ boxes: [{ id: "cache", label: "Cache" }], arrows: [{ name: "API → Cache" }], boundaries: [{ label: "Data" }] });
  expect(diff.counts).toEqual({ added: 3, removed: 3, changed: 4 });
  expect(diffSummary(diff)).toBe("3 added · 3 removed · 4 changed");
});

test("FRS-07 a map compared with itself has no changes, and nothing is kept without touched boxes", () => {
  const diff = diffMaps(BEFORE, BEFORE);
  expect(new Set([...diff.boxes, ...diff.arrows, ...diff.boundaries].map((entry) => entry.status))).toEqual(new Set(["unchanged"]));
  expect(diffSummary(diff)).toBe("0 added · 0 removed · 0 changed");
});

test("FRS-10 a box moved to another boundary changes its boundary, and both boundaries change their members", () => {
  const box = (id: string) => ({ id, label: id, sources: [{ path: `src/${id}.ts` }] });
  const before = { components: [box("a"), box("b")], connections: [], boundaries: [{ kind: "region", label: "One", wraps: ["a", "b"] }, { kind: "region", label: "Two", wraps: [] }] };
  const after = { components: [box("a"), box("b")], connections: [], boundaries: [{ kind: "region", label: "One", wraps: ["a"] }, { kind: "region", label: "Two", wraps: ["b"] }] };
  const diff = diffMaps(before, after);
  expect(diff.boxes.map((entry) => entry.fields)).toEqual([[], [{ field: "boundary" }]]);
  expect(diff.boundaries).toEqual([
    { status: "changed", fields: [{ field: "members" }] },
    { status: "changed", fields: [{ field: "members" }] },
  ]);
});
