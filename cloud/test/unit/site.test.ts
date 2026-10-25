// The deployment's site additions (owner request, 2026-10-22): /install finds the newest release's
// extension, the visit counts never record a share link's token, and /api/metrics counts what the
// cloud holds for the owner's server and nothing about any one person.
import { beforeEach, describe, expect, test } from "vitest";
import { openDatabase, type Database } from "../../src/db/client";
import { accountPlans, uploads, users } from "../../src/db/schema";
import { installTarget, installUrl, releasesRepo, type Release } from "../../src/lib/install";
import { metricsAllowed, metricsText } from "../../src/lib/metrics";
import { STATS_HOOK, statsWebsite } from "../../src/lib/stats";
import { saveUpload, upsertRepository } from "../../src/lib/store";
import { COMMIT, MAP } from "../support/fixtures";

const REPO = "aisusdev/aisus";

function release(tag: string, assets: string[], draft = false): Release {
  return { html_url: `https://github.com/${REPO}/releases/tag/${tag}`, draft, assets: assets.map((name) => ({ name, browser_download_url: `https://github.com/${REPO}/releases/download/${tag}/${name}` })) };
}

describe("install", () => {
  test("/install goes to the newest published release's .vsix, and to the releases page without one", () => {
    const releases = [release("v0.4.0", ["aisus-0.4.0.vsix"], true), release("v0.3.1", ["SHA256SUMS"]), release("v0.3.0", ["aisus.mjs", "aisus-0.3.0.vsix"])];
    expect(installTarget(releases, REPO)).toBe(`https://github.com/${REPO}/releases/download/v0.3.0/aisus-0.3.0.vsix`);
    expect(installTarget([release("v0.1.0", ["notes.txt"])], REPO)).toBe(`https://github.com/${REPO}/releases`);
  });

  test("the releases come from AISUS_RELEASES_REPO, and a failing or unreachable GitHub falls back to the releases page", async () => {
    expect(releasesRepo({ AISUS_RELEASES_REPO: REPO })).toBe(REPO);
    expect(releasesRepo({ AISUS_RELEASES_REPO: "not a repository" })).toBe("aisusdev/aisus");
    const asked: string[] = [];
    const found = await installUrl({ AISUS_RELEASES_REPO: REPO, GITHUB_API_URL: "http://github.test" }, async (url) => {
      asked.push(String(url));
      return Response.json([release("v0.3.0", ["aisus-0.3.0.vsix"])]);
    }, 0);
    expect(asked).toEqual([`http://github.test/repos/${REPO}/releases?per_page=20`]);
    expect(found).toBe(`https://github.com/${REPO}/releases/download/v0.3.0/aisus-0.3.0.vsix`);
    const fallback = await installUrl({ AISUS_RELEASES_REPO: "acme/down" }, async () => new Response("", { status: 503 }), 0);
    expect(fallback).toBe("https://github.com/acme/down/releases");
    const unreachable = await installUrl({ AISUS_RELEASES_REPO: "acme/offline" }, async () => {
      throw new TypeError("fetch failed");
    }, 0);
    expect(unreachable).toBe("https://github.com/acme/offline/releases");
  });
});

describe("visit counts", () => {
  test("pages report to Umami only when UMAMI_WEBSITE_ID holds a website id", () => {
    expect(statsWebsite({})).toBeNull();
    expect(statsWebsite({ UMAMI_WEBSITE_ID: "\"><script>" })).toBeNull();
    expect(statsWebsite({ UMAMI_WEBSITE_ID: "3f2b8c1e-9d4a-4b7e-a1c2-5e6f7a8b9c0d" })).toBe("3f2b8c1e-9d4a-4b7e-a1c2-5e6f7a8b9c0d");
  });

  test("a share link's token is counted as /s/link, and other pages as they are", () => {
    const page: { aisusStats?: (type: string, payload: { url: string; referrer: string }) => { url: string; referrer: string } } = {};
    new Function("window", STATS_HOOK)(page);
    expect(page.aisusStats!("event", { url: "https://aisus.dev/s/sh_AbC123?x=1", referrer: "https://aisus.dev/s/sh_AbC123" })).toEqual({ url: "https://aisus.dev/s/link?x=1", referrer: "https://aisus.dev/s/link" });
    expect(page.aisusStats!("event", { url: "https://aisus.dev/acme/shop", referrer: "" })).toEqual({ url: "https://aisus.dev/acme/shop", referrer: "" });
  });
});

describe("metrics", () => {
  let db: Database;

  beforeEach(async () => {
    db = await openDatabase();
  });

  test("/api/metrics counts accounts, repositories, uploads and paid accounts in Prometheus's text format", async () => {
    await db.insert(users).values([{ githubId: 1, login: "dev" }, { githubId: 2, login: "ops" }]);
    const repo = await upsertRepository(db, { githubId: 9, owner: "acme", name: "shop", private: true, defaultBranch: "main" });
    await upsertRepository(db, { githubId: 10, owner: "acme", name: "open-site", private: false, defaultBranch: "main" });
    await saveUpload(db, { repoId: repo.id, kind: "map", commit: COMMIT, branch: "main", pull: null, payload: MAP, via: "token" } as typeof uploads.$inferInsert);
    await db.insert(accountPlans).values([{ account: "acme", plan: "team", seats: 3 }, { account: "dev", plan: "pro", seats: 1 }]);
    const text = await metricsText(db);
    expect(text).toContain("# TYPE aisus_accounts gauge\naisus_accounts 2\n");
    expect(text).toContain('aisus_repositories{visibility="private"} 1\naisus_repositories{visibility="public"} 1\n');
    expect(text).toContain('aisus_uploads{kind="map"} 1\naisus_uploads{kind="check"} 0\n');
    expect(text).toContain('aisus_paid_accounts{plan="pro"} 1\naisus_paid_accounts{plan="team"} 1\n');
    expect(text).toContain("aisus_paid_seats 4\n");
    expect(text).not.toMatch(/dev|ops|acme|shop/);
  });

  test("only the bearer of METRICS_TOKEN reads them, and without the setting nobody does", () => {
    expect(metricsAllowed("Bearer s3cret-token-value", { METRICS_TOKEN: "s3cret-token-value" })).toBe(true);
    expect(metricsAllowed("Bearer wrong", { METRICS_TOKEN: "s3cret-token-value" })).toBe(false);
    expect(metricsAllowed(null, { METRICS_TOKEN: "s3cret-token-value" })).toBe(false);
    expect(metricsAllowed("Bearer ", {})).toBe(false);
  });
});
