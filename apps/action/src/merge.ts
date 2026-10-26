// CLD-17: on a push to the default branch, the Action merges the landed branch's team map into the
// default branch's map and uploads the result. The base is the newest default-branch map drawn at an
// ancestor of the branch map's commit. The merged map gets fingerprints at the pushed commit.
import { actionsOidcToken, postUpload, pullMap, pullMaps } from "@aisus/cloud-client/client";
import { fingerprint } from "@aisus/core/model/fingerprints";
import { collectGitFacts, isAncestor } from "@aisus/core/model/git";
import { mergeMaps, type MergeResult } from "@aisus/core/model/mergeMaps";
import type { MapDoc } from "@aisus/core/model/types";
import { checkUpload, mapPayload } from "@aisus/core/model/upload";
import type { GitHubClient } from "./github";

export interface MergeContext {
  root: string;
  /** `owner/name`. */
  repo: string;
  cloud: string;
  defaultBranch: string;
  /** The pushed commit. */
  after: string;
  client: GitHubClient;
  env: NodeJS.ProcessEnv;
  fetcher?: typeof fetch;
  log: (line: string) => void;
}

/** What a merge did: uploaded a map with its conflicts, or why it uploaded nothing. */
export type MergeOutcome = { uploaded: true; outcome: MergeResult["outcome"]; branch: string; pull: number; conflicts: MergeResult["conflicts"] } | { uploaded: false; reason: string };

export async function mergeOnPush(context: MergeContext): Promise<MergeOutcome> {
  const [pull] = await context.client.mergedPulls(context.after);
  if (pull === undefined) return { uploaded: false, reason: `no merged pull request made ${context.after.slice(0, 7)}` };
  const token = await actionsOidcToken(context.env, context.fetcher);
  const maps = await pullMaps(context.cloud, token, context.repo, pull.headRef, context.fetcher);
  const theirs = maps.team;
  if (theirs === null) return { uploaded: false, reason: `${pull.headRef} has no map in aisus cloud` };
  const ours = maps.main;

  let result: MergeResult;
  if (ours === null) {
    result = { map: theirs.map as MergeResult["map"], outcome: "theirs", conflicts: [] };
  } else {
    const baseRow = maps.mainHistory.find((row) => isAncestor(context.root, row.commit, theirs.commit, context.env)) ?? null;
    if (baseRow === null && isAncestor(context.root, ours.commit, theirs.commit, context.env)) {
      result = { map: theirs.map as MergeResult["map"], outcome: "theirs", conflicts: [] };
    } else {
      const base = baseRow === null ? null : baseRow.id === ours.id ? ours.map : (await pullMap(context.cloud, token, context.repo, baseRow.id, context.fetcher)).map;
      result = mergeMaps(base, ours.map, theirs.map);
    }
  }

  const head = collectGitFacts(context.root, context.env)?.head ?? context.after;
  const prints = fingerprint(result.map as unknown as MapDoc, context.root, head);
  const payload = mapPayload({
    repo: context.repo,
    commit: head,
    branch: context.defaultBranch,
    run: `architecture-merge-${pull.number}`,
    map: result.map,
    record: null,
    sidecars: { fingerprints: prints },
    defaultBranch: context.defaultBranch,
  });
  payload.meta.merge = { branch: pull.headRef, pull: pull.number, conflicts: result.conflicts };
  const issues = checkUpload(payload);
  if (issues.length > 0) return { uploaded: false, reason: `the merged map would be refused: ${issues.map((issue) => `${issue.pointer} ${issue.message}`).join("; ")}` };
  const sent = await postUpload(context.cloud, token, payload, context.fetcher);
  if (!sent.ok) return { uploaded: false, reason: sent.message };
  return { uploaded: true, outcome: result.outcome, branch: pull.headRef, pull: pull.number, conflicts: result.conflicts };
}
