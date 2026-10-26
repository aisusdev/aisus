// FRS-07, FRS-10: the shown map compared with an earlier one. A map made from another opens compared
// with it. `aisus: Compare With…` picks any other map of the folder, or none, and Open baseline and
// Swap show the earlier map in the panel.
import { readFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import * as vscode from "vscode";
import { compareRuns, pickerTags, type RunFacts } from "@aisus/core/model/comparison";
import { diffMaps } from "@aisus/core/model/diff";
import { listCandidates, type Candidate } from "@aisus/core/model/discovery";
import { readLineage, readRunChanges, type Lineage } from "@aisus/core/model/lineage";
import type { Comparison } from "@aisus/core/model/messages";
import { MAP_DIR, CANDIDATE_FILE, parseRunFolderName } from "@aisus/core/model/runFolder";
import { parseDiagram, type ViewDiagram } from "@aisus/core/model/tolerant";
import { isJsonObject } from "@aisus/core/model/types";
import { onAction } from "./notify";
import { ArchitecturePanel } from "./panel";

interface ReadMap {
  diagram: ViewDiagram;
  repository: { url: string | null; revision: string | null };
}

function read(file: string): ReadMap | null {
  try {
    const result = parseDiagram(readFileSync(file, "utf8"));
    if (!result.ok) return null;
    const meta = isJsonObject(result.value) && isJsonObject(result.value["meta"]) ? result.value["meta"] : {};
    const repository = isJsonObject(meta["repository"]) ? meta["repository"] : {};
    const text = (value: unknown): string | null => (typeof value === "string" ? value : null);
    return { diagram: result.diagram, repository: { url: text(repository["url"]), revision: text(repository["revision"]) } };
  } catch {
    return null;
  }
}

/** The map in `file`, or `null`. */
export function readMap(file: string): ViewDiagram | null {
  return read(file)?.diagram ?? null;
}

/** The run folder of `file` when it is `<root>/.aisus/maps/<run>/candidate.json`, else `null`. */
function runOf(root: string, file: string): string | null {
  const runDir = dirname(file);
  return basename(file) === CANDIDATE_FILE && dirname(runDir) === join(root, MAP_DIR) ? basename(runDir) : null;
}

/** Each run's lineage, read at most once. */
function lineages(root: string): (run: string) => Lineage | null {
  const cache = new Map<string, Lineage | null>();
  return (run) => {
    if (run.includes("/") || run.includes("\\") || run === "." || run === "..") return null;
    if (!cache.has(run)) cache.set(run, readLineage(join(root, MAP_DIR, run)));
    return cache.get(run)!;
  };
}

function facts(root: string, file: string, map: ReadMap | null, candidates: readonly Candidate[], outside: number, lineageOf: (run: string) => Lineage | null): RunFacts {
  const run = runOf(root, file);
  const order = candidates.findIndex((candidate) => candidate.file === file);
  return {
    runFolder: run ?? basename(file),
    slug: run === null ? null : (parseRunFolderName(run)?.slug ?? null),
    order: order < 0 ? outside : order,
    lineage: run === null ? null : lineageOf(run),
    repository: map?.repository ?? { url: null, revision: null },
    componentIds: map?.diagram.components.map((box) => box.id) ?? [],
  };
}

/** The earlier map `file`'s run continues, when its candidate still exists (FRS-10). */
export function defaultBaseline(root: string, file: string): string | null {
  const run = runOf(root, file);
  const previous = run === null ? null : readLineage(join(root, MAP_DIR, run))?.previousRun;
  if (!previous || previous === run) return null;
  return listCandidates(root).find((candidate) => candidate.runFolder === previous)?.file ?? null;
}

/** The shown map `file` compared with `baseline`, or `null` when either cannot be read. */
export function buildComparison(root: string, file: string, baseline: string, shown: boolean): Comparison | null {
  const current = read(file);
  const earlier = read(baseline);
  if (current === null || earlier === null) return null;
  const candidates = listCandidates(root);
  const lineageOf = lineages(root);
  const run = runOf(root, file);
  const changes = run === null ? null : readRunChanges(join(root, MAP_DIR, run));
  const context = compareRuns(facts(root, file, current, candidates, -1, lineageOf), facts(root, baseline, earlier, candidates, Number.MAX_SAFE_INTEGER, lineageOf), lineageOf, changes !== null);
  const touched = context.keptAvailable && changes !== null ? new Set(changes.touched.map((box) => box.id)) : new Set<string>();
  return {
    against: context.baselineRun,
    diff: diffMaps(earlier.diagram, current.diagram, touched),
    context,
    ...(context.keptAvailable && changes !== null ? { changes } : {}),
    shown,
  };
}

/** Compares the shown map with `other`, the candidate file of another run. Returns whether it could. */
export function compareWith(other: string): boolean {
  const panel = ArchitecturePanel.current;
  if (panel === undefined || panel.file === "" || buildComparison(panel.root, panel.file, other, true) === null) return false;
  panel.showCompare({ kind: "file", file: other });
  return true;
}

export async function compareMapsCommand(): Promise<void> {
  const panel = ArchitecturePanel.current;
  if (panel === undefined || panel.file === "") return;
  const candidates = listCandidates(panel.root);
  const others = candidates.filter((candidate) => candidate.file !== panel.file);
  if (others.length === 0) {
    void vscode.window.showInformationMessage("This folder has no other map to compare with.");
    return;
  }
  const lineageOf = lineages(panel.root);
  const current = facts(panel.root, panel.file, read(panel.file), candidates, -1, lineageOf);
  const items: (vscode.QuickPickItem & { file: string | null })[] = [
    { label: "No comparison", file: null },
    ...others.map((candidate) => ({
      label: candidate.runFolder,
      description: pickerTags(current, facts(panel.root, candidate.file, read(candidate.file), candidates, Number.MAX_SAFE_INTEGER, lineageOf), lineageOf).join(", "),
      file: candidate.file,
    })),
  ];
  const picked = await vscode.window.showQuickPick(items, { placeHolder: "Compare the shown map with which map?" });
  if (picked === undefined) return;
  if (picked.file === null) panel.showCompare({ kind: "none" });
  else if (!compareWith(picked.file)) onAction(vscode.window.showErrorMessage(`Cannot read ${picked.label} to compare with it.`, "Compare With…"), "Compare With…", compareMapsCommand);
}

/** Open baseline: the earlier map in the panel, with its own comparison. */
export function openBaseline(): void {
  const panel = ArchitecturePanel.current;
  const baseline = panel?.baselineFile();
  if (panel === undefined || baseline === null || baseline === undefined) return;
  panel.showFile(panel.root, baseline);
}

/** Swap: the earlier map in the panel, compared with the map shown before. */
export function swapComparison(): void {
  const panel = ArchitecturePanel.current;
  const baseline = panel?.baselineFile();
  if (panel === undefined || baseline === null || baseline === undefined) return;
  const shown = panel.file;
  panel.showFile(panel.root, baseline);
  panel.showCompare({ kind: "file", file: shown });
}
