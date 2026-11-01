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
  await expect(page.locator("h1")).toHaveText("Get started with aisus");
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
