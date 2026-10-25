// `npm run package` (RCH-05): packages the extension in apps/vscode with vsce, writing the .vsix to the
// repository root. The repository's README, notices and LICENSE are copied into the extension folder
// for the package. A LICENSE file is packaged when the repository has one; until then the package is
// made without it.
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(dirname(fileURLToPath(import.meta.url))));

/**
 * vsce's arguments for this repository.
 * @param {boolean} hasLicense
 * @param {string[]} [extra]
 */
export function packageArgs(hasLicense, extra = []) {
  return ["package", "--no-dependencies", ...(hasLicense ? [] : ["--skip-license"]), ...extra];
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const extension = join(root, "apps/vscode");
  const shared = ["README.md", "THIRD_PARTY_NOTICES.md", "LICENSE"].filter((name) => existsSync(join(root, name)));
  for (const name of shared) copyFileSync(join(root, name), join(extension, name));
  try {
    const vsce = join(root, "node_modules/@vscode/vsce/vsce");
    const args = packageArgs(shared.includes("LICENSE"), ["--out", root, ...process.argv.slice(2)]);
    const result = spawnSync(process.execPath, [vsce, ...args], { cwd: extension, stdio: "inherit" });
    process.exitCode = result.status ?? 1;
  } finally {
    for (const name of shared) rmSync(join(extension, name), { force: true });
  }
}
