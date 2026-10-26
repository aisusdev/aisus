// CLD-16: the map the extension opens for a branch, and how its commit compares with HEAD.
import { describe, expect, test } from "vitest";
import { chooseMap, stalenessText, type IsAncestor } from "@aisus/core/model/loadOrder";

/** A history c1 ← c2 ← c3 on the branch, with x on another line. */
const LINE = ["c1", "c2", "c3"];
const isAncestor: IsAncestor = (ancestor, of) => LINE.includes(ancestor) && LINE.includes(of) && LINE.indexOf(ancestor) <= LINE.indexOf(of);
const cloud = (sha: string, commit: string, createdAt = "2026-10-26T00:00:00Z") => ({ sha256: sha, commit, createdAt });
const local = (sha: string, commit: string | null) => ({ file: "/r/.aisus/maps/m/candidate.json", sha256: sha, commit });

describe("CLD-16 load order", () => {
  test("a local map the cloud doesn't hold opens first, even when the branch has a cloud map at an older commit", () => {
    expect(chooseMap([local("L", "c3")], { team: cloud("T", "c2"), personal: null, main: cloud("M", "c1") }, isAncestor, "c3")).toEqual({ source: "local", local: local("L", "c3") });
  });

  test("a local map drawn outside the branch is skipped for the next local map on it, or for the branch's cloud map", () => {
    const team = { team: cloud("T", "c2"), personal: null, main: null };
    expect(chooseMap([local("X", "x"), local("L", "c3")], team, isAncestor, "c3")).toEqual({ source: "local", local: local("L", "c3") });
    expect(chooseMap([local("X", "x")], team, isAncestor, "c3")).toEqual({ source: "branch", map: cloud("T", "c2") });
  });

  test("a local map drawn at an ancestor of the branch's cloud map gives way to the cloud map", () => {
    expect(chooseMap([local("L", "c1")], { team: cloud("T", "c3"), personal: null, main: null }, isAncestor, "c3")).toEqual({ source: "branch", map: cloud("T", "c3") });
  });

  test("a local map that is the one in the cloud opens from the cloud, and one at an unknown commit stays local", () => {
    expect(chooseMap([local("T", "c3")], { team: cloud("T", "c3"), personal: null, main: null }, isAncestor, "c3").source).toBe("branch");
    expect(chooseMap([local("L", null)], { team: cloud("T", "c3"), personal: null, main: null }, isAncestor, "c3").source).toBe("local");
  });

  test("of the personal and team maps, the later commit wins, and upload time decides when neither contains the other", () => {
    expect(chooseMap([], { team: cloud("T", "c2"), personal: cloud("P", "c3"), main: null }, isAncestor, "c3")).toMatchObject({ map: { sha256: "P" } });
    expect(chooseMap([], { team: cloud("T", "c3"), personal: cloud("P", "c2"), main: null }, isAncestor, "c3")).toMatchObject({ map: { sha256: "T" } });
    const later = chooseMap([], { team: cloud("T", "x", "2026-10-26T10:00:00Z"), personal: cloud("P", "c3", "2026-10-26T09:00:00Z"), main: null }, isAncestor, "c3");
    expect(later).toMatchObject({ map: { sha256: "T" } });
  });

  test("without a branch map the default branch's map opens, and with nothing anywhere nothing does", () => {
    expect(chooseMap([], { team: null, personal: null, main: cloud("M", "c1") }, isAncestor, "c3")).toEqual({ source: "main", map: cloud("M", "c1") });
    expect(chooseMap([], { team: null, personal: null, main: null }, isAncestor, "c3")).toEqual({ source: "none" });
    expect(chooseMap([], null, isAncestor, "c3")).toEqual({ source: "none" });
  });

  test("the opening message says whether the map is at HEAD, how many commits behind, or outside the branch", () => {
    const commit = "0123456789abcdef0123456789abcdef01234567";
    expect(stalenessText(commit, { kind: "head" })).toBe("drawn at this commit (0123456)");
    expect(stalenessText(commit, { kind: "behind", commits: 1 })).toBe("drawn 1 commit ago at 0123456");
    expect(stalenessText(commit, { kind: "behind", commits: 4 })).toBe("drawn 4 commits ago at 0123456");
    expect(stalenessText(commit, { kind: "elsewhere" })).toBe("drawn at 0123456, which isn't in this branch");
  });
});
