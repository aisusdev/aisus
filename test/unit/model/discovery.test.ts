// FR-VIEW-02: newest candidate ordering over mixed folder names and modification times.
import { mkdirSync, symlinkSync, utimesSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { listCandidates, repoRootFor } from "@aisus/core/model/discovery";
import { put, tempDir } from "../support/temp";

function candidate(root: string, folder: string, mtimeSeconds: number): void {
  const file = put(root, `.aisus/maps/${folder}/candidate.json`, "{}");
  utimesSync(file, mtimeSeconds, mtimeSeconds);
}

describe("FR-VIEW-02 newest candidate", () => {
  test("run folders sort by timestamp then -N; other folders follow by mtime", () => {
    const root = tempDir();
    candidate(root, "architecture-old-20250101-000000", 5_000);
    candidate(root, "architecture-new-20261010-120000", 1_000);
    candidate(root, "architecture-new-20261010-120000-2", 1_000);
    candidate(root, "architecture-new-20261010-120000-10", 900);
    candidate(root, "architecture-mid-20260601-080000", 9_000);
    candidate(root, "hand-made", 8_000);
    candidate(root, "imported", 9_500);
    candidate(root, "architecture-no-timestamp", 7_000);
    expect(listCandidates(root).map((c) => c.runFolder)).toEqual([
      "architecture-new-20261010-120000-10",
      "architecture-new-20261010-120000-2",
      "architecture-new-20261010-120000",
      "architecture-mid-20260601-080000",
      "architecture-old-20250101-000000",
      "imported",
      "hand-made",
      "architecture-no-timestamp",
    ]);
  });

  test("folders without candidate.json, stray files and links outside the root are ignored", () => {
    const base = tempDir();
    const root = join(base, "repo");
    candidate(root, "architecture-kept-20260101-000000", 1_000);
    put(root, ".aisus/maps/architecture-failed-20270101-000000/draft.json", "{}");
    put(root, ".aisus/maps/stray.json", "{}");
    mkdirSync(join(root, ".aisus/maps/architecture-dir-20280101-000000/candidate.json"), { recursive: true });
    put(base, "outside/candidate.json", "{}");
    symlinkSync(join(base, "outside"), join(root, ".aisus/maps/architecture-linked-20990101-000000"));
    const entries = listCandidates(root);
    expect(entries.map((c) => c.runFolder)).toEqual(["architecture-kept-20260101-000000"]);
    expect(entries[0]!.file).toBe(join(root, ".aisus/maps/architecture-kept-20260101-000000/candidate.json"));
  });

  test("no .aisus/maps folder gives an empty list", () => {
    expect(listCandidates(tempDir())).toEqual([]);
  });
});

describe("FR-VIEW-01 repo root of a browsed file", () => {
  test.each([
    ["/w/repo/.aisus/maps/architecture-x-20260101-000000/candidate.json", "/w/repo"],
    ["/w/repo/.aisus/maps/hand-made/other.json", "/w/repo"],
    ["/w/other/.aisus/maps/run/candidate.json", "/w/other"],
    ["/w/repo/docs/diagram.json", "/w/folder"],
    ["/w/repo/.aisus/maps/candidate.json", "/w/folder"],
  ])("%s → %s", (file, expected) => {
    expect(repoRootFor(file, "/w/folder")).toBe(expected);
  });
});
describe("SEQ-01 sequence runs", () => {
  test("architecture readers never see sequence runs, and sequence runs are listed on their own, newest first", () => {
    const root = tempDir();
    candidate(root, "architecture-app-20261010-120000", 1_000);
    candidate(root, "sequence-login-20261011-120000", 1_000);
    candidate(root, "sequence-checkout-20261012-120000", 900);
    candidate(root, "hand-made", 800);
    expect(listCandidates(root).map((c) => c.runFolder)).toEqual(["architecture-app-20261010-120000", "hand-made"]);
    expect(listCandidates(root, "sequence").map((c) => c.runFolder)).toEqual(["sequence-checkout-20261012-120000", "sequence-login-20261011-120000"]);
    expect(listCandidates(root, "all")).toHaveLength(4);
  });
});
