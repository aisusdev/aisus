// PRC-04: the aisus check on a pull request. It runs PRC-01 from origin/<base> to HEAD, posts or
// updates one comment marked <!-- aisus-check --> and sets the job result from fail-on. Only with
// `upload` does it send the check and its map to aisus cloud (CLD-09), and only with `refresh` does
// it run an agent to update the map (PRC-05). On a push to the default branch with `upload`, it
// merges the landed branch's map into the default branch's (CLD-17).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { actionsOidcToken, postUpload } from "@aisus/cloud-client/client";
import { runCheck } from "@aisus/core/model/check";
import { FAIL_ON, type FailOn } from "@aisus/core/model/config";
import { COMMENT_MARKER, deltaMarkdown, deltaMermaid } from "@aisus/core/model/deltaMarkdown";
import { collectGitFacts } from "@aisus/core/model/git";
import { CANDIDATE_FILE, MAP_DIR } from "@aisus/core/model/runFolder";
import { checkPayload, checkUpload } from "@aisus/core/model/upload";
import type { GitHubClient } from "./github";
import { mergeOnPush } from "./merge";
import { refreshDecision, refreshLines, runRefresh } from "./refresh";

/** Items per list in the comment; GitHub caps a comment at 65,536 characters. */
export const COMMENT_ITEMS = 30;

export interface ActionContext {
  /** The workflow's environment: `INPUT_*`, `GITHUB_*`. */
  env: NodeJS.ProcessEnv;
  /** The checked-out repository. */
  root: string;
  /** The `pull_request` event payload. */
  event: unknown;
  client: GitHubClient;
  log: (line: string) => void;
  /** The network for the cloud upload; the tests replace it. */
  fetcher?: typeof fetch;
}

export interface ActionResult {
  exitCode: 0 | 1;
  result: "pass" | "fail" | "error";
  /** The comment's body, when one was written. */
  comment: string | null;
}

function input(env: NodeJS.ProcessEnv, name: string): string {
  return (env[`INPUT_${name.toUpperCase()}`] ?? "").trim();
}

function pullRequest(event: unknown): { number: number; baseRef: string; headRef: string; defaultBranch: string | undefined } | null {
  const typed = event as { pull_request?: { number?: unknown; base?: { ref?: unknown }; head?: { ref?: unknown } }; repository?: { default_branch?: unknown } } | null;
  const pull = typed?.pull_request;
  if (typeof pull?.number !== "number" || typeof pull.base?.ref !== "string") return null;
  const defaultBranch = typed?.repository?.default_branch;
  return { number: pull.number, baseRef: pull.base.ref, headRef: typeof pull.head?.ref === "string" ? pull.head.ref : pull.base.ref, defaultBranch: typeof defaultBranch === "string" ? defaultBranch : undefined };
}

/**
 * CLD-09: uploads the check and the map it compared with, signed by the job's OIDC token, and
 * returns the pull request page's address, or why it did not upload.
 */
async function uploadCheck(context: ActionContext, pull: NonNullable<ReturnType<typeof pullRequest>>, report: unknown, run: string): Promise<{ ok: true; page: string } | { ok: false; reason: string }> {
  const cloud = input(context.env, "cloud-url") || context.env["AISUS_CLOUD_URL"] || "";
  const repo = context.env["GITHUB_REPOSITORY"] ?? "";
  if (cloud === "") return { ok: false, reason: "upload needs the cloud-url input." };
  const head = collectGitFacts(context.root)?.head;
  if (head === undefined) return { ok: false, reason: "upload needs the checked-out commit." };
  const map: unknown = JSON.parse(readFileSync(join(context.root, MAP_DIR, run, CANDIDATE_FILE), "utf8"));
  const payload = checkPayload({ repo, commit: head, branch: pull.headRef, pull: pull.number, check: report, map, run, ...(pull.defaultBranch ? { defaultBranch: pull.defaultBranch } : {}) });
  const issues = checkUpload(payload);
  if (issues.length > 0) return { ok: false, reason: `the upload would be refused: ${issues.map((issue) => `${issue.pointer} ${issue.message}`).join("; ")}` };
  const token = await actionsOidcToken(context.env, context.fetcher);
  const result = await postUpload(cloud, token, payload, context.fetcher);
  if (!result.ok) return { ok: false, reason: result.message };
  return { ok: true, page: `${cloud.replace(/\/+$/, "")}/${repo}/pull/${pull.number}` };
}

/** CLD-17: a push event's branch, pushed commit and default branch, or `null`. */
function pushEvent(event: unknown): { branch: string; after: string; defaultBranch: string } | null {
  const typed = event as { ref?: unknown; after?: unknown; repository?: { default_branch?: unknown } } | null;
  if (typeof typed?.ref !== "string" || !typed.ref.startsWith("refs/heads/") || typeof typed.after !== "string" || typeof typed.repository?.default_branch !== "string") return null;
  return { branch: typed.ref.slice("refs/heads/".length), after: typed.after, defaultBranch: typed.repository.default_branch };
}

