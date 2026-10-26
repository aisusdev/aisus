// FRS-05: refresh-facts.mjs reports how a map compares with the code since it was made, and
// creates the refresh's run folder with a draft copied from the map. CST-03: it prints the refresh's
// estimate.
import { readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { skillEstimates } from "@aisus/core/model/estimate";
import { repoSize, sizeFacts } from "@aisus/core/model/repoSize";
import { git, gitRepo, put, runScript } from "../support/temp";

const SOURCE = ["import x from 'x';", "", "export function handle(req) {", "  const body = parse(req);", "  return save(body);", "}", ""].join("\n");

/** A git repository with an accepted map of it, focused on "payments". Returns the base run folder name. */
function mappedRepo(): { root: string; base: string } {
  const root = gitRepo({ "src/a.ts": SOURCE, "src/b.ts": "notes\n", "lib/util.ts": "export {};\n" });
  const facts = runScript("repo-facts", ["--focus", "payments"], { cwd: root }).json();
  put(
    root,
    facts.draft,
    JSON.stringify({
      meta: { title: "Payments" },
      components: [
        { id: "api", type: "backend", label: "API", sources: [{ path: "src/a.ts", line: 3, end_line: 6 }] },
        { id: "docs", type: "external", label: "Docs", sources: [{ path: "src/b.ts" }] },
      ],
      connections: [{ id: "api-docs", from: "api", to: "docs" }],
    }),
  );
  expect(runScript("validate", [facts.draft], { cwd: root }).status).toBe(0);
  return { root, base: facts.runFolder.replace(".aisus/maps/", "") };
}

function changeTheCode(root: string): void {
  put(root, "src/a.ts", SOURCE.replace("save(body)", "store(body)"));
  put(root, "src/c.ts", "export const c = 1;\n");
  put(root, "packages/new/index.ts", "export {};\n");
}

describe("FRS-05 refresh-facts", () => {
  test("reports edited boxes, changed and uncovered files and new folders, and starts a refresh run", () => {
    const { root, base } = mappedRepo();
    changeTheCode(root);
    const run = runScript("refresh-facts", ["--from", base], { cwd: root });
    expect(run.stderr).toBe("");
    expect(run.status).toBe(0);
    const facts = run.json() as Record<string, any>;
    expect(facts["base"]).toMatchObject({ runFolder: `.aisus/maps/${base}`, revision: git(root, "rev-parse", "HEAD").trim(), fingerprints: true });
    expect(facts["boxes"]).toEqual(["api"]);
    expect(facts["stale"]).toEqual([{ component: "api", index: 0, path: "src/a.ts", state: "edited" }]);
    expect(facts["changes"]).toEqual([
      { path: "src/a.ts", added: 1, deleted: 1, covered: true },
      { path: "packages/new/index.ts", added: null, deleted: null, covered: false },
      { path: "src/c.ts", added: null, deleted: null, covered: false },
    ]);
    expect(facts["uncovered"]).toEqual(["packages/new/index.ts", "src/c.ts"]);
    expect(facts["newFolders"]).toEqual(["packages"]);

    expect(facts["runFolder"]).toMatch(/^\.aisus\/maps\/architecture-payments-\d{8}-\d{6}(-\d+)?$/);
    expect(facts["runFolder"]).not.toBe(`.aisus/maps/${base}`);
    const record = JSON.parse(readFileSync(join(root, facts["runFolder"], "run.json"), "utf8"));
    expect(record).toMatchObject({ kind: "refresh", focus: "payments", base, paths: [], phase: "created" });

    const draft = JSON.parse(readFileSync(join(root, facts["draft"]), "utf8"));
    const candidate = JSON.parse(readFileSync(join(root, ".aisus/maps", base, "candidate.json"), "utf8"));
    expect(candidate.meta).toHaveProperty("output");
    expect(draft.meta).toEqual({ title: "Payments" });
    expect(draft.components).toEqual(candidate.components);
    expect(runScript("validate", [facts["draft"]], { cwd: root }).status).toBe(0);
  });

  test("CST-03 prints each agent's estimate for a refresh", () => {
    const { root, base } = mappedRepo();
    const facts = runScript("refresh-facts", ["--from", base], { cwd: root }).json() as Record<string, any>;
    expect(facts["estimate"]).toEqual(skillEstimates(sizeFacts(repoSize(root)), "refresh"));
  });

  test("--paths limits the report to its globs and is recorded", () => {
    const { root, base } = mappedRepo();
    changeTheCode(root);
    const facts = runScript("refresh-facts", ["--from", `.aisus/maps/${base}/`, "--paths", "src/c.*", "lib"], { cwd: root }).json() as Record<string, any>;
    expect(facts["paths"]).toEqual(["src/c.*", "lib"]);
    expect(facts["boxes"]).toEqual([]);
    expect(facts["uncovered"]).toEqual(["src/c.ts"]);
    expect(facts["newFolders"]).toEqual([]);
    expect(JSON.parse(readFileSync(join(root, facts["runFolder"], "run.json"), "utf8")).paths).toEqual(["src/c.*", "lib"]);
  });

  test("FRS-08 a map whose revision is unknown must be drawn again, and gets no run folder", () => {
    const { root, base } = mappedRepo();
    put(root, `.aisus/maps/${base}/fingerprints.json`, "not json");
    rmSync(join(root, `.aisus/maps/${base}/lineage.json`), { force: true });
    const before = readdirSync(join(root, ".aisus/maps"));
    const run = runScript("refresh-facts", ["--from", base], { cwd: root });
    expect(run.status).toBe(0);
    expect(run.json()).toEqual({ mode: "regenerate", reason: "no-base-revision", focus: "payments", base: { runFolder: `.aisus/maps/${base}` } });
    expect(readdirSync(join(root, ".aisus/maps"))).toEqual(before);
  });

  test("FRS-08 an update records its lineage and the change it works from", () => {
    const { root, base } = mappedRepo();
    const head = git(root, "rev-parse", "HEAD").trim();
    changeTheCode(root);
    const facts = runScript("refresh-facts", ["--from", base], { cwd: root }).json() as Record<string, any>;
    expect([facts["mode"], facts["reason"]]).toEqual(["update", "update"]);
    expect(facts["changeFile"]).toBe(`${facts["runFolder"]}/change.md`);
    const lineage = JSON.parse(readFileSync(join(root, facts["runFolder"], "lineage.json"), "utf8"));
    expect(lineage).toMatchObject({ schema: 1, mode: "update", reason: "update", previousRun: base, baseRevision: head, revision: head, baseCommit: { subject: "init" }, headCommit: { subject: "init" }, updatesSinceRegeneration: 1 });
    expect(lineage.dirty).toEqual(expect.arrayContaining(["src/a.ts", "src/c.ts", "packages/"]));
    const changes = JSON.parse(readFileSync(join(root, facts["runFolder"], "changes.json"), "utf8"));
    expect(changes).toEqual({
      schema: 1,
      baseRevision: head,
      revision: head,
      touched: [{ id: "api", files: [{ status: "modified", path: "src/a.ts" }] }],
      uncited: [
        { status: "added", path: "packages/new/index.ts" },
        { status: "added", path: "src/c.ts" },
      ],
    });
    const change = readFileSync(join(root, facts["changeFile"]), "utf8");
    expect(change).toContain("### `api` (API)");
    expect(change).toContain("+  return store(body);");
    expect(change).toContain("- `docs` (Docs)");
  });

  test("FRS-08 the update after five in a row is a full drawing instead", () => {
    const { root, base } = mappedRepo();
    const facts = runScript("refresh-facts", ["--from", base], { cwd: root }).json() as Record<string, any>;
    const lineageFile = join(root, facts["runFolder"], "lineage.json");
    const lineage = JSON.parse(readFileSync(lineageFile, "utf8"));
    put(root, `${facts["runFolder"]}/candidate.json`, readFileSync(join(root, ".aisus/maps", base, "candidate.json"), "utf8"));
    const next = facts["runFolder"].replace(".aisus/maps/", "");
    writeFileSync(lineageFile, JSON.stringify({ ...lineage, updatesSinceRegeneration: 4 }));
    expect(runScript("refresh-facts", ["--from", next], { cwd: root }).json()).toMatchObject({ mode: "update" });
    writeFileSync(lineageFile, JSON.stringify({ ...lineage, updatesSinceRegeneration: 5 }));
    expect(runScript("refresh-facts", ["--from", next], { cwd: root }).json()).toMatchObject({ mode: "regenerate", reason: "scheduled" });
  });

  test.each([
    [[], "usage"],
    [["--from"], "usage"],
    [["--from", "x", "--paths"], "usage"],
    [["--from", "../outside"], "names a run folder"],
    [["--from", "architecture-none-20261018-120000"], "cannot read"],
  ])("%j is refused with exit 2", (args, message) => {
    const { root } = mappedRepo();
    const run = runScript("refresh-facts", args, { cwd: root });
    expect(run.status).toBe(2);
    expect(run.stderr).toContain(message);
  });
});
