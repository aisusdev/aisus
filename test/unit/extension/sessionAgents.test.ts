// LRN-01: Start Learning offers Claude Code and Codex as well as Devin, and launches each with the
// skill prompt alone.
import { expect, test } from "vitest";
import { sessionAgents, sessionArgs } from "../../../apps/vscode/src/sessionAgents";
import { executable, tempDir } from "../support/temp";

test("LRN-01 Claude Code, Codex and Devin on PATH are offered in that order", () => {
  const bin = tempDir();
  const [devin, codex, claude] = ["devin", "codex", "claude"].map((name) => executable(bin, name));
  expect(sessionAgents({ PATH: bin, HOME: tempDir() }, () => false).map((entry) => [entry.label, entry.binary])).toEqual([
    ["Claude Code", claude],
    ["Codex", codex],
    ["Devin", devin],
  ]);
});

test("LRN-01 each agent's terminal gets the skill prompt alone, after -- for Devin", () => {
  expect(sessionArgs("claude", " add a helper ")).toEqual(["/aisus-bugfix add a helper"]);
  expect(sessionArgs("codex", "add a helper")).toEqual(["$aisus-bugfix add a helper"]);
  expect(sessionArgs("devin", "add a helper")).toEqual(["--", "/aisus-bugfix add a helper"]);
});
