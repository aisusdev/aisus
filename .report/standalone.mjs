// Builds dist/aisus-report.html, the report as one file for distribution, from index.html.
// The file carries the stylesheet and the figure script inside it. Images and live maps load
// from the report's GitHub Pages site at PAGES, which the report-pages workflow publishes.
// Run `node .report/standalone.mjs` after editing index.html.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const PAGES = "https://aisusdev.github.io/aisus/";

const dir = import.meta.dirname;
const read = (file) => readFileSync(join(dir, file), "utf8");

/** Replaces `from` in `html` with `to`, and fails when `from` is not there exactly once. */
function swap(html, from, to) {
  const parts = html.split(from);
  if (parts.length !== 2) throw new Error(`index.html should hold ${from} once, and holds it ${parts.length - 1} times.`);
  return parts.join(to);
}

let html = read("index.html");
html = swap(html, '    <link rel="stylesheet" href="style.css">\n', `    <style>\n${read("style.css")}    </style>\n`);
html = swap(html, '    <script src="engine/figures.js" defer></script>\n', "");
html = swap(html, "  </body>", `    <script>\n${read("engine/figures.js")}    </script>\n  </body>`);
// Every relative src and href points at the same file on the Pages site.
html = html.replace(/\b(src|href)="(?![a-z][a-z0-9+.-]*:|#|\/)([^"]+)"/gi, (_, attribute, path) => `${attribute}="${PAGES}${path}"`);

mkdirSync(join(dir, "dist"), { recursive: true });
writeFileSync(join(dir, "dist", "aisus-report.html"), html);
console.log(`Wrote dist/aisus-report.html with assets from ${PAGES}.`);
