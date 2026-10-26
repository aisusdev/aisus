// `node <skill>/scripts/tour-record.mjs <repo>/.aisus/maps/<run>/tour-draft.json`, run with cwd = repo
// root (SKL-02): checks the tour skill's draft against the map and the code, writes tour.json beside
// the map, and removes the draft. Prints one JSON object: recorded, or rejected with the errors.
import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { checkCitations } from "../model/citations";
import { assertWritable } from "../model/confine";
import { MAP_DIR, CANDIDATE_FILE, mapRootOf, parseRunFolderName } from "../model/runFolder";
import { checkTourDraft, TOUR_DRAFT_FILE, TOUR_FILE, type TourDraft } from "../model/tour";
import type { ArchitectureDoc, Issue } from "../model/types";

const HINT = "Fix each error in tour-draft.json and run tour-record.mjs again.";

function print(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function main(args: string[]): number {
  if (args.length !== 1) {
    process.stderr.write(`tour-record.mjs: usage: node tour-record.mjs <repo>/${MAP_DIR}/<run>/${TOUR_DRAFT_FILE}\n`);
    return 2;
  }
  const draftPath = resolve(process.cwd(), args[0]!);
  const runDir = dirname(draftPath);
  const root = mapRootOf(runDir);
  if (basename(draftPath) !== TOUR_DRAFT_FILE || root === null || !parseRunFolderName(basename(runDir))) {
    process.stderr.write(`tour-record.mjs: expected a path of the form <repo>/${MAP_DIR}/<run>/${TOUR_DRAFT_FILE}, got ${args[0]}\n`);
    return 2;
  }
  let map: ArchitectureDoc;
  try {
    map = JSON.parse(readFileSync(join(runDir, CANDIDATE_FILE), "utf8")) as ArchitectureDoc;
  } catch (error) {
    process.stderr.write(`tour-record.mjs: the run has no readable ${CANDIDATE_FILE}: ${(error as Error).message}\n`);
    return 2;
  }
  let value: unknown;
  try {
    value = JSON.parse(readFileSync(draftPath, "utf8"));
  } catch (error) {
    print({ status: "rejected", errors: [{ pointer: "", message: `${TOUR_DRAFT_FILE} is not valid JSON: ${(error as Error).message}` }], hint: HINT });
    return 1;
  }
  let issues: Issue[] = checkTourDraft(value, { components: map.components });
  if (issues.length === 0) {
    // Each stop's citation passes the same path, deny-list and line checks as a map citation.
    const draft = value as TourDraft;
    const asCitations = { ...map, components: draft.stops.map((stop, index) => ({ id: `stop-${index}`, type: "external", label: "", sources: [stop.citation] })) } as unknown as ArchitectureDoc;
    issues = checkCitations(asCitations, root).map((issue) => ({ ...issue, pointer: issue.pointer.replace(/^\/components\/(\d+)\/sources\/0/, "/stops/$1/citation") }));
  }
  if (issues.length > 0) {
    print({ status: "rejected", errors: issues.map(({ pointer, message }) => ({ pointer, message })), hint: HINT });
    return 1;
  }
  const draft = value as TourDraft;
  const target = join(runDir, TOUR_FILE);
  try {
    assertWritable(root, target);
    writeFileSync(target, `${JSON.stringify({ schema: 1, createdAt: new Date().toISOString(), stops: draft.stops }, null, 2)}\n`);
    rmSync(draftPath, { force: true });
  } catch (error) {
    process.stderr.write(`tour-record.mjs: cannot write ${TOUR_FILE}: ${(error as Error).message}\n`);
    return 2;
  }
  print({ status: "recorded", tour: `${MAP_DIR}/${basename(runDir)}/${TOUR_FILE}`, stops: draft.stops.length });
  return 0;
}

// Set the code instead of calling process.exit(): stdout to a pipe is asynchronous on macOS.
process.exitCode = main(process.argv.slice(2));
