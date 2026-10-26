// CLD-17: on a push to the default branch, the Action merges the landed branch's team map into the
// default branch's map, from the newest default-branch map the branch started from, and uploads it.
import { describe, expect, test } from "vitest";
import type { GitHubClient } from "../../apps/action/src/github";
import { runAction } from "../../apps/action/src/main";
import { git, gitRepo, put } from "./support/temp";

const box = (id: string, path: string) => ({ id, type: "backend", label: id, sources: [{ path, line: 1 }] });

/**
 * main at C0 maps api and store. main then adds cache at C1, and the branch, started at C0, adds
 * mail at C2. The push merges the branch at C3.
 */
function history(): { root: string; c0: string; c1: string; c2: string; c3: string } {
  const root = gitRepo({ "src/api.ts": "export const api = 1;\n", "src/store.ts": "export const store = 1;\n" });
  const c0 = git(root, "rev-parse", "HEAD").trim();
  git(root, "checkout", "-qb", "feature/mail");
  put(root, "src/mail.ts", "export const mail = 1;\n");
  git(root, "add", ".");
  git(root, "commit", "-qm", "c2");
  const c2 = git(root, "rev-parse", "HEAD").trim();
  git(root, "checkout", "-q", "main");
  put(root, "src/cache.ts", "export const cache = 1;\n");
  git(root, "add", ".");
  git(root, "commit", "-qm", "c1");
  const c1 = git(root, "rev-parse", "HEAD").trim();
  git(root, "merge", "-q", "--no-ff", "-m", "c3", "feature/mail");
  const c3 = git(root, "rev-parse", "HEAD").trim();
  return { root, c0, c1, c2, c3 };
}

const M0 = { schema_version: 1, diagram_type: "architecture", meta: { title: "Shop", output: "shop.html" }, components: [box("api", "src/api.ts"), box("store", "src/store.ts")], connections: [{ from: "api", to: "store" }] };
const M1 = { ...M0, components: [...M0.components, box("cache", "src/cache.ts")], connections: [...M0.connections, { from: "api", to: "cache" }] };
const BRANCH = { ...M0, components: [...M0.components, box("mail", "src/mail.ts")], connections: [...M0.connections, { from: "api", to: "mail" }] };

function entry(id: number, branch: string, commit: string, map: unknown) {
  return { id, space: "team", branch, commit, createdAt: `2026-10-2${id}T00:00:00Z`, sha256: "0".repeat(64), map, sidecars: null, meta: {} };
}

function client(pulls: { number: number; headRef: string }[]): GitHubClient {
  return { listComments: async () => [], createComment: async () => undefined, updateComment: async () => undefined, mergedPulls: async () => pulls };
}

/** A cloud holding M0 and M1 on main and the branch's map, which records every upload. */
function cloud(h: ReturnType<typeof history>, branchMap: unknown = BRANCH) {
  const uploads: Record<string, any>[] = [];
  const fetcher = (async (url: string | URL | Request, init?: RequestInit) => {
    const href = String(url);
    if (href.startsWith("https://actions.test/token")) return Response.json({ value: "a.b.c" });
    if (href.endsWith("/api/v1/uploads")) {
      uploads.push(JSON.parse(String(init?.body)));
      return Response.json({ status: "accepted", id: 9 }, { status: 201 });
    }
    const query = new URL(href).searchParams;
    if (query.get("id") === "1") return Response.json({ entry: entry(1, "main", h.c0, M0) });
    if (query.get("branch") === "feature/mail") {
      return Response.json({
        defaultBranch: "main",
        team: branchMap === null ? null : entry(3, "feature/mail", h.c2, branchMap),
        personal: null,
        main: entry(2, "main", h.c1, M1),
        mainHistory: [
          { id: 2, commit: h.c1, createdAt: "2026-10-22T00:00:00Z" },
          { id: 1, commit: h.c0, createdAt: "2026-10-21T00:00:00Z" },
        ],
      });
    }
    return Response.json({ message: "unexpected" }, { status: 404 });
  }) as typeof fetch;
  return { uploads, fetcher };
}

function env(): NodeJS.ProcessEnv {
  return {
    INPUT_UPLOAD: "true",
    "INPUT_CLOUD-URL": "https://cloud.test",
    GITHUB_REPOSITORY: "acme/shop",
    ACTIONS_ID_TOKEN_REQUEST_URL: "https://actions.test/token?run=1",
    ACTIONS_ID_TOKEN_REQUEST_TOKEN: "request-token",
  };
}

const push = (after: string, ref = "refs/heads/main") => ({ ref, after, repository: { default_branch: "main" } });

describe("CLD-17 merge on push", () => {
  test("the merge starts from the main map the branch started from, keeps both sides' boxes, and uploads to main with fingerprints at the pushed commit", async () => {
    const h = history();
    const { uploads, fetcher } = cloud(h);
    const log: string[] = [];
    const result = await runAction({ env: env(), root: h.root, event: push(h.c3), client: client([{ number: 12, headRef: "feature/mail" }]), log: (line) => log.push(line), fetcher });
    expect(result).toMatchObject({ exitCode: 0, result: "pass" });
    expect(uploads).toHaveLength(1);
    const sent = uploads[0]!;
    expect(sent).toMatchObject({ repo: "acme/shop", branch: "main", commit: h.c3, kind: "map", meta: { merge: { branch: "feature/mail", pull: 12, conflicts: [] } } });
    expect(sent["map"].components.map((component: { id: string }) => component.id).sort()).toEqual(["api", "cache", "mail", "store"]);
    expect(sent["map"].connections.map((arrow: { to: string }) => arrow.to).sort()).toEqual(["cache", "mail", "store"]);
    expect(sent["sidecars"].fingerprints).toMatchObject({ revision: h.c3 });
    expect(sent["sidecars"].fingerprints.citations.map((print: { path: string }) => print.path).sort()).toEqual(["src/api.ts", "src/cache.ts", "src/mail.ts", "src/store.ts"]);
    expect(log.at(-1)).toBe("Merged the map of feature/mail (#12) into main's map.");
  });

  test("nothing is uploaded for a push to another branch, a branch without a map, or a push no pull request merged", async () => {
    const h = history();
    const { uploads, fetcher } = cloud(h, null);
    const log: string[] = [];
    await runAction({ env: env(), root: h.root, event: push(h.c3, "refs/heads/feature/mail"), client: client([{ number: 12, headRef: "feature/mail" }]), log: (line) => log.push(line), fetcher });
    await runAction({ env: env(), root: h.root, event: push(h.c3), client: client([{ number: 12, headRef: "feature/mail" }]), log: (line) => log.push(line), fetcher });
    await runAction({ env: env(), root: h.root, event: push(h.c3), client: client([]), log: (line) => log.push(line), fetcher });
    expect(uploads).toEqual([]);
    expect(log).toEqual([
      "Maps merge on pushes to main only; this push is to feature/mail.",
      "No merged map uploaded: feature/mail has no map in aisus cloud.",
      `No merged map uploaded: no merged pull request made ${h.c3.slice(0, 7)}.`,
    ]);
  });
});
