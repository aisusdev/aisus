// CLD-12 and CLD-16 against a fake aisus cloud: Share sends exactly the JSON it previewed, and Open
// Architecture opens the branch's cloud map instead of an older local one. The sidebar's Maps page
// lists the branch's cloud maps and opens them. VS Code's GitHub sign-in
// is replaced for the test, as the suite replaces `vscode.window`, because VS Code refuses to show
// its consent dialog under test.
import * as assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { dirname, join } from "node:path";
import * as vscode from "vscode";
import type { TestHook } from "../../../src/extension";
import { stubUi, type UiStubs } from "../stubs";
import { until } from "../until";
import { suite, suiteSetup, suiteTeardown, setup, teardown, test } from "../tdd";

const RUN = "architecture-shop-20261020-120000";
const TOKEN = "gho_e2e_token";

function map(title: string, ids: string[]): Record<string, unknown> {
  return {
    schema_version: 1,
    diagram_type: "architecture",
    meta: { title, output: "shop.html" },
    components: ids.map((id) => ({ id, type: "backend", label: id, sources: [{ path: "src/api.ts", line: 1 }] })),
    connections: [],
  };
}

function write(root: string, rel: string, content: string): void {
  mkdirSync(dirname(join(root, rel)), { recursive: true });
  writeFileSync(join(root, rel), content);
}

function git(root: string, ...args: string[]): string {
  const result = spawnSync("git", ["-c", "user.name=Test", "-c", "user.email=test@example.com", "-c", "commit.gpgsign=false", "-c", "init.defaultBranch=main", ...args], { cwd: root, encoding: "utf8" });
  if (result.status !== 0) throw new Error(`git ${args.join(" ")}: ${result.stderr}`);
  return result.stdout.trim();
}

/** The fake cloud: answers the pull API from `branchMaps` and records every request. */
interface FakeCloud {
  url: string;
  requests: { method: string; path: string; auth: string | undefined; body: unknown }[];
  branchMaps: Record<string, unknown>;
  close(): Promise<void>;
}

