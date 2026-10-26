// CLD-12 and CLD-16: the extension's side of aisus cloud, on only while `aisus.cloud.enabled` is.
// Share to aisus cloud previews the exact JSON and sends it after a confirmation. Open Architecture
// pulls the checked-out branch's maps and opens the one the load order picks. Every request goes
// through packages/cloud-client/client.ts, signed with VS Code's GitHub sign-in.
import { mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import * as vscode from "vscode";
import { postUpload, pullMaps, type BranchMaps, type CloudMap } from "@aisus/cloud-client/client";
import { listCandidates } from "@aisus/core/model/discovery";
import type { CloudMapItem } from "@aisus/core/model/messages";
import { parseDiagram } from "@aisus/core/model/tolerant";
import { FINGERPRINTS_FILE } from "@aisus/core/model/fingerprints";
import { collectGitFacts, commitsBetween, currentBranch, isAncestor } from "@aisus/core/model/git";
import { chooseMap, stalenessText, type LocalCandidate, type Staleness } from "@aisus/core/model/loadOrder";
import { parseRunFolderName } from "@aisus/core/model/runFolder";
import { readRunRecord, RUN_FILE } from "@aisus/core/model/runRecord";
import { writeJson } from "@aisus/core/model/session";
import { checkUpload, githubSlug, mapPayload, mapSha256 } from "@aisus/core/model/upload";
import { ensureGitExclude } from "./hooksFiles";
import { ArchitecturePanel } from "./panel";

/** Where pulled maps are kept, one folder per cloud map, out of git. */
export const CLOUD_DIR = ".aisus/cloud";

const SCOPES = ["read:user", "repo"];

/** CLD-12: the scheme of the read-only preview of an upload, which closes without asking to save. */
export const PREVIEW_SCHEME = "aisus-cloud-preview";
const previews = new Map<string, string>();
let previewProvider: vscode.Disposable | undefined;

async function showPreview(json: string): Promise<void> {
  previewProvider ??= vscode.workspace.registerTextDocumentContentProvider(PREVIEW_SCHEME, { provideTextDocumentContent: (uri) => previews.get(uri.path) ?? "" });
  const path = `/upload-${previews.size + 1}.json`;
  previews.set(path, json);
  const document = await vscode.workspace.openTextDocument(vscode.Uri.from({ scheme: PREVIEW_SCHEME, path }));
  await vscode.languages.setTextDocumentLanguage(document, "json");
  await vscode.window.showTextDocument(document, { preview: true, viewColumn: vscode.ViewColumn.Beside });
}

export function cloudEnabled(): boolean {
  return vscode.workspace.getConfiguration("aisus").get<boolean>("cloud.enabled", false);
}

function cloudUrl(): string {
  return vscode.workspace.getConfiguration("aisus").get<string>("cloud.url", "https://aisus.dev");
}

/** CLD-19: the cloud's address without the scheme, such as "aisus.dev". */
export function cloudHost(): string {
  return cloudUrl().replace(/^https?:\/\//, "").replace(/\/+$/, "");
}

interface RepoContext {
  repo: string;
  branch: string;
  head: string;
}

/** The repository, branch and HEAD of `root`, or `null` without a github.com origin or a checked-out branch. */
function repoContext(root: string): RepoContext | null {
  const git = collectGitFacts(root);
  const repo = git?.origin ? githubSlug(git.origin) : null;
  const branch = currentBranch(root);
  return !git || repo === null || branch === null ? null : { repo, branch, head: git.head };
}

/** Opens the cloud's settings page, where a refused upload says what to change. */
async function openCloudSettings(): Promise<void> {
  await vscode.env.openExternal(vscode.Uri.parse(`${cloudUrl().replace(/\/+$/, "")}/settings`));
}

async function githubToken(createIfNone: boolean): Promise<string | undefined> {
  const session = await vscode.authentication.getSession("github", SCOPES, createIfNone ? { createIfNone: true } : { silent: true });
  return session?.accessToken;
}

/** CLD-19: the GitHub account aisus cloud is signed in with, read without asking for a sign-in. */
export async function cloudAccount(): Promise<string | null> {
  const session = await vscode.authentication.getSession("github", SCOPES, { silent: true });
  return session?.account.label ?? null;
}

/** CLD-19: asks for the GitHub sign-in. A dismissed sign-in leaves things as they were. */
export async function signInToCloud(): Promise<void> {
  try {
    await githubToken(true);
  } catch {
    return;
  }
}

function readJson(path: string): unknown {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return undefined;
  }
}

/** CLD-12: Share to aisus cloud for the map in `file`. */
export async function shareMapCommand(root: string, file: string): Promise<void> {
  if (!cloudEnabled()) return;
  const context = repoContext(root);
  if (context === null) {
    void vscode.window.showInformationMessage("Share to aisus cloud works in a git repository with a github.com origin and a checked-out branch.");
    return;
  }
  const picked = await vscode.window.showQuickPick(
    [
      { label: "Personal space", description: "Only you can see it", space: "personal" as const },
      { label: "Team space", description: `The team's map of ${context.branch}`, space: "team" as const },
    ],
    { placeHolder: `Share this map of ${context.branch} to` },
  );
  if (!picked) return;
  const dir = dirname(file);
  const payload = mapPayload({
    repo: context.repo,
    commit: context.head,
    branch: context.branch,
    run: parseRunFolderName(dir.split(/[\\/]/).at(-1) ?? "") === null ? "architecture-shared" : dir.split(/[\\/]/).at(-1)!,
    map: readJson(file),
    record: readRunRecord(dir),
    sidecars: { run: readJson(join(dir, RUN_FILE)), fingerprints: readJson(join(dir, FINGERPRINTS_FILE)), evidence: readJson(join(dir, "evidence.json")), tour: readJson(join(dir, "tour.json")) },
  });
  payload.space = picked.space;
  const issues = checkUpload(payload);
  if (issues.length > 0) {
    const action = await vscode.window.showErrorMessage(`aisus cloud would refuse this map, so nothing was sent: ${issues.map((issue) => `${issue.pointer} ${issue.message}`).join("; ")}`, "Open Map");
    if (action === "Open Map") await vscode.window.showTextDocument(vscode.Uri.file(file));
    return;
  }
  await showPreview(JSON.stringify(payload, null, 2));
  const confirmed = await vscode.window.showInformationMessage(`Send exactly this JSON to ${cloudUrl()}, to your ${picked.space === "personal" ? "personal space" : "team space"}?`, { modal: true }, "Send");
  if (confirmed !== "Send") return;
  const token = await githubToken(true);
  if (token === undefined) return;
  let result;
  try {
    result = await postUpload(cloudUrl(), token, payload);
  } catch (error) {
    const action = await vscode.window.showErrorMessage(`aisus cloud can't be reached: ${(error as Error).message}`, "Try Again");
    if (action === "Try Again") await shareMapCommand(root, file);
    return;
  }
  if (result.ok) {
    void vscode.window.showInformationMessage(`Shared to your ${picked.space === "personal" ? "personal space" : "team space"} in aisus cloud.`);
    return;
  }
  const action = await vscode.window.showErrorMessage(`aisus cloud refused the map: ${result.message}`, "Open aisus cloud");
  if (action === "Open aisus cloud") await openCloudSettings();
}

/** The local architecture maps with an empty focus, newest first, with their hashes and the commits they were drawn at. */
function localMaps(root: string): LocalCandidate[] {
  return listCandidates(root).flatMap((candidate) => {
    if ((readRunRecord(dirname(candidate.file))?.focus ?? "") !== "") return [];
    const map = readJson(candidate.file);
    if (map === undefined) return [];
    const revision = (readJson(join(dirname(candidate.file), FINGERPRINTS_FILE)) as { revision?: unknown } | undefined)?.revision;
    return [{ file: candidate.file, sha256: mapSha256(map), commit: typeof revision === "string" ? revision : null }];
  });
}

/** Writes a pulled map and its sidecars into `.aisus/cloud/<space>-<id>/` and returns its candidate. */
function writePulled(root: string, entry: CloudMap): string {
  ensureGitExclude(root);
  const dir = join(root, CLOUD_DIR, `${entry.space}-${entry.id}`);
  const file = join(dir, "candidate.json");
  mkdirSync(dir, { recursive: true });
  writeJson(file, entry.map);
  if (entry.sidecars?.fingerprints !== undefined) writeJson(join(dir, FINGERPRINTS_FILE), entry.sidecars.fingerprints);
  if (entry.sidecars?.run !== undefined) writeJson(join(dir, RUN_FILE), entry.sidecars.run);
  if (entry.sidecars?.tour !== undefined) writeJson(join(dir, "tour.json"), entry.sidecars.tour);
  return file;
}

/** CLD-16: a cloud map the Maps page lists, with the entry it writes out when opened. */
export interface PulledMap {
  item: CloudMapItem;
  entry: CloudMap;
}

/**
 * CLD-16: the maps aisus cloud holds for `root`'s branch, for the Maps page. They are the team
 * map, the personal map and the default branch's team map, each once. The pull uses an existing
 * GitHub sign-in without asking for one. It returns `null` when it asked the cloud nothing: with
 * the cloud off, no sign-in, or no github.com origin.
 */
export async function branchCloudMaps(root: string): Promise<PulledMap[] | null> {
  if (!cloudEnabled()) return null;
  const context = repoContext(root);
  if (context === null) return null;
  const token = await githubToken(false);
  if (token === undefined) return null;
  const maps = await pullMaps(cloudUrl(), token, context.repo, context.branch);
  const found: [CloudMap | null, string][] = [
    [maps.team, `Team map of ${context.branch}`],
    [maps.personal, `Your personal map of ${context.branch}`],
    [maps.main, `Team map of ${maps.defaultBranch}`],
  ];
  const pulled: PulledMap[] = [];
  for (const [entry, source] of found) {
    if (entry === null || pulled.some((seen) => seen.entry.id === entry.id)) continue;
    const parsed = parseDiagram(JSON.stringify(entry.map));
    const agent = (entry.sidecars?.run as { agent?: unknown } | undefined)?.agent;
    const runFolder = `${entry.space}-${entry.id}`;
    pulled.push({
      entry,
      item: {
        runFolder,
        file: join(root, CLOUD_DIR, runFolder, "candidate.json"),
        title: parsed.ok ? (parsed.diagram.title ?? null) : null,
        focus: "",
        agent: typeof agent === "string" ? agent : null,
        createdAt: entry.createdAt,
        boxes: parsed.ok ? parsed.diagram.components.length : null,
        changed: null,
        source: `${source} at ${entry.commit.slice(0, 7)}`,
      },
    });
  }
  return pulled;
}

/** CLD-16: writes a cloud map from the Maps page into `.aisus/cloud/` and opens it. */
export function openPulled(extensionUri: vscode.Uri, root: string, pulled: PulledMap): void {
  ArchitecturePanel.show(extensionUri, root, writePulled(root, pulled.entry));
}

function staleness(root: string, commit: string | null, head: string): Staleness {
  if (commit === null) return { kind: "unknown" };
  if (commit === head) return { kind: "head" };
  if (!isAncestor(root, commit, head)) return { kind: "elsewhere" };
  const commits = commitsBetween(root, commit, head);
  return commits === null ? { kind: "unknown" } : { kind: "behind", commits };
}

/**
 * CLD-16: opens the map the load order picks for `root`'s branch. Returns `false` when it opened
 * nothing because there is no map anywhere, and `null` when the cloud is off or out of reach, so
 * the caller opens the newest local map as before.
 */
export async function openFromCloud(extensionUri: vscode.Uri, root: string): Promise<boolean | null> {
  if (!cloudEnabled()) return null;
  const context = repoContext(root);
  if (context === null) return null;
  let maps: BranchMaps;
  try {
    const token = await githubToken(true);
    if (token === undefined) return null;
    maps = await pullMaps(cloudUrl(), token, context.repo, context.branch);
  } catch (error) {
    void vscode.window.showWarningMessage(`aisus cloud can't be reached, so the local map opens: ${(error as Error).message}`, "Open Settings").then((action) => {
      if (action === "Open Settings") void vscode.commands.executeCommand("workbench.action.openSettings", "aisus.cloud");
    });
    return null;
  }
  const choice = chooseMap(localMaps(root), maps, (ancestor, of) => isAncestor(root, ancestor, of), context.head);
  if (choice.source === "none") return false;
  if (choice.source === "local") {
    ArchitecturePanel.show(extensionUri, root, choice.local.file);
    void vscode.window.showInformationMessage(`Opened your local map, which isn't in aisus cloud yet, ${stalenessText(choice.local.commit, staleness(root, choice.local.commit, context.head))}.`);
    return true;
  }
  const file = writePulled(root, choice.map);
  ArchitecturePanel.show(extensionUri, root, file);
  const whose = choice.source === "main" ? `the team map of ${maps.defaultBranch} from aisus cloud, as ${context.branch} has none yet` : `${choice.map.space === "personal" ? `your personal map of ${context.branch}` : `the team map of ${context.branch}`} from aisus cloud`;
  void vscode.window.showInformationMessage(`Opened ${whose}, ${stalenessText(choice.map.commit, staleness(root, choice.map.commit, context.head))}.`);
  return true;
}