/** CLD-17: on a push to the default branch with `upload`, the landed branch's map merged into the default branch's. */
async function runMerge(context: ActionContext, push: NonNullable<ReturnType<typeof pushEvent>>): Promise<ActionResult> {
  if (push.branch !== push.defaultBranch) {
    context.log(`Maps merge on pushes to ${push.defaultBranch} only; this push is to ${push.branch}.`);
    return { exitCode: 0, result: "pass", comment: null };
  }
  if (input(context.env, "upload") !== "true") {
    context.log("Maps merge only with upload: true.");
    return { exitCode: 0, result: "pass", comment: null };
  }
  const cloud = input(context.env, "cloud-url") || context.env["AISUS_CLOUD_URL"] || "";
  if (cloud === "") {
    context.log("Merging maps needs the cloud-url input.");
    return { exitCode: 1, result: "error", comment: null };
  }
  const outcome = await mergeOnPush({ root: context.root, repo: context.env["GITHUB_REPOSITORY"] ?? "", cloud, defaultBranch: push.defaultBranch, after: push.after, client: context.client, env: context.env, ...(context.fetcher ? { fetcher: context.fetcher } : {}), log: context.log }).catch(
    (error: unknown) => ({ uploaded: false as const, reason: error instanceof Error ? error.message : String(error) }),
  );
  if (!outcome.uploaded) {
    context.log(`No merged map uploaded: ${outcome.reason}.`);
    return { exitCode: 0, result: "pass", comment: null };
  }
  const conflicts = outcome.conflicts.length === 0 ? "" : ` ${outcome.conflicts.length} ${outcome.conflicts.length === 1 ? "element conflicted and keeps" : "elements conflicted and keep"} ${push.defaultBranch}'s version: ${outcome.conflicts.map((conflict) => conflict.name).join(", ")}.`;
  context.log(`Merged the map of ${outcome.branch} (#${outcome.pull}) into ${push.defaultBranch}'s map.${conflicts}`);
  return { exitCode: 0, result: "pass", comment: null };
}

export async function runAction(context: ActionContext): Promise<ActionResult> {
  const push = pushEvent(context.event);
  if (push !== null) return runMerge(context, push);
  const pull = pullRequest(context.event);
  if (pull === null) {
    context.log("aisus check runs on pull_request events and on pushes to the default branch; this event is neither.");
    return { exitCode: 1, result: "error", comment: null };
  }
  const failOn = input(context.env, "fail-on").split(",").map((entry) => entry.trim()).filter((entry) => entry !== "");
  if (!failOn.every((entry) => (FAIL_ON as readonly string[]).includes(entry))) {
    context.log(`fail-on takes ${FAIL_ON.join(", ")}.`);
    return { exitCode: 1, result: "error", comment: null };
  }
  const map = input(context.env, "map");
  const outcome = runCheck({ root: context.root, base: `origin/${pull.baseRef}`, head: "HEAD", ...(map === "" ? {} : { map }), failOn: failOn as FailOn[] });
  if (!outcome.ok) {
    context.log(outcome.reason);
    return { exitCode: 1, result: "error", comment: null };
  }
  const { report, diagram } = outcome;
  let page: string | null = null;
  if (input(context.env, "upload") === "true") {
    const uploaded = await uploadCheck(context, pull, report, report.map).catch((error: unknown) => ({ ok: false as const, reason: error instanceof Error ? error.message : String(error) }));
    if (uploaded.ok) page = uploaded.page;
    else context.log(`Not uploaded: ${uploaded.reason}`);
  }
  let update: string[] = [];
  const decision = refreshDecision({ refresh: input(context.env, "refresh"), env: context.env, event: context.event, report, components: diagram.components, head: collectGitFacts(context.root)?.head ?? null });
  if (decision.run) {
    const outcome = runRefresh({ root: context.root, map: report.map, agent: decision.agent, paths: decision.paths, headRef: pull.headRef, skillSource: join(__dirname, "..", "..", "skills", "aisus-refresh"), env: context.env });
    update = refreshLines(outcome);
    context.log(outcome.ok ? `Map updated in ${outcome.run}.` : `Map not updated: ${outcome.reason}`);
  } else if (decision.reason !== null) {
    update = refreshLines({ ok: false, reason: decision.reason });
    context.log(`Map not updated: ${decision.reason}`);
  }
  const chart = deltaMermaid(report, diagram);
  const link = page === null ? [] : ["", `[See it on the map in aisus cloud](${page})`];
  const body = [COMMENT_MARKER, deltaMarkdown(report, report, COMMENT_ITEMS).trimEnd(), ...update, ...link, ...(chart === null ? [] : ["", chart])].join("\n");

  if (input(context.env, "comment") !== "false") {
    const existing = (await context.client.listComments(pull.number)).find((comment) => comment.body.startsWith(COMMENT_MARKER));
    if (existing) await context.client.updateComment(existing.id, body);
    else await context.client.createComment(pull.number, body);
  }
  context.log(`aisus check: ${report.result}${report.reasons.length > 0 ? ` (${report.reasons.join("; ")})` : ""}`);
  return { exitCode: report.result === "pass" ? 0 : 1, result: report.result, comment: body };
}
