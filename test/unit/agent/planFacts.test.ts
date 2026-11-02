// PLN-01: plan-facts.mjs lists the maps a plan may start from and creates the plan's run folder.
// The validator checks a plan against its spec, which only the plan's new boxes may cite.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { baseMap } from "@aisus/core/model/branchMaps";
import { listCandidates } from "@aisus/core/model/discovery";
import { previousMap } from "@aisus/core/model/lineage";
import { git, gitRepo, put, runScript } from "../support/temp";

const SOURCE = ["export function handle(req) {", "  const body = parse(req);", "  return save(body);", "}", ""].join("\n");
const SPEC = ["# Export invoices", "", "Invoices export to PDF from the API.", "A worker renders each PDF.", ""].join("\n");

/** Accepts `doc` as the map of a new run that `args` creates, and returns its run folder name. */
function accept(root: string, script: "repo-facts" | "plan-facts", args: string[], doc: unknown | ((spec: string) => unknown), spec?: string): string {
  const run = script === "repo-facts" ? runScript(script, args, { cwd: root }) : runScript(script, args, { cwd: root });
  const facts = run.json() as Record<string, any>;
  if (spec !== undefined) put(root, facts["spec"], spec);
  put(root, facts["draft"], JSON.stringify(typeof doc === "function" ? doc(facts["spec"]) : doc));
  const report = runScript("validate", [facts["draft"]], { cwd: root });
  expect(report.stdout).toContain('"accepted"');
  return facts["runFolder"].replace(".aisus/maps/", "");
}

const API_MAP = { meta: { title: "Invoices" }, components: [{ id: "api", type: "backend", label: "Handles requests", sources: [{ path: "src/api.ts", line: 1, end_line: 4 }] }] };

function repo(): string {
  return gitRepo({ "src/api.ts": SOURCE });
}

/** A plan run with its spec written, ready for a draft. */
function planRun(root: string): { run: string; draft: string; spec: string } {
  const facts = runScript("plan-facts", ["--focus", "invoice export"], { cwd: root }).json() as Record<string, any>;
  return { run: facts["runFolder"].replace(".aisus/maps/", ""), draft: facts["draft"], spec: facts["spec"] };
}

function planDoc(spec: string, tag: string | undefined): unknown {
  return {
    meta: { title: "Invoice export" },
    components: [
      { id: "api", type: "backend", label: "Handles requests", tag: "changed", sources: [{ path: "src/api.ts", line: 1, end_line: 4 }] },
      { id: "pdf", type: "backend", label: "Renders invoice PDFs", ...(tag === undefined ? {} : { tag }), sources: [{ path: spec, line: 3, end_line: 4 }] },
    ],
    connections: [{ from: "api", to: "pdf", label: "queues export" }],
  };
}

describe("PLN-01 plan-facts", () => {
  test("--list lists accepted architecture maps and leaves out detail, pull request, sequence and plan maps", () => {
    const root = repo();
    const overview = accept(root, "repo-facts", [], API_MAP);
    const focused = accept(root, "repo-facts", ["--focus", "billing"], API_MAP);
    accept(root, "repo-facts", ["--focus", "api detail", "--parent", overview, "--box", "api"], API_MAP);
    const pull = accept(root, "repo-facts", ["--focus", "pull"], API_MAP);
    const record = join(root, ".aisus/maps", pull, "run.json");
    put(root, `.aisus/maps/${pull}/run.json`, JSON.stringify({ ...JSON.parse(readFileSync(record, "utf8")), kind: "pull" }));
    put(root, ".aisus/maps/sequence-login-20261101-120000/candidate.json", "{}");
    accept(root, "plan-facts", ["--focus", "invoice export"], (spec: string) => planDoc(spec, "new"), SPEC);

    const bases = (runScript("plan-facts", ["--list"], { cwd: root }).json() as Record<string, any>)["bases"];
    expect(bases.map((base: { runFolder: string }) => base.runFolder).sort()).toEqual([`.aisus/maps/${focused}`, `.aisus/maps/${overview}`].sort());
    expect(bases.find((base: { focus: string }) => base.focus === "billing")).toMatchObject({ title: "Invoices", boxes: 1, stale: [], gone: [] });
  });

  test("--list names the stale and gone boxes of each map", () => {
    const root = gitRepo({ "src/api.ts": SOURCE, "src/old.ts": "export const old = 1;\n" });
    accept(root, "repo-facts", [], {
      meta: { title: "App" },
      components: [
        { id: "api", type: "backend", label: "Handles requests", sources: [{ path: "src/api.ts", line: 1, end_line: 4 }] },
        { id: "old", type: "backend", label: "Old code", sources: [{ path: "src/old.ts", line: 1 }] },
      ],
    });
    put(root, "src/api.ts", SOURCE.replace("save(body)", "store(body)"));
    git(root, "rm", "-q", "src/old.ts");
    const [base] = (runScript("plan-facts", ["--list"], { cwd: root }).json() as Record<string, any>)["bases"];
    expect(base).toMatchObject({ stale: ["api"], gone: ["old"] });
  });

  test("--base starts the draft from that map's boxes and ids, and records the base", () => {
    const root = repo();
    const base = accept(root, "repo-facts", [], API_MAP);
    const run = runScript("plan-facts", ["--focus", "invoice export", "--base", base], { cwd: root });
    expect(run.stderr).toBe("");
    const facts = run.json() as Record<string, any>;
    expect(facts["runFolder"]).toMatch(/^\.aisus\/maps\/plan-invoice-export-\d{8}-\d{6}(-\d+)?$/);
    expect(facts["spec"]).toBe(`${facts["runFolder"]}/spec.md`);
    expect(facts["base"]).toMatchObject({ runFolder: `.aisus/maps/${base}`, boxes: 1 });
    expect(JSON.parse(readFileSync(join(root, facts["draft"]), "utf8"))).toMatchObject({ meta: API_MAP.meta, components: API_MAP.components });
    expect(JSON.parse(readFileSync(join(root, facts["runFolder"], "run.json"), "utf8"))).toMatchObject({ kind: "plan", focus: "invoice export", base });
  });

  test("--base refuses a run folder that holds no architecture map", () => {
    const root = repo();
    const run = runScript("plan-facts", ["--focus", "invoice export", "--base", "sequence-login-20261101-120000"], { cwd: root });
    expect(run.status).toBe(2);
    expect(run.stderr).toContain("--base names no accepted architecture map");
  });

  test("a plan with an empty focus is no main map for discovery, previousMap or baseMap", () => {
    const root = repo();
    const facts = runScript("plan-facts", ["--focus", " "], { cwd: root });
    expect(facts.status).toBe(2);
    // An empty focus is refused, so a plan folder named like the repository stands in for one.
    const run = "plan-repo-20261101-120000";
    put(root, `.aisus/maps/${run}/spec.md`, SPEC);
    put(root, `.aisus/maps/${run}/draft.json`, JSON.stringify(planDoc(`.aisus/maps/${run}/spec.md`, "new")));
    expect(runScript("validate", [`.aisus/maps/${run}/draft.json`], { cwd: root }).status).toBe(0);
    git(root, "add", ".");
    git(root, "commit", "-q", "-m", "plan");
    expect(listCandidates(root)).toEqual([]);
    expect(listCandidates(root, "plan").map((candidate) => candidate.runFolder)).toEqual([run]);
    expect(previousMap(root, "repo")).toBeNull();
    expect(baseMap(root, "HEAD")).toBeNull();
  });
});

