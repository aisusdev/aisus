// FRS-08 and FRS-09: `lineage.json` and `changes.json` in a run folder, and the decision whether a
// map can be updated or must be drawn again. `planRefresh` makes that decision for the refresh skill,
// the extension and the Action, so all three agree.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { collectChanges, groupByBox, renderChange, runChanges, type ChangeMap } from "./changeMap";
import { assertWritable } from "./confine";
import { collectGitFacts, commitInfo, contextDiffSince, isAncestorOfHead, MAX_DIRTY_PATHS, untrackedFiles, type GitFacts } from "./git";
import { inScope } from "./refresh";
import { MAP_DIR, CANDIDATE_FILE, parseRunFolderName } from "./runFolder";
import { readRunRecord } from "./runRecord";
import { writeJson } from "./session";
import { readFingerprints } from "./staleness";
import { isJsonObject } from "./types";

export const LINEAGE_FILE = "lineage.json";
export const CHANGES_FILE = "changes.json";
export const CHANGE_FILE = "change.md";

/** Updates in a row before the next refresh draws the map again. */
export const MAX_UPDATES = 5;
/** Largest `change.md` an update works from, in UTF-8 bytes. */
export const MAX_CHANGE_BYTES = 2 * 1024 * 1024;

export type RunMode = "update" | "regenerate";
export type RegenerateReason = "requested" | "no-previous" | "no-git" | "no-base-revision" | "dirty-baseline" | "base-unreachable" | "scheduled" | "change-too-large";

/** Why a map is drawn again, as the run card and the pull request comment say it. */
export const REDRAW_REASONS: Record<RegenerateReason, string> = {
  requested: "a full drawing was asked for",
  "no-previous": "there is no earlier map with this focus",
  "no-git": "this folder is not a git repository",
  "no-base-revision": "the commit the map was drawn at is unknown",
  "dirty-baseline": "more than 200 files were uncommitted when the map was made",
  "base-unreachable": "the commit the map was drawn at is no longer in this branch's history",
  scheduled: "it was updated five times in a row",
  "change-too-large": "the change since the map is larger than 2 MiB",
};

export interface CommitInfo {
  subject: string;
  /** Committer date, ISO 8601. */
  committedAt: string;
}

export interface Lineage {
  schema: 1;
  mode: RunMode;
  reason: "update" | RegenerateReason;
  /** The run folder this run continues, or `null`. */
  previousRun: string | null;
  /** The commit the update's change starts from, or `null` for a full drawing. */
  baseRevision: string | null;
  /** HEAD when the run started, or `null` without git. */
  revision: string | null;
  baseCommit: CommitInfo | null;
  headCommit: CommitInfo | null;
  /** Paths uncommitted when the run started, at most 200. */
  dirty: string[];
  dirtyCount: number;
  updatesSinceRegeneration: number;
}

export type FileStatus = "added" | "deleted" | "modified" | "renamed";

export interface FileEntry {
  status: FileStatus;
  path: string;
  /** Only for a rename. */
  oldPath?: string;
}

export interface RunChanges {
  schema: 1;
  baseRevision: string;
  revision: string;
  /** Boxes of the base map whose cited files changed, with those files. */
  touched: { id: string; files: FileEntry[] }[];
  /** Changed files no box of the base map cites. */
  uncited: FileEntry[];
}

const STATUSES: readonly FileStatus[] = ["added", "deleted", "modified", "renamed"];
const isCount = (value: unknown): value is number => Number.isInteger(value) && (value as number) >= 0;
const isNullableString = (value: unknown): value is string | null => value === null || typeof value === "string";

function commit(value: unknown): CommitInfo | null {
  return isJsonObject(value) && typeof value["subject"] === "string" && typeof value["committedAt"] === "string" ? { subject: value["subject"], committedAt: value["committedAt"] } : null;
}

