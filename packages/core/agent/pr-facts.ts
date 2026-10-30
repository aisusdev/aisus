// `node <skill>/scripts/pr-facts.mjs --pull <n> --base <branch> --head <sha> [--instructions <text>]`,
// run with cwd = repo root (PRC-07): checks that the checked-out commit is the pull request's head,
// and prints the merge-base with `origin/<base>` and the files the pull request changes. With
// instructions it also creates a run folder of kind `pull` for the diagram that answers them, and
// prints where its draft goes.
import { join } from "node:path";
import { REVISION_PATTERN } from "../model/changes";
import { collectGitFacts, mergeBase, numstatSince } from "../model/git";
import { createRunFolder, DRAFT_FILE, MAP_DIR, runTimestamp, slugify } from "../model/runFolder";
import { newRunRecord, writeRunRecord } from "../model/runRecord";

/** The skill version, filled in by the build. */
const SKILL_VERSION = process.env.AISUS_VERSION ?? "unknown";
/** The longest instructions the cloud keeps with a diagram. */
export const MAX_INSTRUCTIONS = 500;

const USAGE = "pr-facts.mjs: usage: node pr-facts.mjs --pull <n> --base <branch> --head <sha> [--instructions <text>]\n";

function main(args: string[]): number {
  const options = new Map<string, string>();
  for (let i = 0; i < args.length; i += 2) {
    const value = args[i + 1];
    if (value === undefined || !["--pull", "--base", "--head", "--instructions"].includes(args[i]!) || options.has(args[i]!)) {
      process.stderr.write(USAGE);
      return 2;
    }
    options.set(args[i]!, value);
  }
  const pull = Number(options.get("--pull"));
  const base = options.get("--base") ?? "";
  const head = options.get("--head") ?? "";
  const instructions = (options.get("--instructions") ?? "").trim();
  if (!Number.isInteger(pull) || pull < 1 || !REVISION_PATTERN.test(`origin/${base}`) || base === "" || !/^[0-9a-f]{40}$/.test(head)) {
    process.stderr.write(USAGE);
    return 2;
  }
  if (instructions.length > MAX_INSTRUCTIONS) {
    process.stderr.write(`pr-facts.mjs: the instructions are ${instructions.length} characters; aisus cloud keeps at most ${MAX_INSTRUCTIONS}\n`);
    return 2;
  }
  const root = process.cwd();
  const git = collectGitFacts(root);
  if (git === null) {
    process.stderr.write("pr-facts.mjs: this folder is not a git repository\n");
    return 2;
  }
  if (git.head !== head) {
    process.stderr.write(`pr-facts.mjs: the checked-out commit ${git.head.slice(0, 7)} is not pull request #${pull}'s head ${head.slice(0, 7)}. Check out its branch and pull first.\n`);
    return 1;
  }
  const shared = mergeBase(root, `origin/${base}`, "HEAD");
  const changed = shared === null ? null : numstatSince(root, shared);
  if (shared === null || changed === null) {
    process.stderr.write(`pr-facts.mjs: no merge-base with origin/${base}. Run git fetch origin ${base} first.\n`);
    return 2;
  }
  const facts: Record<string, unknown> = { root, pull, base, head, mergeBase: shared, changed };
  if (instructions !== "") {
    let run: string;
    try {
      run = createRunFolder(root, slugify(instructions, `pull-${pull}`), runTimestamp(new Date()));
      writeRunRecord(root, join(root, MAP_DIR, run), newRunRecord({ kind: "pull", focus: instructions, skillVersion: SKILL_VERSION }));
    } catch (error) {
      process.stderr.write(`pr-facts.mjs: ${(error as Error).message}\n`);
      return 2;
    }
    facts["runFolder"] = `${MAP_DIR}/${run}`;
    facts["draft"] = `${MAP_DIR}/${run}/${DRAFT_FILE}`;
  }
  process.stdout.write(`${JSON.stringify(facts, null, 2)}\n`);
  return 0;
}

// Set the code instead of calling process.exit(): stdout to a pipe is asynchronous on macOS.
process.exitCode = main(process.argv.slice(2));
