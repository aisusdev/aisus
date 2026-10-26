// `node <skill>/scripts/repo-facts.mjs [--focus <text>] [--parent <run>]`, run with cwd = repo root
// (FR-RF-01): creates the run folder with its run.json (CST-04) and prints where the draft goes
// (ADR 0018), with the repository's size (CST-01), the estimate for each agent (CST-03) and the read
// budget for its tier (CST-05). With `--parent`, the run is a drill-down of that map (VWR-05).
// FRS-09: otherwise it records the newest earlier map with the same focus in `lineage.json`, and
// prints its candidate as `previous` for match-ids.mjs. SEQ-02: with `--kind sequence`, the run
// is a sequence map of the flow its focus names, which is required, and continues no earlier map.
import { existsSync } from "node:fs";
import { basename, join } from "node:path";
import { collectGitFacts, commitInfo } from "../model/git";
import { LINEAGE_FILE, planRefresh, previousMap, writeRunFile, type Lineage } from "../model/lineage";
import { skillEstimates } from "../model/estimate";
import { READ_BUDGET, repoSize, sizeFacts } from "../model/repoSize";
import { MAP_DIR, CANDIDATE_FILE, createRunFolder, DRAFT_FILE, parseRunFolderName, runTimestamp, SEQUENCE_PREFIX, slugify } from "../model/runFolder";
import { newRunRecord, writeRunRecord } from "../model/runRecord";

/** The skill version, filled in by the build. */
const SKILL_VERSION = process.env.AISUS_VERSION ?? "unknown";

const USAGE = "repo-facts.mjs: usage: node repo-facts.mjs [--focus <text>] [--parent <run>] [--kind sequence]\n";

function main(args: string[]): number {
  let focus = "";
  let parent: string | null = null;
  let sequence = false;
  for (let i = 0; i < args.length; i += 2) {
    const value = args[i + 1];
    if (value === undefined || !["--focus", "--parent", "--kind"].includes(args[i]!) || (args[i] === "--kind" && value !== SEQUENCE_PREFIX)) {
      process.stderr.write(USAGE);
      return 2;
    }
    if (args[i] === "--focus") focus = value;
    else if (args[i] === "--kind") sequence = true;
    else parent = value;
  }
  if (sequence && (focus.trim() === "" || parent !== null)) {
    process.stderr.write("repo-facts.mjs: a sequence map needs --focus naming the flow to follow, and takes no --parent\n");
    return 2;
  }
  const root = process.cwd();
  if (parent !== null && (!parseRunFolderName(parent) || !existsSync(join(root, MAP_DIR, parent, CANDIDATE_FILE)))) {
    process.stderr.write(`repo-facts.mjs: --parent names no accepted map in ${MAP_DIR}/: ${parent}\n`);
    return 2;
  }
  // Git facts come first, so the new run folder is not among the dirty paths.
  const git = collectGitFacts(root);
  const slug = slugify(focus, basename(root));
  const previous = parent === null && !sequence ? previousMap(root, slug) : null;
  let reason: Lineage["reason"] = "no-previous";
  if (previous !== null) {
    const plan = planRefresh(root, previous);
    reason = plan.mode === "update" ? "requested" : plan.reason;
  }
  const lineage: Lineage = {
    schema: 1,
    mode: "regenerate",
    reason,
    previousRun: previous,
    baseRevision: null,
    revision: git?.head ?? null,
    baseCommit: null,
    headCommit: git === null ? null : commitInfo(root, git.head),
    dirty: git?.dirty ?? [],
    dirtyCount: git?.dirtyCount ?? 0,
    updatesSinceRegeneration: 0,
  };
  let run: string;
  try {
    run = createRunFolder(root, slug, runTimestamp(new Date()), sequence ? { prefix: SEQUENCE_PREFIX } : {});
    writeRunRecord(root, join(root, MAP_DIR, run), newRunRecord({ focus, skillVersion: SKILL_VERSION, ...(parent === null ? {} : { kind: "drill" as const, parent }) }));
    if (!sequence) writeRunFile(root, join(root, MAP_DIR, run), LINEAGE_FILE, lineage);
  } catch (error) {
    process.stderr.write(`repo-facts.mjs: ${(error as Error).message}\n`);
    return 2;
  }
  const size = repoSize(root);
  const facts = {
    root,
    runFolder: `${MAP_DIR}/${run}`,
    draft: `${MAP_DIR}/${run}/${DRAFT_FILE}`,
    previous: previous === null ? null : `${MAP_DIR}/${previous}/${CANDIDATE_FILE}`,
    git: git && { head: git.head, origin: git.origin, dirtyCount: git.dirtyCount, dirty: git.dirty },
    size,
    estimate: skillEstimates(sizeFacts(size), "full"),
    budget: READ_BUDGET[size.tier],
  };
  process.stdout.write(`${JSON.stringify(facts, null, 2)}\n`);
  return 0;
}

// Set the code instead of calling process.exit(): stdout to a pipe is asynchronous on macOS.
process.exitCode = main(process.argv.slice(2));
