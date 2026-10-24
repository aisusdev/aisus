// SAF-05: writes stay inside the root and never go through a link.
import { mkdirSync, symlinkSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { assertWritable } from "../../../src/model/confine";
import { put, tempDir } from "../support/temp";

const DIR_LINK = process.platform === "win32" ? "junction" : "dir";

describe("SAF-05 write confinement", () => {
  test("a new nested path and an existing file inside the root are writable", () => {
    const root = tempDir();
    put(root, "aisus.config.json", "{}");
    expect(() => assertWritable(root, join(root, ".archify/run/candidate.json"))).not.toThrow();
    expect(() => assertWritable(root, join(root, "aisus.config.json"))).not.toThrow();
  });

  test.each([
    [".git", ".git/info/exclude"],
    [".devin", ".devin/hooks.v1.json"],
    [".claude", ".claude/skills/aisus-architecture/SKILL.md"],
    [".agents/skills", ".agents/skills/aisus-architecture/SKILL.md"],
    [".archify/architecture-x-20261018-120000", ".archify/architecture-x-20261018-120000/candidate.json"],
    [".aisus/bugfix-x-20261018-120000", ".aisus/bugfix-x-20261018-120000/session.json"],
  ])("%s linked outside the root makes %s unwritable", (linked, target) => {
    const root = tempDir();
    const outside = tempDir();
    mkdirSync(join(root, linked, ".."), { recursive: true });
    symlinkSync(outside, join(root, linked), DIR_LINK);
    expect(() => assertWritable(root, join(root, target))).toThrow(/outside/);
  });

  test("aisus.config.json linked to a file outside the root is unwritable", () => {
    const root = tempDir();
    const outside = put(tempDir(), "elsewhere.json", "{}");
    symlinkSync(outside, join(root, "aisus.config.json"), "file");
    expect(() => assertWritable(root, join(root, "aisus.config.json"))).toThrow(/link/);
  });

  test("a link that stays inside the root is still not written through", () => {
    const root = tempDir();
    const real = put(root, "real.json", "{}");
    symlinkSync(real, join(root, "alias.json"), "file");
    expect(() => assertWritable(root, join(root, "alias.json"))).toThrow(/link/);
  });

  test("a broken link on the way is refused", () => {
    const root = tempDir();
    symlinkSync(join(tempDir(), "missing"), join(root, ".devin"), DIR_LINK);
    expect(() => assertWritable(root, join(root, ".devin/hooks.v1.json"))).toThrow();
  });
});
