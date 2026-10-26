// FR-RF-01 (and FR-GIT-01 through the CLI) against the built repo-facts.mjs.
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { describe, expect, test } from "vitest";
import { skillEstimates } from "@aisus/core/model/estimate";
import { sizeFacts } from "@aisus/core/model/repoSize";
import { runTimestamp } from "@aisus/core/model/runFolder";
import { envWithoutGit, git, gitRepo, put, runScript, tempDir } from "../support/temp";

const RUN_NAME = /^architecture-([a-z0-9-]+)-(\d{8}-\d{6})(-\d+)?$/;

describe("FR-RF-01 repo-facts CLI", () => {
  test("CST-04 CST-01 CST-03 CST-05 FRS-09 creates the run folder with run.json and lineage.json and prints root, runFolder, draft, previous, git, size, estimate and budget", () => {
    const root = tempDir();
    const run = runScript("repo-facts", ["--focus", "Payment service: retries & queues"], { cwd: root, env: envWithoutGit() });
    expect(run.status).toBe(0);
    expect(run.stderr).toBe("");
    const facts = run.json();
    expect(Object.keys(facts)).toEqual(["root", "runFolder", "draft", "previous", "git", "size", "estimate", "budget"]);
    expect(facts.root).toBe(root);
    const name = facts.runFolder.replace(/^\.aisus\/maps\//, "");
    expect(name).toMatch(RUN_NAME);
    expect(RUN_NAME.exec(name)![1]).toBe("payment-service-retries-queues");
    expect(facts.draft).toBe(`${facts.runFolder}/draft.json`);
    expect(readdirSync(join(root, facts.runFolder)).sort()).toEqual(["lineage.json", "run.json"]);
    expect(JSON.parse(readFileSync(join(root, facts.runFolder, "run.json"), "utf8"))).toMatchObject({
      schema: 1,
      kind: "full",
      focus: "Payment service: retries & queues",
      paths: [],
      base: null,
      parent: null,
      phase: "created",
      attempts: 0,
    });
    expect(facts.git).toBeNull();
  });

  test("CST-01 prints the repository's size, leaving the new run folder out", () => {
    const root = gitRepo({ "src/app.ts": "a\nb\nc\n", "src/app.test.ts": "t\n" });
    const facts = runScript("repo-facts", [], { cwd: root }).json();
    expect(facts.size).toMatchObject({ listing: "git", files: 2, lines: { total: 4, test: 1, nonTest: 3 }, tier: "S" });
  });

  test("CST-03 prints each agent's estimate for a full run, as the sidebar states it", () => {
    const facts = runScript("repo-facts", [], { cwd: gitRepo({ "src/app.ts": "a\n".repeat(30) }) }).json();
    expect(facts.estimate).toEqual(skillEstimates(sizeFacts(facts.size), "full"));
    expect(facts.estimate.claude.text).toMatch(/^About \d+k–\d+k tokens \(\$\d+\.\d\d–\$\d+\.\d\d at API prices\)$/);
  });

  test("CST-05 prints the tier's read budget", () => {
    const small = runScript("repo-facts", [], { cwd: gitRepo({ "src/app.ts": "a\n" }) }).json();
    expect([small.size.tier, small.budget]).toEqual(["S", 25]);
    const medium = runScript("repo-facts", [], { cwd: gitRepo({ "src/app.ts": "a\n".repeat(20_000) }) }).json();
    expect([medium.size.tier, medium.budget]).toEqual(["M", 45]);
  });

  test("without --focus the slug comes from the repo folder name", () => {
    const root = join(tempDir(), "My Repo!");
    put(root, "README.md", "x\n");
    const facts = runScript("repo-facts", [], { cwd: root, env: envWithoutGit() }).json();
    expect(RUN_NAME.exec(facts.runFolder.slice(".aisus/maps/".length))![1]).toBe("my-repo");
    expect(basename(facts.root)).toBe("My Repo!");
  });

  test("an empty --focus falls back to the folder name", () => {
    const root = join(tempDir(), "backend_api");
    put(root, "README.md", "x\n");
    const facts = runScript("repo-facts", ["--focus", ""], { cwd: root, env: envWithoutGit() }).json();
    expect(RUN_NAME.exec(facts.runFolder.slice(".aisus/maps/".length))![1]).toBe("backend-api");
  });

  test("a name collision appends -2", () => {
    const root = tempDir();
    // Occupy the base name for every second the run could start in, so it must collide.
    const now = Date.now();
    const taken = [0, 1, 2, 3, 4, 5].map((s) => `architecture-api-${runTimestamp(new Date(now + s * 1000))}`);
    for (const name of taken) mkdirSync(join(root, ".aisus/maps", name), { recursive: true });
    const name = runScript("repo-facts", ["--focus", "api"], { cwd: root }).json().runFolder.slice(".aisus/maps/".length);
    expect(taken.map((base) => `${base}-2`)).toContain(name);
    expect(existsSync(join(root, ".aisus/maps", name))).toBe(true);
  });

  test("CST-04 git facts come from the repo root and exclude the new run folder", () => {
    const root = gitRepo({ "a.txt": "a\n" });
    git(root, "remote", "add", "origin", "https://user:pw@github.com/acme/widget.git");
    writeFileSync(join(root, "a.txt"), "changed\n");
    const facts = runScript("repo-facts", [], { cwd: root }).json();
    expect(facts.git).toEqual({
      head: git(root, "rev-parse", "HEAD").trim(),
      origin: "https://github.com/acme/widget.git",
      dirtyCount: 1,
      dirty: ["a.txt"],
    });
  });

  test("git absent from PATH gives git: null and still succeeds", () => {
    const root = gitRepo({ "a.txt": "a\n" });
    const run = runScript("repo-facts", [], { cwd: root, env: envWithoutGit() });
    expect(run.status).toBe(0);
    expect(run.json().git).toBeNull();
  });

  test.each([[["--focus"]], [["--bogus"]], [["--focus", "a", "b"]]])("bad arguments %j exit 2 with no stdout", (args) => {
    const run = runScript("repo-facts", args, { cwd: tempDir() });
    expect(run.status).toBe(2);
    expect(run.stdout).toBe("");
    expect(run.stderr).toMatch(/usage/);
  });

  test("an unusable .aisus/maps exits 2", () => {
    const root = tempDir();
    mkdirSync(join(root, ".aisus"));
    writeFileSync(join(root, ".aisus/maps"), "not a folder");
    const run = runScript("repo-facts", [], { cwd: root });
    expect(run.status).toBe(2);
    expect(run.stdout).toBe("");
  });
});

describe("FRS-09 the earlier map of the same focus", () => {
  /** An accepted map with `focus`, drawn by repo-facts and validate like a run. */
  function accepted(root: string, focus: string): string {
    const facts = runScript("repo-facts", ["--focus", focus], { cwd: root }).json();
    put(root, facts.draft, JSON.stringify({ meta: { title: "App" }, components: [{ id: "api", type: "backend", label: "API", sources: [{ path: "src/app.ts" }] }] }));
    expect(runScript("validate", [facts.draft], { cwd: root }).status).toBe(0);
    return facts.runFolder.replace(".aisus/maps/", "");
  }

  test("a run records the newest accepted map with its focus as the run it continues, and prints its candidate", () => {
    const root = gitRepo({ "src/app.ts": "export {};\n" });
    const first = runScript("repo-facts", ["--focus", "payments"], { cwd: root }).json();
    expect(first.previous).toBeNull();
    expect(JSON.parse(readFileSync(join(root, first.runFolder, "lineage.json"), "utf8"))).toMatchObject({ mode: "regenerate", reason: "no-previous", previousRun: null, revision: git(root, "rev-parse", "HEAD").trim(), updatesSinceRegeneration: 0 });

    const older = accepted(root, "payments");
    const newer = accepted(root, "payments");
    accepted(root, "billing");
    const draftOnly = runScript("repo-facts", ["--focus", "payments"], { cwd: root }).json();
    expect(draftOnly.runFolder > `.aisus/maps/${newer}`).toBe(true);
    expect(older < newer).toBe(true);

    const facts = runScript("repo-facts", ["--focus", "payments"], { cwd: root }).json();
    expect(facts.previous).toBe(`.aisus/maps/${newer}/candidate.json`);
    expect(JSON.parse(readFileSync(join(root, facts.runFolder, "lineage.json"), "utf8"))).toMatchObject({ mode: "regenerate", reason: "requested", previousRun: newer });
  });

  test("a map due a full drawing names its reason, and a drill-down continues no map", () => {
    const root = gitRepo({ "src/app.ts": "export {};\n" });
    const map = accepted(root, "payments");
    const lineageFile = join(root, ".aisus/maps", map, "lineage.json");
    writeFileSync(lineageFile, JSON.stringify({ ...JSON.parse(readFileSync(lineageFile, "utf8")), updatesSinceRegeneration: 5 }));
    const facts = runScript("repo-facts", ["--focus", "payments"], { cwd: root }).json();
    expect(JSON.parse(readFileSync(join(root, facts.runFolder, "lineage.json"), "utf8"))).toMatchObject({ reason: "scheduled", previousRun: map });
    const drill = runScript("repo-facts", ["--focus", "payments", "--parent", map], { cwd: root }).json();
    expect(drill.previous).toBeNull();
  });
});

describe("SEQ-02 sequence runs", () => {
  test("--kind sequence names the folder sequence-<slug>-<timestamp> and writes run.json without lineage", () => {
    const root = tempDir();
    const run = runScript("repo-facts", ["--kind", "sequence", "--focus", "Log in with GitHub"], { cwd: root, env: envWithoutGit() });
    expect(run.status).toBe(0);
    const facts = run.json();
    expect(facts.runFolder).toMatch(/^\.aisus\/maps\/sequence-log-in-with-github-\d{8}-\d{6}$/);
    expect(facts.previous).toBeNull();
    expect(readdirSync(join(root, facts.runFolder))).toEqual(["run.json"]);
  });

  test("--kind sequence without a focus, or with a parent, is a usage error that makes no run folder", () => {
    const root = tempDir();
    for (const args of [["--kind", "sequence"], ["--kind", "sequence", "--focus", "  "], ["--kind", "sequence", "--focus", "login", "--parent", "architecture-x-20261010-101010"]]) {
      const run = runScript("repo-facts", args, { cwd: root, env: envWithoutGit() });
      expect(run.status).toBe(2);
      expect(run.stderr).toMatch(/needs --focus/);
    }
    expect(existsSync(join(root, ".aisus/maps"))).toBe(false);
  });
});
