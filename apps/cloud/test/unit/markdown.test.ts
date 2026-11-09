// CLD-08: the docs renderer's links: web links and published pages only, never a script URL.
import { expect, test } from "vitest";
import { docImage, docPath } from "../../src/lib/docs";
import { inline, linkTarget, parseMarkdown } from "../../src/lib/markdown";

test("CLD-08 links go to the web, to anchors or to published docs; script URLs become text", () => {
  const page = (path: string): string | null => docPath("README.md", path);
  expect(linkTarget("https://example.com/a", page)).toBe("https://example.com/a");
  expect(linkTarget("#setup", page)).toBe("#setup");
  expect(linkTarget("docs/how-aisus-works.md#the-big-picture", page)).toBe("/docs/architecture#the-big-picture");
  expect(linkTarget("docs/architecture.md", page)).toBeNull();
  expect(linkTarget("docs/progress-v0.3.md", page)).toBeNull();
  expect(linkTarget("javascript:alert(1)", page)).toBeNull();
  expect(linkTarget("JaVaScRiPt:alert(1)", page)).toBeNull();
  expect(inline("[x](javascript:alert(1)) and `code`", page)).toEqual([
    { kind: "text", text: "x" },
    { kind: "text", text: " and " },
    { kind: "code", text: "code" },
  ]);
  expect(docPath("docs/architecture.md", "../README.md")).toBe("/docs");
});

test("CLD-08 headings, tables, lists and fences parse; markup stays text", () => {
  const blocks = parseMarkdown("# Title <b>x</b>\n\n| a | b |\n|---|---|\n| 1 | 2 |\n\n- one\n- two\n\n```ts\n<script>\n```");
  expect(blocks.map((block) => block.kind)).toEqual(["heading", "table", "list", "code"]);
  expect(blocks[0]).toMatchObject({ level: 1, id: "title-bxb", spans: [{ kind: "text", text: "Title <b>x</b>" }] });
  expect(blocks[3]).toEqual({ kind: "code", lang: "ts", text: "<script>" });
});

test("CLD-08 a PNG or GIF under docs/media/ becomes an image block; any other image shows its alt text", () => {
  const image = (src: string): string | null => docImage("README.md", src);
  const blocks = parseMarkdown("![A map](docs/media/demo.gif)\n\n![Elsewhere](apps/cloud/public/aisus-pr-10.png)\n\n![Script](javascript:alert(1))", () => null, image);
  expect(blocks).toEqual([
    { kind: "image", alt: "A map", src: "/docs/media/demo.gif" },
    { kind: "paragraph", spans: [{ kind: "text", text: "Elsewhere" }] },
    { kind: "paragraph", spans: [{ kind: "text", text: "Script" }] },
  ]);
  expect(docImage("docs/architecture.md", "media/map-and-code.png")).toBe("/docs/media/map-and-code.png");
});