describe("PLN-01 validating a plan", () => {
  test("rejects a plan whose spec is missing, empty or holds a secret-like string", () => {
    for (const spec of [undefined, "  \n", `${SPEC}token ghp_${"a1B2".repeat(8)}\n`]) {
      const root = repo();
      const { draft, spec: path } = planRun(root);
      if (spec !== undefined) put(root, path, spec);
      put(root, draft, JSON.stringify(planDoc(path, "new")));
      const report = runScript("validate", [draft], { cwd: root });
      expect(report.status).toBe(1);
      expect(report.json().errors.map((error) => error.message.split(":")[0])).toEqual([spec === undefined ? "SpecMissing" : spec.trim() === "" ? "SpecEmpty" : "SecretLike"]);
    }
  });

  test("accepts a new box citing its own run's spec, counts the plan and keeps the spec out of the fingerprints", () => {
    const root = repo();
    const { run, draft, spec } = planRun(root);
    put(root, spec, SPEC);
    put(root, draft, JSON.stringify(planDoc(spec, "new")));
    const report = runScript("validate", [draft], { cwd: root });
    expect(report.stderr).toBe("");
    expect(report.json()).toMatchObject({ status: "accepted", warnings: [], evidence: [], plan: { new: 1, changed: 1, removed: 0 } });
    const prints = JSON.parse(readFileSync(join(root, ".aisus/maps", run, "fingerprints.json"), "utf8"));
    expect(prints.citations.map((print: { path: string }) => print.path)).toEqual(["src/api.ts"]);
  });

  test("rejects an untagged box citing the spec, and a new box citing another run's spec", () => {
    const root = repo();
    const other = planRun(root);
    put(root, other.spec, SPEC);
    const { draft, spec } = planRun(root);
    put(root, spec, SPEC);

    put(root, draft, JSON.stringify(planDoc(spec, undefined)));
    expect(runScript("validate", [draft], { cwd: root }).json().errors).toEqual([
      { pointer: "/components/1/sources/0/path", message: expect.stringMatching(/^SpecCitation: /) },
    ]);
    put(root, draft, JSON.stringify(planDoc(other.spec, "new")));
    expect(runScript("validate", [draft], { cwd: root }).json().errors).toEqual([
      { pointer: "/components/1/sources/0/path", message: expect.stringMatching(/^DeniedCitation: /) },
    ]);
  });

  test("warns PlanWithoutChange when no box is new, changed or removed", () => {
    const root = repo();
    const { draft, spec } = planRun(root);
    put(root, spec, SPEC);
    put(root, draft, JSON.stringify(API_MAP));
    const report = runScript("validate", [draft], { cwd: root }).json();
    expect(report.status).toBe("accepted");
    expect(report.warnings).toEqual([{ pointer: "/components", message: expect.stringMatching(/^PlanWithoutChange: /) }]);
  });
});
