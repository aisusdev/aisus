// RCH-02: the release's Claude Code plugin carries the map skills as committed, with its plugin and
// marketplace manifests.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";
import { buildRelease, PLUGIN_SKILLS } from "../../tools/scripts/release.mjs";
import { repoRoot } from "./support/sourceScan";
import { tempDir } from "./support/temp";

test("RCH-02 ACC-05 SKL-02 build:release assembles the plugin with its manifests and the committed skills", () => {
  const plugin = buildRelease(tempDir());
  const pkg = JSON.parse(readFileSync(join(repoRoot, "apps/vscode/package.json"), "utf8")) as { version: string };
  const manifest = JSON.parse(readFileSync(join(plugin, ".claude-plugin/plugin.json"), "utf8"));
  expect(manifest).toMatchObject({ name: "aisus", version: pkg.version, author: { name: "aisus" } });
  expect(manifest.description).toMatch(/^Architecture maps/);
  const marketplace = JSON.parse(readFileSync(join(plugin, ".claude-plugin/marketplace.json"), "utf8"));
  expect(marketplace).toMatchObject({ name: "aisus", owner: { name: "aisus" }, plugins: [{ name: "aisus", source: "./", version: pkg.version }] });
  expect(PLUGIN_SKILLS).toEqual(["aisus-architecture", "aisus-refresh", "aisus-audit", "aisus-tour"]);
  const files: Record<string, string[]> = {
    "aisus-architecture": ["SKILL.md", "scripts/validate.mjs", "scripts/render-html.mjs", "references/map-format.md"],
    "aisus-refresh": ["SKILL.md", "scripts/validate.mjs", "scripts/render-html.mjs", "references/map-format.md"],
    "aisus-audit": ["SKILL.md", "agents/openai.yaml", "scripts/audit-record.mjs"],
    "aisus-tour": ["SKILL.md", "agents/openai.yaml", "scripts/tour-record.mjs"],
  };
  for (const name of PLUGIN_SKILLS) {
    for (const file of files[name]!) {
      expect(readFileSync(join(plugin, "skills", name, file), "utf8"), `${name}/${file}`).toBe(readFileSync(join(repoRoot, "skills", name, file), "utf8"));
    }
  }
});