/** A parsed `lineage.json`, or `null` when its shape is wrong. */
export function parseLineage(value: unknown): Lineage | null {
  if (!isJsonObject(value) || value["schema"] !== 1 || (value["mode"] !== "update" && value["mode"] !== "regenerate")) return null;
  const { reason, previousRun, baseRevision, revision, dirty, dirtyCount, updatesSinceRegeneration } = value;
  if (typeof reason !== "string" || !isNullableString(previousRun) || !isNullableString(baseRevision) || !isNullableString(revision)) return null;
  if (!Array.isArray(dirty) || !dirty.every((path) => typeof path === "string") || !isCount(dirtyCount) || !isCount(updatesSinceRegeneration)) return null;
  return {
    schema: 1,
    mode: value["mode"],
    reason: reason as Lineage["reason"],
    previousRun,
    baseRevision,
    revision,
    baseCommit: commit(value["baseCommit"]),
    headCommit: commit(value["headCommit"]),
    dirty: dirty as string[],
    dirtyCount,
    updatesSinceRegeneration,
  };
}

function entries(value: unknown): FileEntry[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item): FileEntry[] => {
    if (!isJsonObject(item) || !STATUSES.includes(item["status"] as FileStatus) || typeof item["path"] !== "string" || item["path"] === "") return [];
    const status = item["status"] as FileStatus;
    if (status !== "renamed") return [{ status, path: item["path"] }];
    return typeof item["oldPath"] === "string" ? [{ status, path: item["path"], oldPath: item["oldPath"] }] : [];
  });
}

/** A parsed `changes.json`, or `null` when its shape is wrong. Malformed entries are skipped. */
export function parseRunChanges(value: unknown): RunChanges | null {
  if (!isJsonObject(value) || value["schema"] !== 1 || typeof value["baseRevision"] !== "string" || typeof value["revision"] !== "string") return null;
  if (!Array.isArray(value["touched"]) || !Array.isArray(value["uncited"])) return null;
  const touched = value["touched"].flatMap((box) => (isJsonObject(box) && typeof box["id"] === "string" ? [{ id: box["id"], files: entries(box["files"]) }] : []));
  return { schema: 1, baseRevision: value["baseRevision"], revision: value["revision"], touched, uncited: entries(value["uncited"]) };
}

function readJsonFile(path: string): unknown {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return undefined;
  }
}

export function readLineage(runDir: string): Lineage | null {
  return parseLineage(readJsonFile(join(runDir, LINEAGE_FILE)));
}

export function readRunChanges(runDir: string): RunChanges | null {
  return parseRunChanges(readJsonFile(join(runDir, CHANGES_FILE)));
}

/** Writes `value` as `runDir/file`, which must lie inside `root`. */
export function writeRunFile(root: string, runDir: string, file: string, value: unknown): void {
  const path = join(runDir, file);
  assertWritable(root, path);
  writeJson(path, value);
}

/** What decides between an update and a full drawing. */
export interface ModeFacts {
  hasGit: boolean;
  /** The base map's lineage, `null` for a map made before lineages. */
  previous: Lineage | null;
  /** The commit the base map was drawn at, or `null`. */
  base: string | null;
  reachable(base: string): boolean;
}

/** The first reason a map must be drawn again, in the spec's order, or `null` when it can be updated. */
export function redrawReason(facts: ModeFacts): RegenerateReason | null {
  if (!facts.hasGit) return "no-git";
  if (facts.base === null) return "no-base-revision";
  if (facts.previous !== null && facts.previous.dirtyCount > MAX_DIRTY_PATHS) return "dirty-baseline";
  if (!facts.reachable(facts.base)) return "base-unreachable";
  if (facts.previous !== null && facts.previous.updatesSinceRegeneration >= MAX_UPDATES) return "scheduled";
  return null;
}

/** An update's plan: the change it works from and the files it writes. */
export interface UpdatePlan {
  mode: "update";
  focus: string;
  base: string;
  git: GitFacts;
  map: ChangeMap;
  change: string;
  lineage: Lineage;
  changes: RunChanges;
}

export type RefreshPlan = UpdatePlan | { mode: "regenerate"; reason: RegenerateReason; focus: string };

