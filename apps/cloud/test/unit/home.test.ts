// P-7: the signed-in home. The cloud reads the user's repositories and organization memberships from
// GitHub, and knows when each repository's main map arrived.
import { beforeEach, describe, expect, test } from "vitest";
import { openDatabase, type Database } from "../../src/db/client";
import { githubApi } from "../../src/lib/github";
import { mainMapTimes, saveUpload, upsertRepository } from "../../src/lib/store";
import { COMMIT, MAP } from "../support/fixtures";

let db: Database;

beforeEach(async () => {
  db = await openDatabase();
});

describe("P-7 GitHub reads", () => {
  test("repositories and memberships read GitHub's answers into the cloud's shapes", async () => {
    const asked: string[] = [];
    const answers: Record<string, unknown> = {
      "/user/repos": [{ id: 5, name: "web", owner: { login: "acme" }, private: false, default_branch: "trunk", permissions: { admin: false, push: true, pull: true } }],
      "/user/memberships/orgs": [
        { role: "admin", state: "active", organization: { login: "acme" } },
        { role: "member", state: "active", organization: { login: "crew" } },
      ],
    };
    const github = githubApi("https://api.github.test", async (url) => {
      const path = new URL(String(url)).pathname;
      asked.push(String(url));
      return Response.json(answers[path]);
    });
    expect(await github.repositories("gho_token")).toEqual([{ id: 5, owner: "acme", name: "web", private: false, defaultBranch: "trunk", permissions: { admin: false, push: true, pull: true } }]);
    expect(await github.memberships("gho_token")).toEqual([
      { login: "acme", admin: true },
      { login: "crew", admin: false },
    ]);
    expect(asked).toEqual(["https://api.github.test/user/repos?sort=pushed&per_page=100", "https://api.github.test/user/memberships/orgs?state=active&per_page=100"]);
  });
});

describe("P-7 map times", () => {
  test("mainMapTimes answers each repository's latest default-branch map, and nothing for a repository with only checks or branch maps", async () => {
    const shop = await upsertRepository(db, { githubId: 1, owner: "acme", name: "shop", private: false, defaultBranch: "main" });
    const lab = await upsertRepository(db, { githubId: 2, owner: "acme", name: "lab", private: false, defaultBranch: "main" });
    const at = (iso: string): Date => new Date(iso);
    await saveUpload(db, { repoId: shop.id, kind: "map", commit: COMMIT, branch: "main", payload: MAP, via: "oidc", createdAt: at("2026-10-01T10:00:00Z") });
    await saveUpload(db, { repoId: shop.id, kind: "map", commit: COMMIT, branch: "main", payload: MAP, via: "oidc", createdAt: at("2026-10-02T10:00:00Z") });
    await saveUpload(db, { repoId: shop.id, kind: "map", commit: COMMIT, branch: "feature", payload: MAP, via: "oidc", createdAt: at("2026-10-03T10:00:00Z") });
    await saveUpload(db, { repoId: lab.id, kind: "check", commit: COMMIT, branch: "main", payload: {}, via: "oidc", createdAt: at("2026-10-03T10:00:00Z") });
    await saveUpload(db, { repoId: lab.id, kind: "map", commit: COMMIT, branch: "feature", payload: MAP, via: "oidc", createdAt: at("2026-10-03T10:00:00Z") });
    expect(await mainMapTimes(db, [shop.id, lab.id])).toEqual(new Map([[shop.id, at("2026-10-02T10:00:00Z")]]));
  });
});
