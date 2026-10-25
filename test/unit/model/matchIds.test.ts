// FRS-09: a freshly drawn map's boxes take the ids of the earlier map's boxes that cite mostly the
// same files, so a comparison across a full drawing matches by id.
import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { matchIds } from "@aisus/core/model/matchIds";
import { put, runScript, tempDir } from "../support/temp";

const box = (id: string, label: string, ...paths: string[]) => ({ id, type: "backend", label, sources: paths.map((path) => ({ path })) });

const EARLIER = {
  components: [box("api", "API", "src/api.ts", "src/routes.ts"), box("db", "Database", "src/db.ts"), box("jobs", "Jobs", "src/jobs.ts", "src/queue.ts", "src/cron.ts", "src/retry.ts")],
  connections: [{ id: "api-db", from: "api", to: "db" }, { id: "api-jobs", from: "api", to: "jobs" }],
};

describe("FRS-09 id matching", () => {
  test("boxes take the id of the earlier box whose files overlap most, one to one, and arrows and boundaries follow", () => {
    const draft = {
      components: [
        box("http", "HTTP API", "src/api.ts", "src/routes.ts", "src/auth.ts"),
        box("gateway", "Gateway", "src/api.ts"),
        box("storage", "Storage", "src/db.ts"),
        box("worker", "Worker", "src/jobs.ts"),
      ],
      connections: [{ id: "c1", from: "http", to: "storage" }, { id: "c2", from: "http", to: "worker" }],
      boundaries: [{ kind: "region", label: "Server", wraps: ["http", "storage"] }],
    };
    const matched = matchIds(EARLIER, draft);
    // http overlaps api 2/3 and gateway 1/2, so http wins api. worker overlaps jobs only 1/4, under the threshold.
    expect((matched["components"] as { id: string }[]).map((component) => component.id)).toEqual(["api", "gateway", "db", "worker"]);
    expect(matched["connections"]).toEqual([
      { id: "api-db", from: "api", to: "db" },
      { id: "c2", from: "api", to: "worker" },
    ]);
    expect(matched["boundaries"]).toEqual([{ kind: "region", label: "Server", wraps: ["api", "db"] }]);
  });

  test("a new box or arrow that reuses an earlier id without matching it gets a fresh id", () => {
    const draft = {
      components: [box("db", "Cache", "src/cache.ts"), box("store", "Store", "src/db.ts")],
      connections: [{ id: "api-db", from: "db", to: "store" }],
    };
    const matched = matchIds(EARLIER, draft);
    expect((matched["components"] as { id: string }[]).map((component) => component.id)).toEqual(["db-n1", "db"]);
    expect(matched["connections"]).toEqual([{ id: "api-db-n1", from: "db-n1", to: "db" }]);
  });

  test("match-ids.mjs rewrites the draft in place and reports how many boxes kept an earlier id", () => {
    const root = tempDir();
    const run = ".archify/architecture-app-20261025-100000";
    put(root, ".archify/architecture-app-20261024-100000/candidate.json", JSON.stringify(EARLIER));
    put(root, `${run}/draft.json`, JSON.stringify({ meta: { title: "App" }, components: [box("http", "HTTP", "src/api.ts", "src/routes.ts")] }));
    const result = runScript("match-ids", [`${run}/draft.json`, "--previous", ".archify/architecture-app-20261024-100000/candidate.json"], { cwd: root });
    expect(result.stderr).toBe("");
    expect(result.json()).toEqual({ status: "matched", kept: 1, boxes: 1 });
    expect(JSON.parse(readFileSync(`${root}/${run}/draft.json`, "utf8"))).toEqual({ meta: { title: "App" }, components: [box("api", "HTTP", "src/api.ts", "src/routes.ts")] });

    put(root, `${run}/draft.json`, "[]");
    const bad = runScript("match-ids", [`${run}/draft.json`, "--previous", ".archify/architecture-app-20261024-100000/candidate.json"], { cwd: root });
    expect(bad.status).toBe(2);
    expect(bad.stderr).toContain("no components list");
  });
});
