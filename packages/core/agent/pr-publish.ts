// `node <skill>/scripts/pr-publish.mjs --pull <n> --base <branch> [--run <run>] [--dry-run]`, run with
// cwd = repo root (PRC-07): uploads one diagram of a pull request to aisus cloud, signed with
// AISUS_TOKEN, and prints the diagram's page and image addresses. With `--run` the diagram is that
// accepted `pull` run, with its instructions. Without it, the diagram is the main map with the pull
// request's check from `origin/<base>`. The upload is checked before anything is sent, and
// `--dry-run` prints it and sends nothing. Only packages/cloud-client sends.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { postUpload } from "@aisus/cloud-client/client";
import { REVISION_PATTERN } from "../model/changes";
import { mainMap, runCheck } from "../model/check";
import { collectGitFacts, currentBranch } from "../model/git";
import { CANDIDATE_FILE, MAP_DIR } from "../model/runFolder";
import { readRunRecord } from "../model/runRecord";
import { checkUpload, diagramPayload, githubSlug } from "../model/upload";

const USAGE = "pr-publish.mjs: usage: node pr-publish.mjs --pull <n> --base <branch> [--run <run>] [--dry-run]\n";

function print(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function fail(message: string, code: 1 | 2 = 2): number {
  process.stderr.write(`pr-publish.mjs: ${message}\n`);
  return code;
}

async function main(args: string[], env: NodeJS.ProcessEnv): Promise<number> {
  const options = new Map<string, string>();
  let dryRun = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--dry-run") {
      dryRun = true;
      continue;
    }
    const value = args[i + 1];
    if (value === undefined || !["--pull", "--base", "--run"].includes(args[i]!) || options.has(args[i]!)) return fail(USAGE.trimEnd().replace(/^pr-publish\.mjs: /, ""));
    options.set(args[i]!, value);
    i++;
  }
  const pull = Number(options.get("--pull"));
  const base = options.get("--base") ?? "";
  const run = options.get("--run");
  if (!Number.isInteger(pull) || pull < 1 || base === "" || !REVISION_PATTERN.test(`origin/${base}`) || (run !== undefined && !/^architecture-[A-Za-z0-9._-]+$/.test(run))) {
    return fail(USAGE.trimEnd().replace(/^pr-publish\.mjs: /, ""));
  }
  const root = process.cwd();
  const git = collectGitFacts(root, env);
  const repo = git?.origin ? githubSlug(git.origin) : null;
  const branch = currentBranch(root, env);
  if (git === null || repo === null) return fail("publishing needs a git repository with a github.com origin.");
  if (branch === null) return fail("publishing needs the pull request's branch checked out.");

  let payload;
  if (run !== undefined) {
    const dir = join(root, MAP_DIR, run);
    const record = readRunRecord(dir);
    if (record?.kind !== "pull") return fail(`${MAP_DIR}/${run} is no pull request diagram.`);
    let map: unknown;
    try {
      map = JSON.parse(readFileSync(join(dir, CANDIDATE_FILE), "utf8"));
    } catch (error) {
      return fail(`${MAP_DIR}/${run} has no accepted diagram yet: ${(error as Error).message}`);
    }
    payload = diagramPayload({ repo, commit: git.head, branch, pull, map, run, ...(record.focus ? { instructions: record.focus } : {}) });
  } else {
    const main = mainMap(root);
    if (main === null) return fail("there is no main map to show the changes on. Generate one with an empty focus first.");
    const outcome = runCheck({ root, base: `origin/${base}`, head: "HEAD", map: main });
    if (!outcome.ok) return fail(outcome.reason);
    const map: unknown = JSON.parse(readFileSync(join(root, MAP_DIR, main, CANDIDATE_FILE), "utf8"));
    payload = diagramPayload({ repo, commit: git.head, branch, pull, map, run: main, check: outcome.report });
  }
  const issues = checkUpload(payload);
  if (issues.length > 0) {
    print({ status: "refused", message: "The upload would be refused, so nothing was sent.", issues });
    return 1;
  }
  const cloud = env["AISUS_CLOUD_URL"];
  if (dryRun) {
    print({ status: "dry-run", url: cloud ?? null, payload });
    return 0;
  }
  const token = env["AISUS_TOKEN"];
  if (!cloud) return fail("publishing needs AISUS_CLOUD_URL, such as https://aisus.dev.");
  if (!token) return fail("publishing needs an upload token in AISUS_TOKEN, from the repository's settings in aisus cloud.");
  let result;
  try {
    result = await postUpload(cloud, token, payload);
  } catch (error) {
    return fail(`cannot reach ${cloud}: ${(error as Error).message}`);
  }
  if (!result.ok) {
    print({ status: "rejected", httpStatus: result.status, message: result.message });
    return 1;
  }
  const body = result.body as { url?: unknown; image?: unknown };
  const site = cloud.replace(/\/+$/, "");
  const address = (value: unknown): string | null => (typeof value === "string" && value.startsWith("/") ? `${site}${value}` : null);
  print({ status: "published", page: address(body.url), image: address(body.image) });
  return 0;
}

main(process.argv.slice(2), process.env).then(
  (code) => {
    process.exitCode = code;
  },
  (error: unknown) => {
    process.stderr.write(`pr-publish.mjs: ${(error as Error).message}\n`);
    process.exitCode = 2;
  },
);
