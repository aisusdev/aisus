// FR-GEN-01 prompt formats and CLI lookup on PATH.
import { mkdirSync } from "node:fs";
import { basename, delimiter, join } from "node:path";
import { describe, expect, test } from "vitest";
import { agentPrompt, AGENTS, findOnPath } from "@aisus/core/model/agents";
import { executable, put, tempDir } from "../support/temp";

const [claude, codex] = AGENTS as [(typeof AGENTS)[number], (typeof AGENTS)[number]];

describe("FR-GEN-01 prompt", () => {
  test.each([
    [claude, "Payment flow", "/aisus-architecture Payment flow"],
    [claude, "", "/aisus-architecture"],
    [claude, "   ", "/aisus-architecture"],
    [codex, " auth service ", "$aisus-architecture auth service"],
    [codex, "", "$aisus-architecture"],
  ])("%o with focus %j → %j", (agent, focus, expected) => {
    expect(agentPrompt(agent, focus)).toBe(expected);
  });

  test("RCH-04 the agents are Claude Code, Codex and Devin, in that order", () => {
    expect(AGENTS.map((agent) => [agent.label, agent.cli])).toEqual([
      ["Claude Code", "claude"],
      ["Codex", "codex"],
      ["Devin", "devin"],
    ]);
  });
});

describe("FR-GEN-01 PATH lookup", () => {
  test("finds the first executable match in PATH order", () => {
    const [a, b] = [tempDir(), tempDir()];
    executable(b, "claude");
    const first = executable(a, "claude");
    expect(findOnPath("claude", { PATH: [a, b].join(delimiter) })).toBe(first);
  });

  test("skips folders and empty entries", () => {
    const [folder, good] = [tempDir(), tempDir()];
    const expected = executable(good, "codex");
    mkdirSync(join(folder, basename(expected)));
    expect(findOnPath("codex", { PATH: ["", folder, good].join(delimiter) })).toBe(expected);
  });

  test.skipIf(process.platform === "win32")("skips a file without the executable bit (Windows has no such bit)", () => {
    const [plain, good] = [tempDir(), tempDir()];
    put(plain, "codex", "not executable");
    const expected = executable(good, "codex");
    expect(findOnPath("codex", { PATH: `${plain}:${good}` }, "linux")).toBe(expected);
  });

  test("returns undefined when absent or PATH is unset", () => {
    expect(findOnPath("claude", { PATH: tempDir() }, "darwin")).toBeUndefined();
    expect(findOnPath("claude", {}, "darwin")).toBeUndefined();
  });

  test("on Windows passes over a file without an extension and finds one with a PATHEXT extension in a later folder", () => {
    const [bare, later] = [tempDir(), tempDir()];
    put(bare, "claude", "#!/bin/sh\n");
    const cmd = put(later, "claude.CMD", "@echo off\n");
    expect(findOnPath("claude", { Path: `${bare};${later}`, PATHEXT: ".EXE;.CMD" }, "win32")).toBe(cmd);
  });

  test("on Windows tries each PATHEXT extension", () => {
    const dir = tempDir();
    const cmd = put(dir, "claude.CMD", "@echo off\n");
    expect(findOnPath("claude", { Path: dir, PATHEXT: ".EXE;.CMD" }, "win32")).toBe(cmd);
  });
});
