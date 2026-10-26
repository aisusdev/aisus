// FRS-10: a refreshed map opens compared with the map it updated, with the boxes it kept and the
// files no box cites; Swap and Open baseline show the earlier map in the panel, and Compare with…
// offers No comparison.
import * as assert from "node:assert/strict";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import * as vscode from "vscode";
import type { TestHook } from "../../../src/extension";
import { stubUi, type UiStubs } from "../stubs";
import { setup, suite, suiteSetup, teardown, test } from "../tdd";
import { until } from "../until";

const BASE = "architecture-shop-20261024-120000";
const REFRESH = "architecture-shop-20261025-120000";

function write(root: string, rel: string, content: unknown): void {
  mkdirSync(dirname(join(root, rel)), { recursive: true });
  writeFileSync(join(root, rel), typeof content === "string" ? content : JSON.stringify(content));
}

function lineage(mode: "update" | "regenerate", previousRun: string | null): object {
  return { schema: 1, mode, reason: mode === "update" ? "update" : "no-previous", previousRun, baseRevision: null, revision: null, baseCommit: null, headCommit: null, dirty: [], dirtyCount: 0, updatesSinceRegeneration: mode === "update" ? 1 : 0 };
}

suite("FRS-10 Changes panel", () => {
  let hook: TestHook;
  let ui: UiStubs;
  let root: string;
  const candidate = (run: string): string => join(root, ".aisus/maps", run, "candidate.json");

  suiteSetup(async () => {
    hook = (await vscode.extensions.getExtension("aisus.aisus")!.activate()) as TestHook;
  });

  setup(() => {
    root = vscode.workspace.workspaceFolders![0]!.uri.fsPath;
    ui = stubUi();
    write(root, "src/api.ts", "export const api = 1;\n");
    write(root, "src/db.ts", "export const db = 1;\n");
    write(root, "src/mail.ts", "export const mail = 1;\n");
    const box = (id: string, label: string, path: string) => ({ id, type: "backend", label, sources: [{ path, line: 1 }] });
    write(root, `.aisus/maps/${BASE}/candidate.json`, { meta: { title: "Shop" }, components: [box("api", "API", "src/api.ts"), box("db", "DB", "src/db.ts")] });
    write(root, `.aisus/maps/${BASE}/lineage.json`, lineage("regenerate", null));
    write(root, `.aisus/maps/${REFRESH}/candidate.json`, { meta: { title: "Shop" }, components: [box("api", "API", "src/api.ts"), box("db", "DB", "src/db.ts"), box("mail", "Mail", "src/mail.ts")], connections: [{ from: "api", to: "mail" }] });
    write(root, `.aisus/maps/${REFRESH}/lineage.json`, lineage("update", BASE));
    write(root, `.aisus/maps/${REFRESH}/changes.json`, { schema: 1, baseRevision: "a".repeat(40), revision: "b".repeat(40), touched: [{ id: "db", files: [{ status: "modified", path: "src/db.ts" }] }], uncited: [{ status: "added", path: "src/new.ts" }] });
  });

  teardown(async () => {
    ui.restore();
    await vscode.commands.executeCommand("workbench.action.closeAllEditors");
    for (const path of [".aisus/maps", "src"]) rmSync(join(root, path), { recursive: true, force: true });
  });

  async function open(run: string): Promise<void> {
    await hook.postFromHome({ type: "openMap", file: candidate(run) });
    await until(() => hook.panelState().file === candidate(run), `${run} to open`);
  }

  test("FRS-10 a refreshed map opens compared with the map it updated, with the boxes it kept and the files no box cites", async () => {
    await open(REFRESH);
    const compare = hook.panelCompare();
    assert.equal(compare?.context?.baselineRun, BASE);
    assert.deepEqual(compare?.diff.boxes.map((entry) => entry.status), ["unchanged", "kept", "added"]);
    assert.deepEqual(compare?.changes?.uncited, [{ status: "added", path: "src/new.ts" }]);
    assert.deepEqual(compare?.context?.warnings, []);
  });

  test("FRS-10 Swap shows the earlier map compared with the refreshed one, and Open baseline shows it with its own comparison", async () => {
    await open(REFRESH);
    await hook.postFromWebview({ type: "swap" });
    assert.equal(hook.panelState().file, candidate(BASE));
    const swapped = hook.panelCompare();
    assert.equal(swapped?.context?.baselineRun, REFRESH);
    assert.deepEqual(swapped?.context?.warnings.map((warning) => warning.code), ["outside-history", "reversed"]);

    await open(REFRESH);
    await hook.postFromWebview({ type: "openBaseline" });
    assert.equal(hook.panelState().file, candidate(BASE));
    assert.equal(hook.panelCompare(), null);
  });

  test("FRS-10 Compare with… tags the map this one updated, and No comparison clears it", async () => {
    await open(REFRESH);
    ui.answers.quickPick.push("No comparison");
    await hook.postFromWebview({ type: "compareWith" });
    const items = ui.quickPicks[0]!;
    assert.deepEqual(items.map((item) => [item.label, item.description ?? ""]), [["No comparison", ""], [BASE, "previous"]]);
    assert.equal(hook.panelCompare(), null);
  });
});
