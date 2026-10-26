// `node <skill>/scripts/match-ids.mjs <repo>/.archify/<run>/draft.json --previous <repo>/.archify/<earlier>/candidate.json`,
// run with cwd = repo root (FRS-09): rewrites the draft in place, giving each box that matches a box of
// the earlier map that box's id, and prints how many boxes kept an earlier id.
import { readFileSync, realpathSync, writeFileSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { assertWritable, isWithin } from "../model/confine";
import { matchIds } from "../model/matchIds";
import { MAP_DIR, CANDIDATE_FILE, locateDraft } from "../model/runFolder";
import { isJsonObject } from "../model/types";

const USAGE = `usage: node match-ids.mjs <repo>/${MAP_DIR}/<run>/draft.json --previous <repo>/${MAP_DIR}/<run>/${CANDIDATE_FILE}`;

function fail(message: string): number {
  process.stderr.write(`match-ids.mjs: ${message}\n`);
  return 2;
}

function main(args: string[]): number {
  if (args.length !== 3 || args[1] !== "--previous") return fail(USAGE);
  let location;
  try {
    location = locateDraft(args[0]!, process.cwd());
  } catch (error) {
    return fail((error as Error).message);
  }
  const previous = resolve(process.cwd(), args[2]!);
  if (basename(previous) !== CANDIDATE_FILE || basename(dirname(dirname(previous))) !== MAP_DIR) return fail(USAGE);
  let draft: unknown;
  let earlier: unknown;
  try {
    const root = realpathSync(location.root);
    if (!isWithin(root, realpathSync(location.draft)) || !isWithin(root, realpathSync(previous))) return fail("both files must lie inside the repository");
    draft = JSON.parse(readFileSync(location.draft, "utf8"));
    earlier = JSON.parse(readFileSync(previous, "utf8"));
  } catch (error) {
    return fail(`cannot read the draft or the earlier map: ${(error as Error).message}`);
  }
  if (!isJsonObject(draft) || !Array.isArray(draft["components"])) return fail("the draft has no components list; the validator says what is wrong with it");
  const matched = matchIds(earlier, draft);
  const earlierIds = new Set((isJsonObject(earlier) && Array.isArray(earlier["components"]) ? earlier["components"] : []).flatMap((box: unknown) => (isJsonObject(box) && typeof box["id"] === "string" ? [box["id"]] : [])));
  const kept = (matched["components"] as unknown[]).filter((box) => isJsonObject(box) && earlierIds.has(box["id"] as string)).length;
  try {
    assertWritable(location.root, location.draft);
    writeFileSync(location.draft, `${JSON.stringify(matched, null, 2)}\n`);
  } catch (error) {
    return fail((error as Error).message);
  }
  process.stdout.write(`${JSON.stringify({ status: "matched", kept, boxes: (matched["components"] as unknown[]).length }, null, 2)}\n`);
  return 0;
}

// Set the code instead of calling process.exit(): stdout to a pipe is asynchronous on macOS.
process.exitCode = main(process.argv.slice(2));
