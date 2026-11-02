// `node <skill>/scripts/plan-facts.mjs --list`, or `--focus <text> [--base <run>]`, run with cwd =
// repo root (PLN-01). `--list` prints the maps a plan may start from: accepted architecture maps
// that are no detail or pull request map, newest first, with their stale and gone boxes. Otherwise
// it creates the plan's run folder with its run.json, and with `--base` a draft that starts from
// that map. It prints where the draft and the spec go, the earlier plan with the same focus as
// `previous` for match-ids.mjs, and the estimate and read budget (CST-03, CST-05).
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { assertWritable } from "../model/confine";
import { listCandidates } from "../model/discovery";
import { skillEstimates } from "../model/estimate";
import { collectGitFacts, renamesSince } from "../model/git";
import { specPath } from "../model/plan";
import { READ_BUDGET, repoSize, sizeFacts } from "../model/repoSize";
import { MAP_DIR, CANDIDATE_FILE, createRunFolder, DRAFT_FILE, mapKindOf, parseRunName, PLAN_PREFIX, runTimestamp, slugify } from "../model/runFolder";
import { newRunRecord, readRunRecord, writeRunRecord } from "../model/runRecord";
import { fileReader, mapFreshness, readFingerprints } from "../model/staleness";
import { stripAppOwned } from "../model/submission";
import { isJsonObject } from "../model/types";

/** The skill version, filled in by the build. */
const SKILL_VERSION = process.env.AISUS_VERSION ?? "unknown";

const USAGE = "usage: node plan-facts.mjs --list | --focus <text> [--base <run>]";

function fail(message: string): number {
  process.stderr.write(`plan-facts.mjs: ${message}\n`);
  return 2;
}

interface BaseFacts {
  runFolder: string;
  title: string | null;
  focus: string;
  createdAt: string | null;
  boxes: number;
  /** Boxes whose cited lines were edited since the map was drawn. */
  stale: string[];
  /** Boxes whose cited files are gone. */
  gone: string[];
}

/** The map in run folder `run` as a base, or `null` when it has no readable candidate. */
function baseFacts(root: string, run: string): BaseFacts | null {
  const runDir = join(root, MAP_DIR, run);
  let doc: unknown;
  try {
    doc = JSON.parse(readFileSync(join(runDir, CANDIDATE_FILE), "utf8"));
  } catch {
    return null;
  }
  if (!isJsonObject(doc) || !Array.isArray(doc["components"])) return null;
  const meta = isJsonObject(doc["meta"]) ? doc["meta"] : {};
  const prints = readFingerprints(runDir);
  const renames = prints?.revision ? renamesSince(root, prints.revision) : new Map<string, string>();
  const boxes = Object.entries(mapFreshness(prints, fileReader(root), renames).boxes);
  const record = readRunRecord(runDir);
  return {
    runFolder: `${MAP_DIR}/${run}`,
    title: typeof meta["title"] === "string" ? meta["title"] : null,
    focus: record?.focus ?? "",
    createdAt: record?.createdAt ?? null,
    boxes: doc["components"].length,
    stale: boxes.filter(([, state]) => state === "edited").map(([id]) => id),
    gone: boxes.filter(([, state]) => state === "missing").map(([id]) => id),
  };
}

/** Whether run folder `run` holds a map a plan may start from. */
function canBase(root: string, run: string, listed: boolean): boolean {
  if (mapKindOf(run) !== "architecture" || !existsSync(join(root, MAP_DIR, run, CANDIDATE_FILE))) return false;
  const kind = readRunRecord(join(root, MAP_DIR, run))?.kind;
  // A detail map is a base only when named; a pull request map never is.
  return kind !== "pull" && (!listed || kind !== "drill");
}

/** The newest accepted plan with focus slug `slug`, or `null`. */
function previousPlan(root: string, slug: string, except: string): string | null {
  let names: string[];
  try {
    names = readdirSync(join(root, MAP_DIR));
  } catch {
    return null;
  }
  const plans = names.filter((run) => {
    const parsed = parseRunName(run);
    return run !== except && parsed?.prefix === PLAN_PREFIX && parsed.slug === slug && existsSync(join(root, MAP_DIR, run, CANDIDATE_FILE));
  });
  return listCandidates(root, "plan").find((candidate) => plans.includes(candidate.runFolder))?.runFolder ?? null;
}

function main(args: string[]): number {
  const root = process.cwd();
  if (args.length === 1 && args[0] === "--list") {
    const bases = listCandidates(root)
      .filter((candidate) => canBase(root, candidate.runFolder, true))
      .flatMap((candidate) => baseFacts(root, candidate.runFolder) ?? []);
    process.stdout.write(`${JSON.stringify({ root, bases }, null, 2)}\n`);
    return 0;
  }
  let focus: string | null = null;
  let base: string | null = null;
  for (let i = 0; i < args.length; i += 2) {
    const value = args[i + 1];
    if (value === undefined || (args[i] !== "--focus" && args[i] !== "--base")) return fail(USAGE);
    if (args[i] === "--focus") focus = value;
    else base = value.replace(`${MAP_DIR}/`, "").replace(/\/+$/, "");
  }
  if (focus === null || focus.trim() === "") return fail(`a plan needs --focus naming what the spec builds. ${USAGE}`);
  let baseMap: BaseFacts | null = null;
  let baseDoc: unknown = null;
  if (base !== null) {
    baseMap = canBase(root, base, false) ? baseFacts(root, base) : null;
    if (baseMap === null) return fail(`--base names no accepted architecture map in ${MAP_DIR}/: ${base}`);
    baseDoc = JSON.parse(readFileSync(join(root, MAP_DIR, base, CANDIDATE_FILE), "utf8"));
  }
  // Git facts come first, so the new run folder is not among the dirty paths.
  const git = collectGitFacts(root);
  const slug = slugify(focus, basename(root));
  let run: string;
  try {
    run = createRunFolder(root, slug, runTimestamp(new Date()), { prefix: PLAN_PREFIX });
    const runDir = join(root, MAP_DIR, run);
    writeRunRecord(root, runDir, newRunRecord({ kind: "plan", focus, base, skillVersion: SKILL_VERSION }));
    if (baseDoc !== null) {
      const draft = join(runDir, DRAFT_FILE);
      assertWritable(root, draft);
      writeFileSync(draft, `${JSON.stringify(stripAppOwned(baseDoc), null, 2)}\n`);
    }
  } catch (error) {
    return fail((error as Error).message);
  }
  const previous = previousPlan(root, slug, run);
  const size = repoSize(root);
  const facts = {
    root,
    runFolder: `${MAP_DIR}/${run}`,
    draft: `${MAP_DIR}/${run}/${DRAFT_FILE}`,
    spec: specPath(run),
    base: baseMap,
    previous: previous === null ? null : `${MAP_DIR}/${previous}/${CANDIDATE_FILE}`,
    git: git && { head: git.head, origin: git.origin, dirtyCount: git.dirtyCount, dirty: git.dirty },
    size,
    estimate: skillEstimates(sizeFacts(size), baseMap === null ? "full" : "refresh"),
    budget: READ_BUDGET[size.tier],
  };
  process.stdout.write(`${JSON.stringify(facts, null, 2)}\n`);
  return 0;
}

// Set the code instead of calling process.exit(): stdout to a pipe is asynchronous on macOS.
process.exitCode = main(process.argv.slice(2));
