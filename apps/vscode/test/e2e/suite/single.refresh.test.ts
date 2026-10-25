// FRS-06: Refresh runs the refresh skill on the shown map from the map's title bar, its freshness
// header, the maps list and a box's menu, and falls back to Generate without a map.
import * as assert from "node:assert/strict";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { dirname, join } from "node:path";
import * as vscode from "vscode";
import type { TestHook } from "../../../src/extension";
import { skillTargets, writeSkill } from "@aisus/core/install/skillFiles";
import { afterEstimate, stubUi, type UiStubs } from "../stubs";
import { setup, suite, suiteSetup, teardown, test } from "../tdd";
import { until } from "../until";

const RUN = "architecture-refresh-20261018-120000";

function write(root: string, rel: string, content: string): string {
  const path = join(root, rel);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
  return path;
}

function nextTerminal(): Promise<vscode.Terminal> {
  const { promise, resolve } = Promise.withResolvers<vscode.Terminal>();
  const subscription = vscode.window.onDidOpenTerminal((terminal) => {
    subscription.dispose();
    resolve(terminal);
  });
  return promise;
}

suite("FRS-06 Refresh from the UI", () => {
  let hook: TestHook;
  let ui: UiStubs;
  let root: string;
  let candidate: string;
  let savedPath: string | undefined;
  const cleanup: string[] = [];
  const terminals: vscode.Terminal[] = [];

  function installSkills(...names: string[]): void {
    const extensionPath = vscode.extensions.getExtension("aisus.aisus")!.extensionPath;
    for (const name of names) writeSkill(homedir(), join(extensionPath, "dist/skills", name), skillTargets(homedir(), name), name);
  }

  /** Runs `action` and returns the argument the terminal it opens passes to the agent. */
  async function launched(action: () => Thenable<unknown>): Promise<string> {
    const opened = nextTerminal();
    await action();
    const terminal = await opened;
    terminals.push(terminal);
    return ((terminal.creationOptions as vscode.TerminalOptions).shellArgs as string[])[0]!;
  }

  suiteSetup(async () => {
    hook = (await vscode.extensions.getExtension("aisus.aisus")!.activate()) as TestHook;
  });

  setup(async () => {
    root = vscode.workspace.workspaceFolders![0]!.uri.fsPath;
    ui = stubUi();
    savedPath = process.env["PATH"];
    const bin = mkdtempSync(join(tmpdir(), "aisus-bin-"));
    cleanup.push(bin);
    writeFileSync(join(bin, "claude"), "#!/bin/sh\nsleep 30\n");
    chmodSync(join(bin, "claude"), 0o755);
    process.env["PATH"] = `${bin}:${savedPath}`;
    write(root, "src/a.ts", "export const a = 1;\n");
    candidate = write(
      root,
      `.archify/${RUN}/candidate.json`,
      JSON.stringify({ meta: { title: "Shop" }, components: [{ id: "api", label: "API", type: "backend", sources: [{ path: "src/a.ts", line: 1 }, { path: "src/a.ts" }] }] }),
    );
    installSkills("aisus-architecture", "aisus-refresh");
    await hook.setDataNoteShown(true);
    await vscode.workspace.getConfiguration("aisus").update("runMode", "terminal", vscode.ConfigurationTarget.Global);
  });

  teardown(async () => {
    ui.restore();
    process.env["PATH"] = savedPath;
    for (const terminal of terminals.splice(0)) terminal.dispose();
    await vscode.commands.executeCommand("workbench.action.closeAllEditors");
    await vscode.workspace.getConfiguration("aisus").update("runMode", undefined, vscode.ConfigurationTarget.Global);
    for (const dir of cleanup.splice(0)) rmSync(dir, { recursive: true, force: true });
    for (const dir of [".archify", "src"]) rmSync(join(root, dir), { recursive: true, force: true });
    for (const dir of [".agents", ".claude"]) rmSync(join(homedir(), dir), { recursive: true, force: true });
  });

  test("FRS-06 the map's title-bar Refresh runs the refresh skill on the shown map", async () => {
    await vscode.commands.executeCommand("aisus.openArchitecture");
    await until(() => hook.panelState().open, "the map");
    assert.equal(await launched(() => vscode.commands.executeCommand("aisus.refreshArchitecture")), `/aisus-refresh --from ${RUN}`);
    assert.equal(hook.runCard()?.focus, "Refresh of Shop");
  });

  test("FRS-06 the freshness header's Refresh does the same", async () => {
    await vscode.commands.executeCommand("aisus.openArchitecture");
    await until(() => hook.panelState().open, "the map");
    assert.equal(await launched(() => hook.postFromWebview({ type: "refresh" })), `/aisus-refresh --from ${RUN}`);
  });

  test("FRS-06 the maps list refreshes its map", async () => {
    await vscode.commands.executeCommand("workbench.view.extension.aisus");
    await until(() => hook.homeState().visible, "the sidebar");
    assert.equal(await launched(() => hook.postFromHome({ type: "refreshMap", file: candidate })), `/aisus-refresh --from ${RUN}`);
  });

  test("FRS-06 Refresh this box limits the refresh to the files the box cites", async () => {
    await vscode.commands.executeCommand("aisus.openArchitecture");
    await until(() => hook.panelState().open, "the map");
    const prompt = await launched(() => vscode.commands.executeCommand("aisus.refreshBox", { componentId: "api", webview: "aisus.architecture" }));
    assert.equal(prompt, `/aisus-refresh --from ${RUN} --paths src/a.ts`);
    assert.equal(hook.runCard()?.focus, "Refresh of Shop · 1 file");
  });

  test("ACC-06 This Box Is Wrong… saves the note in feedback.json and offers Refresh this box, which refreshes it", async () => {
    await vscode.commands.executeCommand("aisus.openArchitecture");
    await until(() => hook.panelState().open, "the map");
    ui.answers.inputBox.push("It also handles refunds.");
    ui.answers.info.push("Refresh this box");
    const prompt = await launched(() => vscode.commands.executeCommand("aisus.flagBox", { componentId: "api", webview: "aisus.architecture" }));
    assert.equal(ui.inputBoxes[0]?.prompt, "What is wrong with API?");
    const offer = ui.infos.find((call) => call.message === "Saved your note on API in feedback.json.");
    assert.deepEqual(offer?.rest, ["Refresh this box"]);
    assert.equal(prompt, `/aisus-refresh --from ${RUN} --paths src/a.ts`);
    const feedback = JSON.parse(readFileSync(join(root, ".archify", RUN, "feedback.json"), "utf8")) as { schema: number; notes: { component: string; note: string; createdAt: string }[] };
    assert.equal(feedback.schema, 1);
    assert.deepEqual(feedback.notes.map((note) => [note.component, note.note]), [["api", "It also handles refunds."]]);
    assert.match(feedback.notes[0]!.createdAt, /^\d{4}-\d{2}-\d{2}T/);

    ui.answers.inputBox.push(undefined);
    await vscode.commands.executeCommand("aisus.flagBox", { componentId: "api", webview: "aisus.architecture" });
    ui.answers.inputBox.push("The cited line is the old client.");
    ui.answers.info.push(undefined);
    await vscode.commands.executeCommand("aisus.flagBox", { componentId: "api", webview: "aisus.architecture" });
    const notes = (JSON.parse(readFileSync(join(root, ".archify", RUN, "feedback.json"), "utf8")) as typeof feedback).notes;
    assert.deepEqual(notes.map((note) => note.note), ["It also handles refunds.", "The cited line is the old client."]);
  });

  test("FRS-06 SAF-01 CST-03 a missing refresh skill is installed after one modal", async () => {
    rmSync(join(homedir(), ".agents/skills/aisus-refresh"), { recursive: true, force: true });
    rmSync(join(homedir(), ".claude/skills/aisus-refresh"), { force: true });
    await vscode.commands.executeCommand("aisus.openArchitecture");
    await until(() => hook.panelState().open, "the map");
    ui.answers.info.push("Refresh");
    await launched(() => vscode.commands.executeCommand("aisus.refreshArchitecture"));
    assert.equal(ui.infos[0]!.message, "Refresh with Claude Code?");
    assert.equal(afterEstimate((ui.infos[0]!.rest[0] as { detail: string }).detail), "Installs the aisus-refresh skill in ~/.claude/skills/.");
    assert.ok(readFileSync(join(homedir(), ".agents/skills/aisus-refresh/SKILL.md"), "utf8").includes("name: aisus-refresh"));
  });

  test("FRS-06 without a map Refresh is Generate", async () => {
    rmSync(join(root, ".archify"), { recursive: true, force: true });
    ui.answers.inputBox.push(undefined);
    await vscode.commands.executeCommand("aisus.refreshArchitecture");
    assert.deepEqual(ui.inputBoxes, [{ prompt: "Focus (optional)" }]);
  });
});
