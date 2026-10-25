// CLD-08 [web]: the public site, with no request leaving it, and pricing from billing's price texts.
import { expect, test } from "@playwright/test";
import { BILLED_APP } from "./support";

test("CLD-08 landing, guide, pricing and privacy render without any third-party request", async ({ page }) => {
  const hosts = new Set<string>();
  page.on("request", (request) => hosts.add(new URL(request.url()).host));
  await page.goto("/");
  await expect(page.locator("h1")).toHaveText("Trade some of your agent's output for understanding.");
  await expect(page.getByRole("img", { name: /aisus map of a checkout service/ })).toBeVisible();
  await expect(page.locator("#start a[href='/install']")).toHaveAttribute("data-umami-event", "install");
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

test("CLD-08 the billed app's pricing shows Pro's and Team's price texts", async ({ page }) => {
  await page.goto(`http://127.0.0.1:${BILLED_APP}/pricing`);
  const pricing = page.locator("main");
  await expect(pricing).toContainText("Pro costs $5 a month for your own repositories.");
  await expect(pricing).toContainText("Team costs $10 per seat a month for an organization, with the team dashboard.");
});

test("CLD-08 the first map can be explored at phone width", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto("/");
  const canvas = page.locator(".pf-canvas");
  await expect(canvas).toBeVisible();
  expect(await canvas.evaluate((element) => element.scrollWidth - element.clientWidth)).toBeGreaterThan(100);
  await page.locator(".pf-node").filter({ hasText: "Payments" }).click();
  await expect(page.locator(".pf-node.sel")).toContainText("Payments");
});
