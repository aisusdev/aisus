// RCH-05: the extension's package is store-ready, and a tag releases it.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";
import { packageArgs } from "../../tools/scripts/package.mjs";
import { repoRoot } from "./support/sourceScan";

const pkg = JSON.parse(readFileSync(join(repoRoot, "apps/vscode/package.json"), "utf8")) as Record<string, unknown>;

test("RCH-05 package.json carries the store metadata and a PNG icon", () => {
  expect(pkg).toMatchObject({
    icon: "media/icon.png",
    preview: true,
    repository: { type: "git", url: "https://github.com/kerktaiheng/aisus.git" },
    homepage: "https://github.com/kerktaiheng/aisus#readme",
    bugs: { url: "https://github.com/kerktaiheng/aisus/issues" },
    categories: ["Visualization", "AI", "Education"],
  });
  expect(pkg["keywords"]).toContain("architecture");
  const icon = readFileSync(join(repoRoot, "apps/vscode/media/icon.png"));
  expect(icon.subarray(1, 4).toString("latin1")).toBe("PNG");
  expect([icon.readUInt32BE(16), icon.readUInt32BE(20)]).toEqual([128, 128]);
});

test("RCH-05 npm run package skips the licence only while there is no LICENSE, and never the repository", () => {
  const root = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf8")) as { scripts: Record<string, string> };
  expect(root.scripts["package"]).toBe("node tools/scripts/package.mjs");
  expect(packageArgs(false)).toEqual(["package", "--no-dependencies", "--skip-license"]);
  expect(packageArgs(true)).toEqual(["package", "--no-dependencies"]);
  expect(packageArgs(existsSync(join(repoRoot, "LICENSE")))).not.toContain("--allow-missing-repository");
});

test("RCH-05 a v* tag runs the gates and releases the files, and a hyphenated tag is a dry run", () => {
  const release = readFileSync(join(repoRoot, ".github/workflows/release.yml"), "utf8");
  expect(release).toContain('tags: ["v*"]');
  const runs = [...release.matchAll(/- run: (.+)/g)].map((match) => match[1]);
  expect(runs).toEqual(["npm ci", "npm run check", "npm run package", "npm run build:release", "npm run action", "git diff --exit-code apps/action/dist skills"]);
  expect(release).toContain("PRERELEASE: ${{ contains(github.ref_name, '-') }}");
  for (const file of ["aisus-*.vsix", "aisus-skills.zip", "aisus-action.js", "aisus.mjs", "SHA256SUMS"]) expect(release).toContain(file);
  const publishing = release.slice(release.indexOf("- name: GitHub release"));
  expect(publishing.match(/if: env\.PRERELEASE == 'false'/g)).toHaveLength(4);
  expect(publishing).toContain("if: env.PRERELEASE == 'false' && env.OVSX_PAT != '' && env.LICENSED == 'true'");
  expect(publishing).toContain("npx --yes ovsx@1.3.0 publish");
  expect(publishing).toContain("vsce publish --packagePath release/files/aisus-*.vsix --azure-credential");
});

test("RCH-05 the cloud deploys from main once the owner turns it on", () => {
  const deploy = readFileSync(join(repoRoot, ".github/workflows/deploy-cloud.yml"), "utf8");
  expect(deploy).toContain("branches: [main]");
  expect(deploy).toContain("if: vars.AISUS_DEPLOY == 'true'");
  expect([...deploy.matchAll(/- run: (.+)/g)].map((match) => match[1])).toEqual(["npm ci", "npm run -w apps/cloud test", "npm run -w apps/cloud build"]);
});
