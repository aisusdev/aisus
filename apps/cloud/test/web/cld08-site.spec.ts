// CLD-08 [web]: the public site, with no request leaving it, and pricing from billing's price texts.
import { expect, test } from "@playwright/test";
import { BILLED_APP } from "./support";

test("CLD-08 landing, guide, pricing and privacy render without any third-party request", async ({ page }) => {
  const hosts = new Set<string>();
  page.on("request", (request) => hosts.add(new URL(request.url()).host));
  await page.goto("/");
  await expect(page.locator("h1")).toHaveText("See your codebase as a map");
  const hero = page.locator(".home-hero");
  await expect(hero.getByRole("link", { name: "Get Started" })).toHaveAttribute("href", "/get-started");
  await expect(hero.getByRole("link", { name: "Sign in with GitHub", exact: true })).toHaveAttribute("href", "/cloud/signin");
  await expect(page.getByRole("link", { name: "Get Started" }).first()).toHaveAttribute("href", "/get-started");
  await expect(page.locator(".site-header .brand img")).toHaveAttribute("src", "/aisus-wordmark.png");
  await expect(page.locator("link[rel='icon']")).toHaveAttribute("href", /icon\.png/);
  await expect(page.locator("#pricing")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Gallery" })).toHaveCount(0);
  await page.goto("/get-started");
  await expect(page.locator("h1")).toHaveText("Get Started");
  await expect(page.locator("main")).toContainText("/aisus-architecture");
  await page.goto("/pricing");
  await expect(page.locator("main")).toContainText("This server gives every account everything in aisus cloud.");
  await page.goto("/docs");
  await expect(page.locator(".markdown h2").first()).toBeVisible();
  await page.getByRole("link", { name: "Architecture" }).first().click();
  await expect(page.locator("h1")).toHaveText("Architecture");
  await page.goto("/privacy");
  await expect(page.locator("main")).toContainText("Maps, not code");
  await expect(page.locator("pre")).toContainText('"title": "aisus cloud upload"');
  await page.goto("/gallery");
  await expect(page.locator("h1")).toHaveText("404");
  expect([...hosts]).toEqual(["127.0.0.1:3210"]);
});

test("CLD-08 the docs show the README's image from this server, and their panel opens Contributing, Maintaining and GitHub Action", async ({ page, request }) => {
  await page.goto("/docs");
  const image = page.locator(".markdown img").first();
  await expect(image).toHaveAttribute("src", "/docs/media/demo.gif");
  const response = await request.get("/docs/media/demo.gif");
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toBe("image/gif");
  for (const name of ["Contributing", "Maintaining", "GitHub Action"]) {
    await page.getByRole("navigation", { name: "Guide" }).getByRole("link", { name, exact: true }).click();
    await expect(page.locator("h1")).toHaveText(name);
  }
});

test("CLD-08 the header and the footer link to the docs", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Docs" })).toHaveAttribute("href", "/docs");
  await expect(page.getByRole("navigation", { name: "Project" }).getByRole("link", { name: "Docs" })).toHaveAttribute("href", "/docs");
});

test("CLD-08 a docs page is marked in the panel, titled with its name, and lists its sections under On this page", async ({ page }) => {
  await page.goto("/docs/architecture");
  await expect(page.getByRole("navigation", { name: "Guide" }).locator("a[aria-current=page]")).toHaveText("Architecture");
  await expect(page.locator("h1")).toHaveText("Architecture");
  const sections = page.getByRole("complementary", { name: "On this page" }).getByRole("link");
  await expect(sections.first()).toHaveText("The big picture");
  await expect(sections).toHaveCount(await page.locator(".markdown h2").count());
});

test("CLD-08 Get Started's panel links to the docs", async ({ page }) => {
  await page.goto("/get-started");
  await expect(page.getByRole("navigation", { name: "Guide" }).getByRole("link", { name: "GitHub Action", exact: true })).toHaveAttribute("href", "/docs/github-action");
});

test("CLD-08 the architecture page draws its two Mermaid diagrams as SVG without requesting another host", async ({ page }) => {
  const hosts = new Set<string>();
  page.on("request", (request) => hosts.add(new URL(request.url()).host));
  await page.goto("/docs/architecture");
  await expect(page.locator(".mermaid-diagram svg")).toHaveCount(2);
  expect([...hosts]).toEqual(["127.0.0.1:3210"]);
});

test("CLD-08 the docs panel opens the aisus cloud guide", async ({ page }) => {
  await page.goto("/docs");
  await page.getByRole("navigation", { name: "Guide" }).getByRole("link", { name: "aisus cloud", exact: true }).click();
  await expect(page.locator("h1")).toHaveText("aisus cloud");
});

test("CLD-08 a code-only cell in a docs table stays on one line", async ({ page }) => {
  await page.goto("/docs/architecture");
  const cell = page.locator(".markdown td:first-child > code", { hasText: /^packages\/viewer\/$/ });
  expect(await cell.evaluate((code) => code.getClientRects().length)).toBe(1);
});

test("CLD-08 the Free plan's Get Started opens the guide", async ({ page }) => {
  await page.goto("/pricing");
  await expect(page.locator("#free").getByRole("link", { name: "Get Started" })).toHaveAttribute("href", "/get-started");
});

test("CLD-08 the upload schema stays folded until Show the upload schema is clicked", async ({ page }) => {
  await page.goto("/privacy");
  const schema = page.locator("pre");
  await expect(schema).toBeHidden();
  await page.getByText("Show the upload schema").click();
  await expect(schema).toBeVisible();
});

test("CLD-08 Copy puts the whole upload schema on the clipboard, and the button then reads Copied", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/privacy");
  await page.getByText("Show the upload schema").click();
  await page.getByRole("button", { name: "Copy the upload schema" }).click();
  await expect(page.getByRole("button", { name: "Copied" })).toBeVisible();
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(JSON.parse(copied).title).toBe("aisus cloud upload");
});

