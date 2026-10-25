// VWR-01: the viewer renders the same DOM under the VS Code and standalone hosts, and each host
// defines every token the stylesheet uses.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test, vi } from "vitest";
import { layoutDiagram } from "@aisus/core/layout/layout";
import type { HostMessage, WebviewMessage } from "@aisus/core/model/messages";
import { useHost } from "@aisus/viewer/bridge";
import { DARK, LIGHT, standaloneHost } from "@aisus/viewer/hosts/standalone";
import { VSCODE_TOKENS, vscodeHost } from "@aisus/viewer/hosts/vscode";
import { startViewer } from "@aisus/viewer/viewer";
import { repoRoot } from "../unit/support/sourceScan";
import { archifyFixtures } from "../unit/support/fixtures";
import { gridScene } from "./support/scene";

vi.mock("@aisus/core/layout/layout", () => ({ layoutDiagram: vi.fn() }));

vi.hoisted(() => {
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue(new DOMRect(0, 0, 800, 600));
  const context = { font: "", measureText: (text: string) => ({ width: text.length * 7 }) };
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(context as unknown as CanvasRenderingContext2D);
});

vi.mocked(layoutDiagram).mockImplementation(async (diagram) => gridScene(diagram));

/** The viewer's markup with style attributes removed, since only the values differ between hosts. */
function markup(): string {
  return document.body.innerHTML.replace(/ style="[^"]*"/g, "");
}

async function render(install: (load: HostMessage) => void, doc: unknown): Promise<string> {
  document.body.replaceChildren();
  document.body.removeAttribute("style");
  install({ type: "load", doc, file: "/r/candidate.json" });
  await vi.waitFor(() => expect(document.querySelector(".app")?.classList.contains("app--empty")).toBe(false));
  return markup();
}

describe("VWR-01 hosts", () => {
  test.each(archifyFixtures().map((fixture) => [fixture.name, fixture.text] as const))("%s renders the same DOM under both hosts", async (_name, text) => {
    const doc: unknown = JSON.parse(text);
    const underVscode = await render((load) => {
      vi.stubGlobal("acquireVsCodeApi", () => ({ postMessage: (_message: WebviewMessage) => undefined }));
      useHost(vscodeHost());
      startViewer();
      window.dispatchEvent(new MessageEvent("message", { data: load }));
    }, doc);
    const standalone = await render((load) => {
      useHost(standaloneHost({ post: () => undefined, messages: [load] }));
      startViewer();
    }, doc);
    expect(standalone).toBe(underVscode);
  });

  test("each host defines every token the stylesheet uses", () => {
    const css = readFileSync(join(repoRoot, "packages/viewer/styles.css"), "utf8");
    const used = [...new Set([...css.matchAll(/var\((--aisus-[\w-]+)/g)].map((match) => match[1]!))].sort();
    expect(css).not.toContain("--vscode-");
    const vscode = [...Object.keys(VSCODE_TOKENS), "--aisus-font-family"];
    for (const tokens of [vscode, Object.keys(LIGHT), Object.keys(DARK)]) expect(used.filter((token) => !tokens.includes(token))).toEqual([]);
  });

  test("the standalone host follows the system's dark setting", () => {
    vi.stubGlobal("matchMedia", (query: string) => ({ matches: query === "(prefers-color-scheme: dark)", addEventListener: () => undefined }));
    document.body.removeAttribute("style");
    standaloneHost({ post: () => undefined, messages: [] });
    expect(document.body.style.getPropertyValue("--aisus-background")).toBe(DARK["--aisus-background"]);
    vi.unstubAllGlobals();
  });
});
