// FRS-10: the context of comparing the shown map with an earlier one: both commits, the warnings,
// whether a full drawing lies between them, and whether the shown run's recorded change applies.
// Browser-safe: the host reads every fact from disk.
import type { Lineage } from "./lineage";

/** What the host knows about one map. */
export interface RunFacts {
  /** The run folder, or the file's name outside `.archify/`. */
  runFolder: string;
  /** The focus slug from the run folder's name, or `null`. */
  slug: string | null;
  /** Place in the folder's maps, newest first. */
  order: number;
  lineage: Lineage | null;
  /** `meta.repository.url` and `.revision` of the candidate, when present. */
  repository: { url: string | null; revision: string | null };
  componentIds: readonly string[];
}

export type WarningCode = "different-focus" | "unrelated" | "different-repository" | "outside-history" | "reversed";

export interface ComparisonWarning {
  code: WarningCode;
  message: string;
}

/** A commit as the header shows it. */
export interface CommitRef {
  revision: string;
  subject: string | null;
  committedAt: string | null;
  /** Files uncommitted when the run started; 0 when unknown. */
  dirtyCount: number;
}

export interface ComparisonContext {
  baselineRun: string;
  currentRun: string;
  warnings: ComparisonWarning[];
  /** A full drawing lies between the two maps, so new ids may stand for old boxes. */
  approximate: boolean;
  /** The shown run's kept boxes and uncited files apply: it is an update of the baseline. */
  keptAvailable: boolean;
  /** The shown run is an update, but of another map, so its kept boxes do not apply here. */
  keptNote: boolean;
  baselineCommit: CommitRef | null;
  currentCommit: CommitRef | null;
}

/** Below this share of box ids in common, two maps are probably unrelated. */
export const UNRELATED_SHARE = 0.3;
/** The walk through earlier runs stops after this many steps. */
const MAX_STEPS = 1000;

/** The runs reached from `current` through `previousRun`, and whether a full drawing lies before `target`. */
function history(current: RunFacts, target: string, lineageOf: (run: string) => Lineage | null): { runs: Set<string>; redrawBefore: boolean } {
  const runs = new Set<string>();
  let redraw = false;
  let redrawBefore = false;
  let lineage = current.lineage;
  for (let step = 0; lineage !== null && step < MAX_STEPS; step++) {
    const previous = lineage.previousRun;
    if (previous === null || previous === current.runFolder || runs.has(previous)) break;
    if (lineage.mode === "regenerate") redraw = true;
    runs.add(previous);
    if (previous === target) redrawBefore = redraw;
    lineage = lineageOf(previous);
  }
  return { runs, redrawBefore };
}

function commitRef(run: RunFacts): CommitRef | null {
  if (run.lineage?.revision) {
    return { revision: run.lineage.revision, subject: run.lineage.headCommit?.subject ?? null, committedAt: run.lineage.headCommit?.committedAt ?? null, dirtyCount: run.lineage.dirtyCount };
  }
  return run.repository.revision === null ? null : { revision: run.repository.revision, subject: null, committedAt: null, dirtyCount: 0 };
}

/** The context of comparing the shown map `current` with `baseline`. `changesRecorded` says whether the shown run has a readable `changes.json`. */
export function compareRuns(current: RunFacts, baseline: RunFacts, lineageOf: (run: string) => Lineage | null, changesRecorded: boolean): ComparisonContext {
  const walk = history(current, baseline.runFolder, lineageOf);
  const warnings: ComparisonWarning[] = [];
  if (current.slug !== null && baseline.slug !== null && current.slug !== baseline.slug) {
    warnings.push({ code: "different-focus", message: `This map's focus is ${current.slug}, and the earlier map's is ${baseline.slug}.` });
  }
  const mine = new Set(current.componentIds);
  const union = new Set([...current.componentIds, ...baseline.componentIds]);
  const shared = new Set(baseline.componentIds.filter((id) => mine.has(id))).size;
  if (union.size > 0 && shared / union.size < UNRELATED_SHARE) {
    warnings.push({ code: "unrelated", message: `The two maps are probably unrelated. Only ${shared} of ${union.size} boxes match.` });
  }
  if (current.repository.url !== null && baseline.repository.url !== null && current.repository.url !== baseline.repository.url) {
    warnings.push({ code: "different-repository", message: `The earlier map is of another repository, ${baseline.repository.url}.` });
  }
  const outside = current.lineage !== null && baseline.lineage !== null && !walk.runs.has(baseline.runFolder);
  if (outside) warnings.push({ code: "outside-history", message: "The earlier map is not in this map's update history." });
  if (baseline.order < current.order) warnings.push({ code: "reversed", message: "The earlier map is newer than this one, so the changes show in reverse." });
  const isPrevious = current.lineage !== null && current.lineage.previousRun === baseline.runFolder;
  const keptAvailable = isPrevious && current.lineage?.mode === "update" && changesRecorded;
  return {
    baselineRun: baseline.runFolder,
    currentRun: current.runFolder,
    warnings,
    approximate: (walk.runs.has(baseline.runFolder) && walk.redrawBefore) || outside,
    keptAvailable,
    keptNote: current.lineage?.mode === "update" && !keptAvailable,
    baselineCommit: commitRef(baseline),
    currentCommit: commitRef(current),
  };
}

/** The tags Compare with… shows for `other` against the shown map, in order. */
export function pickerTags(current: RunFacts, other: RunFacts, lineageOf: (run: string) => Lineage | null): string[] {
  const tags: string[] = [];
  if (current.lineage?.previousRun === other.runFolder) tags.push("previous");
  if (other.order < current.order) tags.push("newer");
  if (current.slug !== null && other.slug !== null && current.slug !== other.slug) tags.push("different focus");
  if (current.lineage !== null && other.lineage !== null && !history(current, other.runFolder, lineageOf).runs.has(other.runFolder)) tags.push("outside update history");
  return tags;
}
