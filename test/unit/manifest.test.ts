// SAF-07 and UI-01: the extension manifest keeps aisus off in untrusted workspaces, and puts
// every command somewhere other than the Command Palette.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";
import { SIDEBAR_ACTIONS } from "@aisus/core/model/home";
import { repoRoot } from "./support/sourceScan";

test("SAF-07 aisus declares no support for untrusted workspaces", () => {
  const manifest = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf8")) as { capabilities?: { untrustedWorkspaces?: { supported?: unknown } } };
  expect(manifest.capabilities?.untrustedWorkspaces?.supported).toBe(false);
});

interface Manifest {
  contributes: {
    commands: { command: string; icon?: string }[];
    viewsContainers: { activitybar: { id: string; icon: string }[] };
    views: Record<string, { type?: string; id: string }[]>;
    menus: Record<string, { command: string; when?: string; group?: string }[]>;
    configuration: { properties: Record<string, { default?: unknown; enum?: unknown[] }> };
  };
}

const manifest = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf8")) as Manifest;

test("UI-01 the Activity Bar container holds the sidebar webview, with a monochrome icon that ships", () => {
  const container = manifest.contributes.viewsContainers.activitybar.find((entry) => entry.id === "aisus");
  expect(container?.icon).toBe("media/aisus.svg");
  expect(manifest.contributes.views["aisus"]).toEqual([{ type: "webview", id: "aisus.home", name: "aisus" }]);
  const icon = readFileSync(join(repoRoot, "media/aisus.svg"), "utf8");
  expect(icon).toContain('stroke="currentColor"');
  expect(icon).not.toMatch(/#[0-9a-f]{3,6}\b/i);
  expect(readFileSync(join(repoRoot, ".vscodeignore"), "utf8").split("\n")).toContain("!media/**");
});

test("UI-01 every command is reachable from a menu, a title bar or the sidebar", () => {
  const inMenus = new Set(
    Object.entries(manifest.contributes.menus)
      .filter(([menu]) => menu !== "commandPalette")
      .flatMap(([, entries]) => entries.map((entry) => entry.command)),
  );
  const inSidebar = new Set(Object.values(SIDEBAR_ACTIONS));
  const unreachable = manifest.contributes.commands.map((entry) => entry.command).filter((command) => !inMenus.has(command) && !inSidebar.has(command));
  expect(unreachable).toEqual([]);
});

test("UI-01 each sidebar action is a button the sidebar renders", () => {
  const sidebar = readFileSync(join(repoRoot, "packages/viewer/home.ts"), "utf8");
  for (const type of Object.keys(SIDEBAR_ACTIONS)) expect(sidebar).toContain(`type: "${type}"`);
});

test("UI-01 the sidebar title bar has Refresh and Check Setup, and runs default to the sidebar", () => {
  const title = manifest.contributes.menus["view/title"]!.filter((entry) => entry.when?.startsWith("view == aisus.home") && entry.group?.startsWith("navigation"));
  expect(title.map((entry) => entry.command)).toEqual(expect.arrayContaining(["aisus.refreshHome", "aisus.checkSetup"]));
  expect(manifest.contributes.configuration.properties["aisus.runMode"]).toMatchObject({ default: "sidebar", enum: ["sidebar", "terminal"] });
});

test("UI-03 Show in Map sits in every file editor's title bar with the aisus icon, and not on the map", () => {
  expect(manifest.contributes.menus["editor/title"]).toContainEqual({ command: "aisus.showInMap", when: "resourceScheme == file", group: "navigation@100" });
  const command = manifest.contributes.commands.find((entry) => entry.command === "aisus.showInMap") as { icon?: { light: string; dark: string } };
  expect(command.icon).toEqual({ light: "media/aisus-light.svg", dark: "media/aisus-dark.svg" });
  for (const path of Object.values(command.icon!)) expect(readFileSync(join(repoRoot, path), "utf8")).toContain("<svg");
});

test("UI-05 the Explorer maps folders and shows files; boxes open their code", () => {
  expect(manifest.contributes.menus["explorer/context"]).toEqual([
    { command: "aisus.mapFolder", when: "explorerResourceIsFolder", group: "aisus@1" },
    { command: "aisus.showFileInMap", when: "!explorerResourceIsFolder", group: "aisus@2" },
  ]);
  expect(manifest.contributes.menus["webview/context"]).toContainEqual({ command: "aisus.openBoxCode", when: "webviewId == 'aisus.architecture' && webviewSection == 'box'", group: "navigation@1" });
  const hidden = manifest.contributes.menus["commandPalette"]!.filter((entry) => entry.when === "false").map((entry) => entry.command);
  expect(hidden).toEqual(expect.arrayContaining(["aisus.showFileInMap", "aisus.mapFolder", "aisus.openBoxCode"]));
});

test("FRS-04 Show Changes sits in the map panel's title bar only", () => {
  expect(manifest.contributes.menus["editor/title"]).toContainEqual({ command: "aisus.showChanges", when: "activeWebviewPanelId == 'aisus.architecture'", group: "navigation@2" });
});

test("FRS-06 Refresh sits in the map's title bar and in a box's menu", () => {
  expect(manifest.contributes.menus["editor/title"]).toContainEqual({ command: "aisus.refreshArchitecture", when: "activeWebviewPanelId == 'aisus.architecture'", group: "navigation@1" });
  expect(manifest.contributes.menus["webview/context"]).toContainEqual({ command: "aisus.refreshBox", when: "webviewId == 'aisus.architecture' && webviewSection == 'box'", group: "navigation@2" });
});

test("RCH-01 Export Page sits in the map's title bar", () => {
  expect(manifest.contributes.menus["editor/title"]).toContainEqual({ command: "aisus.exportPage", when: "activeWebviewPanelId == 'aisus.architecture'", group: "navigation@3" });
});