async function fakeCloud(): Promise<FakeCloud> {
  const cloud: FakeCloud = { url: "", requests: [], branchMaps: {}, close: async () => undefined };
  const server: Server = createServer((request, response) => {
    let text = "";
    request.on("data", (chunk: Buffer) => (text += chunk.toString("utf8")));
    request.on("end", () => {
      cloud.requests.push({ method: request.method ?? "", path: request.url ?? "", auth: request.headers.authorization, body: text === "" ? null : JSON.parse(text) });
      response.setHeader("content-type", "application/json");
      if (request.method === "POST") {
        response.statusCode = 201;
        response.end(JSON.stringify({ status: "accepted", id: 1, url: "/acme/shop" }));
      } else {
        response.end(JSON.stringify(cloud.branchMaps));
      }
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  cloud.url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  cloud.close = () => new Promise<void>((resolve) => server.close(() => resolve()));
  return cloud;
}

suite("CLD-12 CLD-16 aisus cloud in VS Code", () => {
  let hook: TestHook;
  let ui: UiStubs;
  let root: string;
  let cloud: FakeCloud;
  let signIns: { provider: string; scopes: readonly string[] }[];
  const realGetSession = vscode.authentication.getSession;

  suiteSetup(async () => {
    hook = (await vscode.extensions.getExtension("aisus.aisus")!.activate()) as TestHook;
    const session: vscode.AuthenticationSession = { id: "e2e", accessToken: TOKEN, account: { id: "1", label: "dev" }, scopes: ["read:user", "repo"] };
    Object.assign(vscode.authentication, {
      getSession: async (provider: string, scopes: readonly string[]) => {
        signIns.push({ provider, scopes });
        return session;
      },
    });
  });

  suiteTeardown(() => {
    Object.assign(vscode.authentication, { getSession: realGetSession });
  });

  setup(async () => {
    root = vscode.workspace.workspaceFolders![0]!.uri.fsPath;
    ui = stubUi();
    signIns = [];
    cloud = await fakeCloud();
    await vscode.workspace.getConfiguration("aisus").update("cloud.url", cloud.url, vscode.ConfigurationTarget.Global);
    write(root, "src/api.ts", "export const api = 1;\n");
    git(root, "init", "-q");
    git(root, "remote", "add", "origin", "https://github.com/acme/shop.git");
    git(root, "add", ".");
    git(root, "commit", "-qm", "c1");
    const c1 = git(root, "rev-parse", "HEAD");
    write(root, `.aisus/maps/${RUN}/candidate.json`, JSON.stringify(map("Local", ["api"])));
    write(root, `.aisus/maps/${RUN}/fingerprints.json`, JSON.stringify({ schema: 1, revision: c1, createdAt: "2026-10-20T12:00:00Z", citations: [] }));
    write(root, "src/api.ts", "export const api = 2;\n");
    git(root, "commit", "-qam", "c2");
  });

  teardown(async () => {
    ui.restore();
    await cloud.close();
    await vscode.commands.executeCommand("workbench.action.closeAllEditors");
    for (const key of ["cloud.enabled", "cloud.url"]) await vscode.workspace.getConfiguration("aisus").update(key, undefined, vscode.ConfigurationTarget.Global);
    for (const path of [".aisus", "src", ".git"]) rmSync(join(root, path), { recursive: true, force: true });
  });

  test("with the setting off, Open Architecture opens the local map and asks the cloud nothing", async () => {
    await vscode.commands.executeCommand("aisus.openArchitecture");
    assert.equal(hook.panelState().file, join(root, `.aisus/maps/${RUN}/candidate.json`));
    assert.deepEqual(cloud.requests, []);
    assert.deepEqual(signIns, []);
  });

  test("Share to aisus cloud sends exactly the JSON it previewed, to the space picked, signed with the GitHub sign-in", async () => {
    await vscode.workspace.getConfiguration("aisus").update("cloud.enabled", true, vscode.ConfigurationTarget.Global);
    ui.answers.quickPick.push("Team space");
    ui.answers.info.push("Send");
    await hook.postFromHome({ type: "shareMap", file: join(root, `.aisus/maps/${RUN}/candidate.json`) });
    assert.equal(ui.infos[0]!.message, `Send exactly this JSON to ${cloud.url}, to your team space?`);
    const preview = vscode.workspace.textDocuments.find((document) => document.uri.scheme === "aisus-cloud-preview" && document.languageId === "json");
    assert.ok(preview, "the preview is open");
    assert.equal(cloud.requests.length, 1);
    const sent = cloud.requests[0]!;
    assert.deepEqual({ method: sent.method, path: sent.path, auth: sent.auth }, { method: "POST", path: "/api/v1/uploads", auth: `Bearer ${TOKEN}` });
    assert.deepEqual(sent.body, JSON.parse(preview.getText()));
    assert.deepEqual((sent.body as { space: string; repo: string; branch: string }).space, "team");
    assert.equal((sent.body as { repo: string }).repo, "acme/shop");
    assert.equal(ui.infos[1]!.message, "Shared to your team space in aisus cloud.");
    assert.deepEqual(signIns, [{ provider: "github", scopes: ["read:user", "repo"] }]);
  });

  test("Open Architecture opens the branch's cloud map when the local map was drawn at an ancestor of its commit", async () => {
    await vscode.workspace.getConfiguration("aisus").update("cloud.enabled", true, vscode.ConfigurationTarget.Global);
    const head = git(root, "rev-parse", "HEAD");
    const fingerprints = { schema: 1, revision: head, createdAt: "2026-10-21T12:00:00Z", citations: [] };
    cloud.branchMaps = {
      defaultBranch: "main",
      team: { id: 7, space: "team", branch: "main", commit: head, createdAt: "2026-10-21T12:00:00Z", sha256: "a".repeat(64), map: map("From the cloud", ["api", "store"]), sidecars: { fingerprints }, meta: {} },
      personal: null,
      main: null,
      mainHistory: [],
    };
    await vscode.commands.executeCommand("aisus.openArchitecture");
    assert.equal(cloud.requests[0]!.path, "/api/v1/repos/acme/shop/maps?branch=main");
    const pulled = join(root, ".aisus/cloud/team-7/candidate.json");
    assert.equal(hook.panelState().file, pulled);
    assert.equal((JSON.parse(readFileSync(pulled, "utf8")) as { meta: { title: string } }).meta.title, "From the cloud");
    assert.ok(existsSync(join(root, ".aisus/cloud/team-7/fingerprints.json")));
    assert.equal(ui.infos.at(-1)!.message, `Opened the team map of main from aisus cloud, drawn at this commit (${head.slice(0, 7)}).`);
    assert.match(readFileSync(join(root, ".git/info/exclude"), "utf8"), /^\.aisus\/cloud\/$/m);
  });

  test("the sidebar lists the branch's cloud map with where it comes from, and opening it writes and opens the pulled map", async () => {
    const head = git(root, "rev-parse", "HEAD");
    cloud.branchMaps = {
      defaultBranch: "main",
      team: { id: 9, space: "team", branch: "main", commit: head, createdAt: "2026-10-21T12:00:00Z", sha256: "b".repeat(64), map: map("Team map", ["api", "store", "queue"]), sidecars: null, meta: {} },
      personal: null,
      main: null,
      mainHistory: [],
    };
    await vscode.workspace.getConfiguration("aisus").update("cloud.enabled", true, vscode.ConfigurationTarget.Global);
    await vscode.commands.executeCommand("workbench.view.extension.aisus");
    await until(() => (hook.homeState().state?.cloudMaps.length ?? 0) > 0, "the sidebar to list the cloud map");
    const listed = hook.homeState().state!.cloudMaps;
    assert.deepEqual(listed.map((item) => [item.source, item.boxes]), [[`Team map of main at ${head.slice(0, 7)}`, 3]]);
    await hook.postFromHome({ type: "openMap", file: listed[0]!.file });
    const pulled = join(root, ".aisus/cloud/team-9/candidate.json");
    assert.equal(hook.panelState().file, pulled);
    assert.equal((JSON.parse(readFileSync(pulled, "utf8")) as { meta: { title: string } }).meta.title, "Team map");
  });
});