test("CLD-08 choosing the VSIX tab shows the Install from VSIX steps", async ({ page }) => {
  await page.goto("/get-started");
  const vsix = page.locator("#vsix");
  await expect(vsix).toBeHidden();
  await page.getByRole("tab", { name: "VSIX" }).click();
  await expect(vsix).toBeVisible();
  await expect(vsix).toContainText("Install from VSIX…");
});

test("CLD-08 choosing Codex shows its install command and $aisus-architecture, and the choice survives a reload", async ({ page }) => {
  await page.goto("/get-started");
  await page.getByRole("tab", { name: "Codex" }).click();
  await expect(page.locator("#agent-codex")).toBeVisible();
  await expect(page.locator("#agent-codex")).toContainText("npm install -g @openai/codex");
  await expect(page.locator("#generate")).toContainText("$aisus-architecture checkout flow");
  await page.reload();
  await expect(page.getByRole("tab", { name: "Codex" })).toHaveAttribute("aria-selected", "true");
  await expect(page.locator("#generate")).toContainText("$aisus-architecture checkout flow");
});

test("CLD-08 the left panel lists pages without their sections, and marks the page being read", async ({ page }) => {
  await page.goto("/get-started");
  const tree = page.getByRole("navigation", { name: "Guide" });
  await expect(tree.locator("a[aria-current=page]")).toHaveText("Get Started");
  await expect(tree.getByRole("link", { name: "1. Installation" })).toHaveCount(0);
  await expect(tree.getByRole("button")).toHaveCount(0);
});

test("CLD-08 the IntelliJ page's Download button opens /install/intellij", async ({ page }) => {
  await page.goto("/get-started/intellij");
  await expect(page.locator("h1")).toHaveText("Installation for IntelliJ IDEA");
  await expect(page.getByRole("link", { name: "Download the IntelliJ release" })).toHaveAttribute("href", "/install/intellij");
});

test("CLD-08 the left panel lists /aisus-pr as a link with no chevron, and it opens Explain a PR with /aisus-pr", async ({ page }) => {
  await page.goto("/get-started");
  const tree = page.getByRole("navigation", { name: "Guide" });
  await expect(tree.getByRole("button", { name: /\/aisus-pr/ })).toHaveCount(0);
  await tree.getByRole("link", { name: "/aisus-pr", exact: true }).click();
  await expect(page.locator("h1")).toHaveText("Explain a PR with /aisus-pr");
});

test("CLD-08 after choosing Codex on Get Started, the /aisus-pr page shows $aisus-pr", async ({ page }) => {
  await page.goto("/get-started");
  await page.getByRole("tab", { name: "Codex" }).click();
  await page.goto("/get-started/aisus-pr");
  await expect(page.locator("#run")).toContainText("$aisus-pr");
});

test("CLD-08 the billed app's pricing shows Pro's and Team's price texts", async ({ page }) => {
  await page.goto(`http://127.0.0.1:${BILLED_APP}/pricing`);
  const pricing = page.locator("main");
  await expect(pricing).toContainText("Pro costs $5 a month for your own repositories.");
  await expect(pricing).toContainText("Team costs $10 per seat a month for an organization, with the team dashboard.");
});

test("CLD-08 choosing the Sequence diagram tab presses it and shows the sequence demo", async ({ page }) => {
  await page.goto("/");
  const tab = page.getByRole("button", { name: "Sequence diagram" });
  await tab.click();
  await expect(tab).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("img", { name: /^A sequence diagram of generating a map/ })).toBeVisible();
});

test("CLD-08 opening an FAQ question shows its answer", async ({ page }) => {
  await page.goto("/");
  const answer = page.getByText("Source files stay on your machine or CI runner.");
  await expect(answer).toBeHidden();
  await page.getByText("Does my code leave my machine?").click();
  await expect(answer).toBeVisible();
});

test("CLD-08 at phone width the homepage is no wider than the window and the header keeps the brand and Get Started", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto("/");
  await expect(page.locator("h1")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
  await expect(page.locator(".site-header .brand img")).toBeVisible();
  await expect(page.locator(".site-header").getByRole("link", { name: "Get Started" })).toBeVisible();
});

test("CLD-08 at desktop width the header's Get Started sits in the centred capsule after the links, and Sign in sits to its right", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  const header = page.locator(".site-header");
  const capsule = header.locator(".header-centre");
  const start = capsule.getByRole("link", { name: "Get Started" });
  await expect(start).toHaveAttribute("href", "/get-started");
  const bar = (await header.boundingBox())!;
  const group = (await capsule.boundingBox())!;
  const button = (await start.boundingBox())!;
  const lastLink = (await capsule.locator(".nav a").last().boundingBox())!;
  const signIn = (await header.locator(".top-r .account a").boundingBox())!;
  expect(Math.abs(group.x + group.width / 2 - (bar.x + bar.width / 2))).toBeLessThanOrEqual(2);
  expect(button.x).toBeGreaterThan(lastLink.x + lastLink.width);
  expect(signIn.x).toBeGreaterThan(group.x + group.width);
});

test("CLD-08 at phone width the header's Get Started is at least 44 pixels tall and sits beside the menu button", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const button = (await page.locator(".site-header").getByRole("link", { name: "Get Started" }).boundingBox())!;
  const menu = (await page.locator(".site-header .menu summary").boundingBox())!;
  expect(button.height).toBeGreaterThanOrEqual(44);
  expect(menu.x).toBeGreaterThan(button.x + button.width);
  expect(menu.x - (button.x + button.width)).toBeLessThanOrEqual(12);
});
