// CLD-08 [web]: the public site, with no request leaving it, and pricing from billing's price texts.
import { expect, test } from "@playwright/test";
import { BILLED_APP } from "./support";

test("CLD-08 landing, docs, privacy and gallery render without any third-party request", async ({ page }) => {
  const hosts = new Set<string>();
  page.on("request", (request) => hosts.add(new URL(request.url()).host));
  await page.goto("/");
  await expect(page.locator("h1")).toHaveText("Trade some of your agent's output for understanding.");
  await expect(page.getByRole("img", { name: /aisus map of a checkout service/ })).toBeVisible();
  await expect(page.locator("#start a[href='/install']")).toHaveAttribute("data-umami-event", "install");
  await expect(page.locator("#pricing")).toContainText("This server gives every account everything in aisus cloud.");
  await page.goto("/docs");
  await expect(page.locator(".markdown h2").first()).toBeVisible();
  await page.getByRole("link", { name: "Architecture" }).first().click();
  await expect(page.locator(".markdown")).toContainText("aisus architecture");
  await page.goto("/privacy");
  await expect(page.locator("main")).toContainText("Maps, not code");
  await expect(page.locator("pre")).toContainText('"title": "aisus cloud upload"');
  await page.goto("/gallery");
  await expect(page.locator("h1")).toHaveText("Gallery");
  expect([...hosts]).toEqual(["127.0.0.1:3210"]);
});

test("CLD-08 the billed app's pricing shows Pro's and Team's price texts", async ({ page }) => {
  await page.goto(`http://127.0.0.1:${BILLED_APP}/`);
  const pricing = page.locator("#pricing");
  await expect(pricing).toContainText("Pro costs $5 a month for your own repositories.");
  await expect(pricing).toContainText("Team costs $10 per seat a month for an organization, with the team dashboard.");
});
