// PRC-07: a pull request's diagram as an SVG document: the marked boxes and their neighbours, with
// the check's marks or the boxes' own tags, every label escaped, and nothing that runs or loads.
import { expect, test } from "vitest";
import { runInThread } from "@aisus/core/layout/elkInThread";
import { changeSvg } from "@aisus/core/layout/svg";
import type { DeltaReport } from "@aisus/core/model/delta";
import { comp, diagramOf } from "./helpers";

/** web → auth → cache, auth → users → audit, and billing on its own. */
const MAP = diagramOf({
  components: [comp("web"), comp("auth"), comp("cache"), comp("users"), comp("audit"), comp("billing", { label: "Billing <script>" })],
  connections: [
    { from: "web", to: "auth" },
    { from: "auth", to: "cache" },
    { from: "auth", to: "users" },
    { from: "users", to: "audit" },
  ],
});

const box = (id: string) => ({ id, label: id.toUpperCase() });
const CHECK = {
  touched: { strong: [box("auth")], weak: [box("users")] },
  stale: [],
  uncovered: [],
  candidates: [{ dir: "services/ledger", files: [{ path: "services/ledger/index.ts", added: 40 }], lines: 40, label: "Ledger" }],
  gone: [],
  arrows: [{ from: box("web"), to: box("cache"), links: [{ from: "web/app.ts", to: "cache/index.ts" }] }],
  violations: [],
} as unknown as DeltaReport;

/** The `<rect>` drawn for the box whose label is `label`: the last rect before its label text. */
function boxRect(svg: string, label: string): string {
  const at = svg.indexOf(`>${label}</text>`);
  expect(at, label).toBeGreaterThan(0);
  const before = svg.slice(0, at);
  return before.slice(before.lastIndexOf("<rect"));
}

test("PRC-07 a check marks the changed box lime, the box using it pale, the candidate dashed and NEW, and the new import dashed, and leaves the rest out", async () => {
  const svg = await changeSvg(MAP, CHECK, runInThread);
  expect(boxRect(svg, "AUTH")).toContain('fill="#c8ef72"');
  expect(boxRect(svg, "USERS")).toContain('fill="#eef5df"');
  expect(boxRect(svg, "Ledger")).toContain('stroke-dasharray="6 4"');
  expect(svg).toContain(">NEW</text>");
  expect(svg.match(/marker-end="url\(#arrow-new\)"/g)).toHaveLength(1);
  expect(svg).toContain(">new import</text>");
  // Neighbours of a marked box stay as context; a box neither marked nor next to one is left out.
  expect(boxRect(svg, "WEB")).toContain('fill="#fffef9"');
  expect(boxRect(svg, "AUDIT")).toContain('fill="#fffef9"');
  expect(svg).not.toContain("Billing");
});

test("PRC-07 a map drawn for instructions takes its marks from the tags changed and new, and draws no tag text for them", async () => {
  const tagged = diagramOf({ components: [comp("auth", { tag: "changed" }), comp("cache", { tag: "new" }), comp("users", { tag: "v2" })], connections: [{ from: "auth", to: "cache" }, { from: "auth", to: "users" }] });
  const svg = await changeSvg(tagged, null, runInThread);
  expect(boxRect(svg, "AUTH")).toContain('fill="#c8ef72"');
  expect(boxRect(svg, "CACHE")).toContain('stroke-dasharray="6 4"');
  expect(svg).not.toContain(">changed</text>");
  expect(svg).toContain(">v2</text>");
});

test("PRC-07 every label is escaped, and the document holds no script, foreign content, event attribute or outside reference", async () => {
  const svg = await changeSvg(MAP, null, runInThread);
  expect(svg).toContain(">Billing &lt;script&gt;</text>");
  expect(svg).not.toMatch(/<script|foreignObject|\son[a-z]+=|href=|https?:\/\/(?!www\.w3\.org\/2000\/svg)/i);
  expect(await changeSvg(MAP, null, runInThread)).toBe(svg);
});
