// CLD-03 [web]: a repository's main map in the shared viewer, with boxes opening GitHub at the map's
// commit, freshness from the latest check, history, and public maps for public repositories.
import { expect, test } from "@playwright/test";
import { check, COMMIT, MAP, signInAsDev, upload } from "./support";

test("CLD-03 the main map draws, opens GitHub at its commit, and lists its history", async ({ page, request }) => {
  await upload(request, "acme/shop", { branch: "main", kind: "map", map: MAP, meta: { defaultBranch: "main" } });
  await upload(request, "acme/shop", { ...check(1), branch: "main", meta: {} });
  await signInAsDev(page, "/cloud/u/acme/shop");
  await expect(page.locator("#aisus-viewer .node").first()).toBeVisible();
  expect(await page.locator("#aisus-viewer .node").count()).toBe((MAP["components"] as unknown[]).length);
  await expect(page.locator("#aisus-viewer .node--edited")).toHaveCount(1);
  await expect(page.locator(".freshness")).toContainText("1 of 12 boxes changed since this map");
  await expect(page.locator(".open select")).toHaveValue("github");
  await page.getByRole("navigation", { name: "Panel" }).getByRole("link", { name: "History" }).click();
  await expect(page.locator(".history li")).toHaveCount(1);
  await expect(page.locator("#aisus-viewer .node").first()).toBeVisible();

  // Headless Chromium blocks a popup from a synthetic click, so the page's window.open is recorded instead.
  await page.evaluate(() => {
    window.open = (url) => {
      document.body.dataset["opened"] = String(url);
      return null;
    };
  });
  const box = page.locator("#aisus-viewer .node").first();
  for (const type of ["pointerdown", "pointerup"]) await box.dispatchEvent(type, { button: 0, pointerId: 1, clientX: 10, clientY: 10 });
  await expect(page.locator("body")).toHaveAttribute("data-opened", `https://github.com/acme/shop/blob/${COMMIT}/src/api.ts#L3-L9`);
});

test("CLD-03 the map page and a pull request page draw the map with no site footer", async ({ page, request }) => {
  await upload(request, "acme/footless", { branch: "main", kind: "map", map: MAP, meta: { defaultBranch: "main" } });
  await upload(request, "acme/footless", check(3));
  await signInAsDev(page, "/cloud/u/acme/footless");
  await expect(page.locator("#aisus-viewer .node").first()).toBeVisible();
  await expect(page.locator(".site-footer")).toBeHidden();
  await page.goto("/cloud/u/acme/footless/pull/3");
  await expect(page.locator("#aisus-viewer .node").first()).toBeVisible();
  await expect(page.locator(".site-footer")).toBeHidden();
});

test("CLD-03 an owner makes a public repository's maps public, and then anyone can see them", async ({ page, browser, request }) => {
  await upload(request, "acme/open-map", { branch: "main", kind: "map", map: MAP, meta: { defaultBranch: "main" } });
  await signInAsDev(page, "/cloud/u/acme/open-map/settings");
  // The box reflects the saved setting, which the page shows after it reloads.
  await page.getByLabel("Anyone can see this repository's maps").click();
  await expect(page.getByLabel("Anyone can see this repository's maps")).toBeChecked();

  const visitor = await (await browser.newContext({ baseURL: "http://127.0.0.1:3210" })).newPage();
  await visitor.goto("/cloud/u/acme/open-map");
  await expect(visitor.locator("#aisus-viewer .node").first()).toBeVisible();
  await visitor.goto("/gallery");
  await expect(visitor.locator("h1")).toHaveText("404");
  await visitor.goto("/cloud/u/acme/shop");
  await expect(visitor).toHaveURL(/\/cloud\/signin/);
});
