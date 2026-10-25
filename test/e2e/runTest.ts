import { runTests } from "@vscode/test-electron";
import { existsSync, mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join, resolve } from "node:path";

// The VS Code builds the [e2e] suite runs against: the engines.vscode floor and the latest stable.
const VSCODE_VERSIONS = ["1.126.0", "1.141.0"];

/**
 * Each scenario launches its own VS Code with a fresh profile and runs the suite files
 * named `<scenario>.*.test.js`.
 */
const SCENARIOS: { name: string; workspace(base: string): string | undefined }[] = [
  {
    name: "single",
    workspace: (base) => {
      const folder = join(base, "repo");
      mkdirSync(folder);
      return folder;
    },
  },
  { name: "empty", workspace: () => undefined },
  {
    name: "multi",
    workspace: (base) => {
      for (const name of ["alpha", "beta"]) mkdirSync(join(base, name));
      const file = join(base, "two.code-workspace");
      writeFileSync(file, JSON.stringify({ folders: [{ path: "alpha" }, { path: "beta" }] }));
      return file;
    },
  },
];

/** The agent CLIs the extension looks for. Each test puts its own stubs on PATH. */
const AGENT_CLIS = ["claude", "codex", "devin"];

/** The programs the suite needs on PATH, which may share a folder with an agent CLI. */
const TOOLS = ["git", "node"];

/**
 * PATH for the VS Code under test: the runner's PATH without the folders that hold a real agent
 * CLI, so a test finds only the agents it stubs. Each tool stays reachable through a link in `bin`.
 */
function testPath(bin: string): string {
  const file = (dir: string, name: string): string | undefined => ["", ".exe", ".cmd"].map((ext) => name + ext).find((entry) => existsSync(join(dir, entry)));
  const dirs = (process.env["PATH"] ?? "").split(delimiter).filter((dir) => dir !== "");
  const kept = dirs.filter((dir) => !AGENT_CLIS.some((cli) => file(dir, cli)));
  for (const tool of TOOLS) {
    const dir = dirs.find((entry) => file(entry, tool));
    if (dir === undefined || kept.some((entry) => file(entry, tool))) continue;
    const name = file(dir, tool)!;
    symlinkSync(join(dir, name), join(bin, name));
  }
  return [bin, ...kept].join(delimiter);
}

async function main(): Promise<void> {
  // Bundled to out/e2e/runTest.js, so the repo root is two levels up.
  const extensionDevelopmentPath = resolve(__dirname, "../..");
  const extensionTestsPath = resolve(__dirname, "suite/index.js");
  const only = process.argv[2];
  const runs = VSCODE_VERSIONS.flatMap((version) => SCENARIOS.map((scenario) => ({ version, scenario })));
  for (const { version, scenario } of runs) {
    if (only && scenario.name !== only) continue;
    const base = realpathSync(mkdtempSync(join(tmpdir(), `aisus-e2e-${scenario.name}-`)));
    // VS Code puts its IPC socket in the user-data dir; macOS caps socket paths at 104 bytes,
    // which the per-user tmpdir (/var/folders/…) would exceed.
    const userData = mkdtempSync(join(process.platform === "win32" ? tmpdir() : "/tmp", "aisus-ud-"));
    const workspace = scenario.workspace(base);
    // aisus runs git itself. VS Code's git extension, left on, threw an uncaught EPIPE from
    // `git check-ignore` when a test's folder went away, and failed whichever test was running.
    mkdirSync(join(userData, "User"), { recursive: true });
    writeFileSync(join(userData, "User", "settings.json"), `${JSON.stringify({ "git.enabled": false })}\n`);
    // Skills install per user by default (SET-01), so each launch gets its own home folder.
    const home = mkdtempSync(join(tmpdir(), "aisus-home-"));
    const bin = mkdtempSync(join(tmpdir(), "aisus-bin-"));
    console.log(`\n=== e2e VS Code ${version}, scenario: ${scenario.name} ===`);
    try {
      await runTests({
        version,
        extensionDevelopmentPath,
        extensionTestsPath,
        extensionTestsEnv: { AISUS_E2E_SCENARIO: scenario.name, HOME: home, USERPROFILE: home, PATH: testPath(bin) },
        launchArgs: [
          ...(workspace ? [workspace] : []),
          `--user-data-dir=${userData}`,
          "--disable-extensions",
          "--skip-welcome",
          "--skip-release-notes",
          // VS Code runs with the temporary HOME too, and macOS finds no keychain there. Secrets stay
          // in memory and Chromium uses a mock keychain, so no "keychain not found" dialog opens.
          "--use-inmemory-secretstorage",
          "--use-mock-keychain",
          // VS Code keeps the PATH given here rather than adding the login shell's.
          "--force-disable-user-env",
        ],
      });
    } finally {
      rmSync(base, { recursive: true, force: true });
      rmSync(home, { recursive: true, force: true });
      rmSync(bin, { recursive: true, force: true });
      rmSync(userData, { recursive: true, force: true });
    }
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
