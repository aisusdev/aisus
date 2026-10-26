// SEQ-04: a sequence map opens from the Maps page, and a click on a message opens its call site.
import * as assert from "node:assert/strict";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import * as vscode from "vscode";
import type { TestHook } from "../../../src/extension";
import { stubUi, type UiStubs } from "../stubs";
import { setup, suite, suiteSetup, teardown, test } from "../tdd";
import { until } from "../until";

const RUN = "sequence-login-20261025-090000";

function write(root: string, rel: string, content: string): void {
  mkdirSync(dirname(join(root, rel)), { recursive: true });
  writeFileSync(join(root, rel), content);
}

suite("SEQ-04 Sequence maps in VS Code", () => {
  let hook: TestHook;
  let ui: UiStubs;
  let root: string;

  suiteSetup(async () => {
    hook = (await vscode.extensions.getExtension("aisus.aisus")!.activate()) as TestHook;
  });

  setup(() => {
    root = vscode.workspace.workspaceFolders![0]!.uri.fsPath;
    ui = stubUi();
    write(root, "src/login-page.ts", "one\ntwo\nthree\nfour\n");
    write(root, "src/login-api.ts", "export const login = () => 200;\n");
    write(
      root,
      `.aisus/maps/${RUN}/candidate.json`,
      JSON.stringify({
        schema_version: 1,
        diagram_type: "sequence",
        meta: { title: "Login", output: `.aisus/maps/${RUN}/login.html` },
        participants: [
          { id: "web", type: "frontend", label: "Web", sources: [{ path: "src/login-page.ts" }] },
          { id: "api", type: "backend", label: "API", sources: [{ path: "src/login-api.ts", line: 1 }] },
        ],
        messages: [
          { id: "post", from: "web", to: "api", label: "POST /login", sources: [{ path: "src/login-page.ts", line: 2, end_line: 3 }] },
          { id: "ok", from: "api", to: "web", label: "200", variant: "return" },
        ],
      }),
    );
  });

  teardown(async () => {
    ui.restore();
    await vscode.commands.executeCommand("workbench.action.closeAllEditors");
    for (const path of [".aisus/maps", "src"]) rmSync(join(root, path), { recursive: true, force: true });
  });

  test("SEQ-04 a sequence map opens from the Maps page, and a click on a message selects its cited lines", async () => {
    const file = join(root, ".aisus/maps", RUN, "candidate.json");
    await hook.postFromHome({ type: "openMap", file });
    await until(() => hook.panelState().file === file, "the sequence map to open");
    await hook.postFromWebview({ type: "openSource", componentId: "post", index: 0 });
    const editor = vscode.window.activeTextEditor;
    assert.equal(editor?.document.uri.fsPath, join(root, "src/login-page.ts"));
    const { start, end } = editor!.selection;
    assert.deepEqual([start.line, end.line, end.character], [1, 2, "three".length]);
    assert.equal(ui.errors.length, 0);
  });
});
