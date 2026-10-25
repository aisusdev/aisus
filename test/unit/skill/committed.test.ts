// RCH-02: the skills are committed with their built scripts, so `npx skills add` copies working
// skills. The committed scripts equal a fresh build, and the refresh skill carries the shared
// format reference.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";
import { TEST_DIST } from "../support/buildScripts";
import { repoRoot } from "../support/sourceScan";

const SCRIPTS: Record<string, string[]> = {
  "aisus-architecture": ["match-ids.mjs", "render-html.mjs", "repo-facts.mjs", "validate.mjs"],
  "aisus-audit": ["audit-record.mjs"],
  "aisus-bugfix": ["session-hook.mjs", "session.mjs"],
  "aisus-refresh": ["refresh-facts.mjs", "render-html.mjs", "validate.mjs"],
  "aisus-tour": ["tour-record.mjs"],
};

test.each(Object.entries(SCRIPTS))("RCH-02 ACC-05 SKL-02 %s's committed scripts are what the build makes now", (name, scripts) => {
  expect(readdirSync(join(repoRoot, "skills", name, "scripts")).sort()).toEqual(scripts);
  for (const script of scripts) {
    const committed = readFileSync(join(repoRoot, "skills", name, "scripts", script), "utf8");
    expect(committed === readFileSync(join(TEST_DIST, "skills", name, "scripts", script), "utf8"), `${name}/scripts/${script} is stale; run npm run build`).toBe(true);
  }
});

test("RCH-02 the refresh skill's references are the architecture skill's", () => {
  const reference = (name: string): string => readFileSync(join(repoRoot, "skills", name, "references/archify-format.md"), "utf8");
  expect(reference("aisus-refresh")).toBe(reference("aisus-architecture"));
});
