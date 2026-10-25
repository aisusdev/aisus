// NFR-QUAL-03: packages/core/model and packages/core/layout stay free of `vscode`; the browser-safe modules
// (all of packages/core/layout, model types/tolerant/checks) use no Node built-ins at all; only the
// listed model modules may touch the file system, paths or child processes.
import { builtinModules } from "node:module";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { importSpecifiers, repoRoot, sourceFiles } from "./support/sourceScan";

const BROWSER_SAFE_MODEL: Record<string, true> = {
  "packages/core/model/types.ts": true,
  "packages/core/model/tolerant.ts": true,
  "packages/core/model/checks.ts": true,
  "packages/core/model/home.ts": true,
  "packages/core/model/citing.ts": true,
  "packages/core/model/ask.ts": true,
  "packages/core/model/changes.ts": true,
  "packages/core/model/refresh.ts": true,
  "packages/core/model/evidence.ts": true,
  "packages/core/model/citationPath.ts": true,
  "packages/core/model/deny.ts": true,
  "packages/core/model/openLinks.ts": true,
  "packages/core/model/config.ts": true,
  "packages/core/model/ownership.ts": true,
  "packages/core/model/delta.ts": true,
  "packages/core/model/deltaMarkdown.ts": true,
};
const NODE_MODEL: Record<string, true> = {
  "packages/core/model/citations.ts": true,
  "packages/core/model/git.ts": true,
  "packages/core/model/runFolder.ts": true,
  "packages/core/model/discovery.ts": true,
  "packages/core/model/session.ts": true,
  "packages/core/model/confine.ts": true,
  "packages/core/model/which.ts": true,
  "packages/core/model/integrity.ts": true,
  "packages/core/model/runRecord.ts": true,
  "packages/core/model/preflight.ts": true,
  "packages/core/model/maps.ts": true,
  "packages/core/model/fingerprints.ts": true,
  "packages/core/model/staleness.ts": true,
  "packages/core/model/page.ts": true,
  "packages/core/model/check.ts": true,
  "packages/core/model/repoSize.ts": true,
  "packages/core/model/agentHome.ts": true,
};
const NODE_ALLOWED: Record<string, true> = {
  "node:fs": true,
  "node:fs/promises": true,
  "node:path": true,
  "node:child_process": true,
  "node:crypto": true,
};

function isNodeBuiltin(specifier: string): boolean {
  return specifier.startsWith("node:") || builtinModules.includes(specifier.split("/")[0]!);
}

/** Boundary violations for one file of packages/core/model or packages/core/layout. */
function boundaryViolations(file: string, source: string): string[] {
  const violations: string[] = [];
  const browserSafe = file.startsWith("packages/core/layout/") || BROWSER_SAFE_MODEL[file] === true;
  for (const specifier of importSpecifiers(source)) {
    if (specifier === "vscode") {
      violations.push(`${file}: imports vscode`);
    } else if (isNodeBuiltin(specifier)) {
      if (browserSafe) violations.push(`${file}: browser-safe module imports ${specifier}`);
      else if (!NODE_MODEL[file]) violations.push(`${file}: imports ${specifier} outside the listed Node modules`);
      else if (!NODE_ALLOWED[specifier]) violations.push(`${file}: imports ${specifier}; only fs, path, child_process, crypto are allowed`);
    } else if (specifier.startsWith("@aisus/")) {
      violations.push(`${file}: imports ${specifier} outside its allowed layers`);
    } else if (specifier.startsWith(".")) {
      const target = join(file, "..", specifier).split("\\").join("/");
      const allowedPrefixes = file.startsWith("packages/core/layout/") ? ["packages/core/layout/", "packages/core/model/"] : ["packages/core/model/"];
      if (!allowedPrefixes.some((prefix) => target.startsWith(prefix))) {
        violations.push(`${file}: imports ${specifier} outside its allowed layers`);
      }
    }
  }
  return violations;
}

describe("NFR-QUAL-03 module boundaries", () => {
  test("packages/core/model and packages/core/layout respect the boundaries", () => {
    const files = [...sourceFiles("packages/core/model"), ...sourceFiles("packages/core/layout")];
    const violations = files.flatMap((file) => boundaryViolations(file, readFileSync(join(repoRoot, file), "utf8")));
    expect(violations).toEqual([]);
  });

  test.each([
    ["packages/core/layout/scene.ts", 'import * as vscode from "vscode";'],
    ["packages/core/layout/scene.ts", 'import { readFileSync } from "node:fs";'],
    ["packages/core/layout/scene.ts", 'import path from "path";'],
    ["packages/core/model/types.ts", 'export { x } from "node:path";'],
    ["packages/core/model/tolerant.ts", 'const fs = require("fs");'],
    ["packages/core/model/schema.ts", 'import { readFileSync } from "node:fs";'],
    ["packages/core/model/citations.ts", 'import { createServer } from "node:http";'],
    // Dynamic import on purpose: the scanner must also catch `import()` of a built-in.
    ["packages/core/model/checks.ts", 'const m = await import("node:os");'],
    ["packages/core/model/git.ts", 'import type { ExtensionContext } from "vscode";'],
    ["packages/core/model/schema.ts", 'import { panel } from "../extension/panel";'],
    ["packages/core/layout/elk.ts", 'import { render } from "../../viewer/render";'],
    ["packages/core/layout/elk.ts", 'import { render } from "@aisus/viewer/render";'],
  ])("%s rejects %s", (file, source) => {
    expect(boundaryViolations(file, source)).toHaveLength(1);
  });

  test.each([
    ["packages/core/model/citations.ts", 'import { realpathSync } from "node:fs";'],
    ["packages/core/model/git.ts", 'import { spawnSync } from "node:child_process";'],
    ["packages/core/model/schema.ts", 'import Ajv2020 from "ajv/dist/2020";'],
    ["packages/core/layout/elk.ts", 'import ELK from "elkjs/lib/elk.bundled.js";'],
    ["packages/core/layout/elk.ts", 'import type { ArchifyDoc } from "../model/types";'],
  ])("%s allows %s", (file, source) => {
    expect(boundaryViolations(file, source)).toEqual([]);
  });
});
