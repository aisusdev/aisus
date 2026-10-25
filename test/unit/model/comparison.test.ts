// FRS-10: the context of comparing the shown map with an earlier one: the warnings, whether a full
// drawing lies between them, whether the recorded change applies, and Compare with…'s tags.
import { describe, expect, test } from "vitest";
import { compareRuns, pickerTags, type RunFacts } from "@aisus/core/model/comparison";
import type { Lineage } from "@aisus/core/model/lineage";

function lineage(mode: Lineage["mode"], previousRun: string | null, revision = "c".repeat(40)): Lineage {
  return { schema: 1, mode, reason: mode === "update" ? "update" : "requested", previousRun, baseRevision: null, revision, baseCommit: null, headCommit: { subject: "Add mail", committedAt: "2026-10-24T10:00:00Z" }, dirty: [], dirtyCount: 2, updatesSinceRegeneration: 0 };
}

function run(fields: Partial<RunFacts> & { runFolder: string }): RunFacts {
  return { slug: "shop", order: 0, lineage: null, repository: { url: "https://github.com/acme/shop", revision: "a".repeat(40) }, componentIds: ["api", "db", "web"], ...fields };
}

// r3 updates r2, which is a full drawing continuing r1.
const LINEAGES: Record<string, Lineage> = { r3: lineage("update", "r2"), r2: lineage("regenerate", "r1"), r1: lineage("regenerate", null) };
const lineageOf = (name: string): Lineage | null => LINEAGES[name] ?? null;
const r3 = run({ runFolder: "r3", order: 0, lineage: LINEAGES["r3"]! });
const r2 = run({ runFolder: "r2", order: 1, lineage: LINEAGES["r2"]! });
const r1 = run({ runFolder: "r1", order: 2, lineage: LINEAGES["r1"]! });

describe("FRS-10 comparison context", () => {
  test("an update compared with the map it updated has no warnings, is exact, and its recorded change applies", () => {
    const context = compareRuns(r3, r2, lineageOf, true);
    expect(context).toEqual({
      baselineRun: "r2",
      currentRun: "r3",
      warnings: [],
      approximate: false,
      keptAvailable: true,
      keptNote: false,
      baselineCommit: { revision: "c".repeat(40), subject: "Add mail", committedAt: "2026-10-24T10:00:00Z", dirtyCount: 2 },
      currentCommit: { revision: "c".repeat(40), subject: "Add mail", committedAt: "2026-10-24T10:00:00Z", dirtyCount: 2 },
    });
    expect(compareRuns(r3, r2, lineageOf, false).keptAvailable).toBe(false);
  });

  test("a full drawing between the two maps makes the comparison approximate, and the recorded change no longer applies", () => {
    const context = compareRuns(r3, r1, lineageOf, true);
    expect([context.approximate, context.keptAvailable, context.keptNote, context.warnings]).toEqual([true, false, true, []]);
  });

  test("each doubtful comparison gets its own warning", () => {
    const other = run({ runFolder: "x", order: 1, slug: "billing", lineage: lineage("regenerate", null), repository: { url: "https://github.com/acme/other", revision: "b".repeat(40) }, componentIds: ["queue", "mail", "api"] });
    const codes = compareRuns(r3, other, lineageOf, true).warnings.map((warning) => warning.code);
    expect(codes).toEqual(["different-focus", "unrelated", "different-repository", "outside-history"]);
    expect(compareRuns(r2, r3, lineageOf, false).warnings.map((warning) => warning.code)).toEqual(["outside-history", "reversed"]);
  });

  test("a map without a lineage takes its commit from meta.repository and never counts as outside the history", () => {
    const plain = run({ runFolder: "old", order: 3 });
    const context = compareRuns(r3, plain, lineageOf, true);
    expect(context.warnings).toEqual([]);
    expect(context.baselineCommit).toEqual({ revision: "a".repeat(40), subject: null, committedAt: null, dirtyCount: 0 });
  });

  test("Compare with… tags the map an update continued, newer maps, another focus and maps outside the history", () => {
    expect(pickerTags(r3, r2, lineageOf)).toEqual(["previous"]);
    expect(pickerTags(r2, r3, lineageOf)).toEqual(["newer", "outside update history"]);
    expect(pickerTags(r3, run({ runFolder: "b", order: 4, slug: "billing" }), lineageOf)).toEqual(["different focus"]);
  });
});
