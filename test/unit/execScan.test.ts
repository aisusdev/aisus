// SAF-02: the skill scripts start no program named by their arguments and never use a shell.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";
import { repoRoot, sourceFiles } from "./support/sourceScan";

/** Programs a spawn may start, per file. Git and the setup check resolve theirs from absolute PATH entries. */
const ALLOWED_PROGRAMS: Record<string, string[]> = { "*": ["process.execPath"], "packages/core/model/git.ts": ["program"], "packages/core/model/preflight.ts": ["binary"] };

function execViolations(file: string, source: string): string[] {
  const violations: string[] = [];
  if (/\bshell\s*:\s*true\b/.test(source)) violations.push(`${file}: shell: true`);
  const allowed = [...ALLOWED_PROGRAMS["*"]!, ...(ALLOWED_PROGRAMS[file] ?? [])];
  for (const match of source.matchAll(/(?<![.\w])(spawnSync|spawn|execFileSync|execFile|execSync|exec)\s*\(\s*([^,)\s]+)/g)) {
    if (!allowed.includes(match[2]!)) violations.push(`${file}: ${match[1]}(${match[2]})`);
  }
  return violations;
}

test("SAF-02 packages/core/agent and packages/core/model spawn only node itself or the resolved git", () => {
  const files = [...sourceFiles("packages/core/agent"), ...sourceFiles("packages/core/model")];
  const violations = files.flatMap((file) => execViolations(file, readFileSync(join(repoRoot, file), "utf8")));
  expect(violations).toEqual([]);
});

test("SAF-02 the scan flags a shell, a caller-named program and an exec string", () => {
  expect(execViolations("packages/core/agent/x.ts", 'spawnSync(command, { shell: true });\nexecSync("rm -rf " + dir);\npattern.exec(text);')).toEqual([
    "packages/core/agent/x.ts: shell: true",
    "packages/core/agent/x.ts: spawnSync(command)",
    'packages/core/agent/x.ts: execSync("rm)',
  ]);
});
