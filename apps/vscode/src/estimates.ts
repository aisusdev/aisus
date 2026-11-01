// CST-03: the estimate every token-spending action shows, from the folder's size (CST-01), scaled
// to what the folder's past runs spent (P-26). Sizes are cached per folder for a minute, since the
// sidebar asks on every change.
import * as vscode from "vscode";
import { detailedEstimate, detailedRunEstimate, estimate, midpoint, runEstimate, type EstimateAgent, type EstimateKind, type RunEstimate } from "@aisus/core/model/estimate";
import { planFiles, readPlan } from "@aisus/core/model/readPlan";
import { repoSize, sizeFacts, type RepoSize } from "@aisus/core/model/repoSize";
import { finishedRuns, spentTokens, type RunRecord, type RunTokens } from "@aisus/core/model/runRecord";
import { AGENTS, type SkillName } from "@aisus/core/model/agents";

/** How long a folder's size is reused. */
export const SIZE_TTL_MS = 60_000;
/** `aisus.confirmAboveTokens` when unset. */
export const DEFAULT_CONFIRM_ABOVE = 300_000;
/** The past runs an estimate is scaled to (P-26). */
export const CALIBRATION_RUNS = 5;

const sizes = new Map<string, { at: number; size: RepoSize }>();

/** The size of `root`, measured at most once a minute. */
export function folderSize(root: string, now = Date.now()): RepoSize {
  const cached = sizes.get(root);
  if (cached !== undefined && now - cached.at < SIZE_TTL_MS) return cached.size;
  const size = repoSize(root);
  sizes.set(root, { at: now, size });
  return size;
}

/** Forgets every measured size, for the tests. */
export function forgetSizes(): void {
  sizes.clear();
}

/** Tokens above which a run needs a second click. */
export function confirmAbove(): number {
  const value = vscode.workspace.getConfiguration("aisus").get<number>("confirmAboveTokens", DEFAULT_CONFIRM_ABOVE);
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : DEFAULT_CONFIRM_ABOVE;
}

/** The estimate kind a skill's run spends; an audit reads cited ranges as a refresh does. */
export function estimateKind(skill: SkillName): EstimateKind {
  return skill === "aisus-architecture" || skill === "aisus-sequence" ? "full" : "refresh";
}

/** Whether `aisus.estimate.detailed` is on, which plans a Generate run's reads before it starts (P-26). */
export function detailedEnabled(): boolean {
  return vscode.workspace.getConfiguration("aisus").get<boolean>("estimate.detailed", false) === true;
}

/** The latest runs of `kind` by `agent` in `root` that calibrate an estimate (P-26). Ask runs record none. */
function pastRuns(root: string, agent: EstimateAgent, kind: EstimateKind): (RunRecord & { tokens: RunTokens })[] {
  const label = AGENTS.find((entry) => entry.cli === agent)!.label;
  return kind === "ask" ? [] : finishedRuns(root, label, kind, CALIBRATION_RUNS);
}

/** The estimate of a `kind` run by `agent` in `root`, scaled to the folder's past runs, or `null` when the folder cannot be measured. */
export function launchEstimate(root: string, agent: EstimateAgent, kind: EstimateKind): RunEstimate | null {
  try {
    const size = sizeFacts(folderSize(root));
    const predicted = midpoint(estimate(size, agent, kind));
    const ratios = pastRuns(root, agent, kind).map((run) => spentTokens(run.tokens) / predicted);
    return runEstimate(size, agent, kind, confirmAbove(), ratios);
  } catch {
    return null;
  }
}

/**
 * P-26: the detailed estimate of a Generate run with `focus` by `agent` in `root`. Each past run is
 * compared with the plan its own focus gives over today's files. `null` when the folder cannot be measured.
 */
export function detailedLaunchEstimate(root: string, agent: EstimateAgent, focus: string): RunEstimate | null {
  try {
    const { tier } = folderSize(root);
    const files = planFiles(root);
    const ratios = pastRuns(root, agent, "full").map((run) => spentTokens(run.tokens) / midpoint(detailedEstimate(readPlan(files, run.focus, tier), agent).range));
    return detailedRunEstimate(readPlan(files, focus, tier), agent, ratios);
  } catch {
    return null;
  }
}

/**
 * The estimate a run of `skill` states. With `aisus.estimate.detailed` on, a map run with a known
 * `focus` gets the detailed estimate, and one whose focus is not typed yet needs a second click.
 */
export function taskEstimate(root: string, agent: EstimateAgent, skill: SkillName, focus?: string): RunEstimate | null {
  const kind = estimateKind(skill);
  if (kind !== "full" || !detailedEnabled()) return launchEstimate(root, agent, kind);
  if (focus !== undefined) return detailedLaunchEstimate(root, agent, focus);
  const basic = launchEstimate(root, agent, kind);
  return basic === null ? null : { ...basic, confirm: true };
}
