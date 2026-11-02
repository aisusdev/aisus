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
  await expect(hero.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/cloud/signin");
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
  await expect(page.locator(".markdown")).toContainText("aisus architecture");
  await page.goto("/privacy");
  await expect(page.locator("main")).toContainText("Maps, not code");
  await expect(page.locator("pre")).toContainText('"title": "aisus cloud upload"');
  await page.goto("/gallery");
  await expect(page.locator("h1")).toHaveText("404");
  expect([...hosts]).toEqual(["127.0.0.1:3210"]);
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

test("CLD-08 the guide's left panel opens the page being read, and its chevron folds the steps away", async ({ page }) => {
  await page.goto("/get-started");
  const tree = page.getByRole("navigation", { name: "Guide" });
  await expect(tree.getByRole("link", { name: "1. Installation" })).toBeVisible();
  await expect(tree.getByRole("link", { name: "1. Install the plugin" })).toBeHidden();
  await tree.getByRole("button", { name: "Hide the steps of Get Started" }).click();
  await expect(tree.getByRole("link", { name: "1. Installation" })).toBeHidden();
});

test("CLD-08 the IntelliJ page's Download button opens /install/intellij", async ({ page }) => {
  await page.goto("/get-started/intellij");
  await expect(page.locator("h1")).toHaveText("Installation for IntelliJ IDEA");
  await expect(page.getByRole("link", { name: "Download the IntelliJ release" })).toHaveAttribute("href", "/install/intellij");
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
