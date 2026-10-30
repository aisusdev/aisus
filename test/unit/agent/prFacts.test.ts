// PRC-07: pr-facts.mjs reports a pull request's merge-base and changed files from the checked-out
// head, and starts a `pull` run for instructions. It refuses a checkout that is not the head.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";
import { git, gitRepo, put, runScript } from "../support/temp";

function pullRequest(): { root: string; base: string; head: string } {
  const root = gitRepo({ "src/auth.ts": "export const auth = 1;\n" });
  const base = git(root, "rev-parse", "HEAD").trim();
  git(root, "update-ref", "refs/remotes/origin/main", base);
  git(root, "checkout", "-q", "-b", "session-cache");
  put(root, "src/cache.ts", "export const cache = new Map();\n");
  put(root, "src/auth.ts", "import { cache } from './cache';\nexport const auth = cache;\n");
  git(root, "add", ".");
  git(root, "commit", "-q", "-m", "cache");
  // main moves on after the branch starts, so the merge-base is not origin/main's tip.
  git(root, "checkout", "-q", "main");
  put(root, "README.md", "shop\n");
  git(root, "add", ".");
  git(root, "commit", "-q", "-m", "readme");
  git(root, "update-ref", "refs/remotes/origin/main", git(root, "rev-parse", "HEAD").trim());
  git(root, "checkout", "-q", "session-cache");
  return { root, base, head: git(root, "rev-parse", "HEAD").trim() };
}

test("PRC-07 pr-facts reports the merge-base and the changed files, and starts a pull run for the instructions", () => {
  const { root, base, head } = pullRequest();
  const run = runScript("pr-facts", ["--pull", "42", "--base", "main", "--head", head, "--instructions", "Show how login reaches the cache"], { cwd: root });
  expect(run.stderr).toBe("");
  const facts = run.json();
  expect(facts["mergeBase"]).toBe(base);
  expect(facts["changed"]).toEqual([
    { path: "src/auth.ts", added: 2, deleted: 1 },
    { path: "src/cache.ts", added: 1, deleted: 0 },
  ]);
  expect(facts["draft"]).toMatch(/^\.aisus\/maps\/architecture-show-how-login-reaches-the-cache-\d{8}-\d{6}\/draft\.json$/);
  expect(JSON.parse(readFileSync(join(root, facts["runFolder"], "run.json"), "utf8"))).toMatchObject({ kind: "pull", focus: "Show how login reaches the cache" });
});

test("PRC-07 pr-facts without instructions creates no run, and refuses a checkout that is not the pull request's head", () => {
  const { root, head } = pullRequest();
  expect(runScript("pr-facts", ["--pull", "42", "--base", "main", "--head", head], { cwd: root }).json()["runFolder"]).toBeUndefined();
  expect(existsSync(join(root, ".aisus/maps"))).toBe(false);
  const stale = runScript("pr-facts", ["--pull", "42", "--base", "main", "--head", "f".repeat(40)], { cwd: root });
  expect(stale.status).toBe(1);
  expect(stale.stderr).toContain("is not pull request #42's head");
});

test("PRC-07 pr-publish --dry-run prints an accepted pull run as the pull request's diagram with its instructions, and refuses a run not yet accepted", () => {
  const { root, head } = pullRequest();
  git(root, "remote", "add", "origin", "https://github.com/acme/shop.git");
  const facts = runScript("pr-facts", ["--pull", "42", "--base", "main", "--head", head, "--instructions", "Show the cache"], { cwd: root }).json();
  const run = facts["runFolder"].replace(".aisus/maps/", "");
  const env = { ...process.env, AISUS_CLOUD_URL: "", AISUS_TOKEN: "" };
  expect(runScript("pr-publish", ["--pull", "42", "--base", "main", "--run", run, "--dry-run"], { cwd: root, env }).status).toBe(2);
  put(root, facts["draft"], JSON.stringify({ meta: { title: "Cache" }, components: [{ id: "cache", type: "backend", label: "Session cache", tag: "new", sources: [{ path: "src/cache.ts", line: 1 }] }] }));
  expect(runScript("validate", [facts["draft"]], { cwd: root }).status).toBe(0);
  const published = runScript("pr-publish", ["--pull", "42", "--base", "main", "--run", run, "--dry-run"], { cwd: root, env });
  expect(published.status).toBe(0);
  expect(published.json()["payload"]).toMatchObject({ repo: "acme/shop", commit: head, branch: "session-cache", kind: "diagram", meta: { pull: 42, run, instructions: "Show the cache" } });
});
