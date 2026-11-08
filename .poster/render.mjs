// Renders poster.html to out/poster.pdf (A1, vector) and out/poster.png (preview).
// Run from the repository root: node .poster/render.mjs [png scale, default 1]
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, "out");
const scale = Number(process.argv[2] ?? 1);
mkdirSync(out, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 2245, height: 3178 }, deviceScaleFactor: scale });
await page.goto(pathToFileURL(join(here, "poster.html")).href, { waitUntil: "load" });
for (const frame of page.frames()) await frame.evaluate(() => document.fonts.ready);
await page.waitForTimeout(300);

await page.screenshot({ path: join(out, "poster.png") });
await page.pdf({ path: join(out, "poster.pdf"), preferCSSPageSize: true, printBackground: true });
await browser.close();
console.log(`wrote ${out}/poster.pdf and poster.png`);