/** Paths cited by a parsed map. */
function components(doc: unknown): { id: string; label: string; sources: { path: string }[] }[] {
  const list = isJsonObject(doc) && Array.isArray(doc["components"]) ? doc["components"] : [];
  return list.flatMap((component) => {
    if (!isJsonObject(component) || typeof component["id"] !== "string") return [];
    const sources = Array.isArray(component["sources"]) ? component["sources"].filter((source) => isJsonObject(source) && typeof source["path"] === "string") : [];
    return [{ id: component["id"], label: typeof component["label"] === "string" ? component["label"] : component["id"], sources: sources as { path: string }[] }];
  });
}

/**
 * Whether the map in `.aisus/maps/<run>` can be updated, and if so the change since it was made,
 * limited to `globs` when given (FRS-08). Takes git's facts before any new run folder exists.
 */
export function planRefresh(root: string, run: string, globs: readonly RegExp[] = []): RefreshPlan {
  const runDir = join(root, MAP_DIR, run);
  const focus = readRunRecord(runDir)?.focus ?? "";
  const previous = readLineage(runDir);
  const git = collectGitFacts(root);
  const base = previous?.revision ?? readFingerprints(runDir)?.revision ?? null;
  const reason = redrawReason({ hasGit: git !== null, previous, base, reachable: (revision) => isAncestorOfHead(root, revision) });
  if (reason !== null) return { mode: "regenerate", reason, focus };
  const diff = contextDiffSince(root, base!);
  if (diff === null || git === null) return { mode: "regenerate", reason: "base-unreachable", focus };
  const boxes = components(readJsonFile(join(runDir, CANDIDATE_FILE)));
  const cited = new Set(boxes.flatMap((box) => box.sources.map((source) => source.path)));
  const files = collectChanges({
    diff,
    untracked: untrackedFiles(root),
    previousDirty: previous?.dirty ?? [],
    cited,
    exists: (path) => existsSync(join(root, path)),
    readUntracked: (path) => {
      try {
        const bytes = readFileSync(join(root, path));
        return bytes.includes(0) ? null : bytes.toString("utf8");
      } catch {
        return null;
      }
    },
  }).filter((file) => inScope(file.entry.path, globs) || (file.entry.oldPath !== undefined && inScope(file.entry.oldPath, globs)));
  const map = groupByBox(boxes, files);
  const change = renderChange(base!, git.head, map);
  if (new TextEncoder().encode(change).length > MAX_CHANGE_BYTES) return { mode: "regenerate", reason: "change-too-large", focus };
  const lineage: Lineage = {
    schema: 1,
    mode: "update",
    reason: "update",
    previousRun: run,
    baseRevision: base,
    revision: git.head,
    baseCommit: commitInfo(root, base!),
    headCommit: commitInfo(root, git.head),
    dirty: git.dirty,
    dirtyCount: git.dirtyCount,
    updatesSinceRegeneration: (previous?.updatesSinceRegeneration ?? 0) + 1,
  };
  return { mode: "update", focus, base: base!, git, map, change, lineage, changes: runChanges(map, base!, git.head) };
}

/** The newest accepted map in `.aisus/maps/` with `slug`, other than `except`, or `null` (FRS-09). */
export function previousMap(root: string, slug: string, except: string | null = null): string | null {
  let best: { run: string; key: string } | null = null;
  let names: string[];
  try {
    names = readdirSync(join(root, MAP_DIR));
  } catch {
    return null;
  }
  for (const run of names) {
    const parsed = parseRunFolderName(run);
    if (parsed === null || parsed.slug !== slug || run === except || !existsSync(join(root, MAP_DIR, run, CANDIDATE_FILE))) continue;
    if (readRunRecord(join(root, MAP_DIR, run))?.kind === "drill") continue;
    const key = `${parsed.timestamp}-${String(parsed.n).padStart(6, "0")}`;
    if (best === null || key > best.key) best = { run, key };
  }
  return best?.run ?? null;
}
