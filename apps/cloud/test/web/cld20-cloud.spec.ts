// CLD-20 [web]: the signed-in pages sit under /cloud. A signed-out visit there goes to /cloud/signin and
// comes back after it, the landing page's Sign in opens it, every old signed-in path redirects to its new
// one, and account and repository pages sit under /cloud/u/<owner>.
import { expect, test } from "@playwright/test";
import { MAP, signInAsDev, upload } from "./support";

test("CLD-20 a signed-out visit to /cloud or /cloud/settings goes to /cloud/signin and returns after it", async ({ page }) => {
  await page.goto("/cloud");
  await expect(page).toHaveURL(/\/cloud\/signin\?callbackUrl=%2Fcloud$/);
  await page.goto("/cloud/settings");
  await expect(page).toHaveURL(/\/cloud\/signin\?callbackUrl=%2Fcloud%2Fsettings$/);
  await page.getByRole("button", { name: "Sign in with GitHub" }).click();
  await page.waitForURL("**/cloud/settings");
  await expect(page.locator("h1")).toHaveText("dev");
});

test("CLD-20 the landing page's Sign in opens /cloud/signin", async ({ page }) => {
  await page.goto("/");
  await page.locator(".site-header").getByRole("link", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/cloud\/signin$/);
  await expect(page.getByRole("button", { name: "Sign in with GitHub" })).toBeVisible();
});

test("CLD-20 each old signed-in path answers 308 to its new path with its query, and public paths answer without a redirect", async ({ request }) => {
  const moved: [string, string][] = [
    ["/signin?callbackUrl=%2Facme", "/cloud/signin?callbackUrl=%2Facme"],
    ["/settings", "/cloud/settings"],
    ["/settings/acme/shop", "/cloud/u/acme/shop/settings"],
    ["/?account=acme", "/cloud/start/acme"],
    ["/?upgraded=acme", "/cloud/start/acme/done"],
    ["/acme", "/cloud/u/acme?tab=dashboard"],
    ["/acme/team", "/cloud/u/acme?tab=people"],
    ["/acme/shop?branch=dev", "/cloud/u/acme/shop?branch=dev"],
    ["/acme/shop/pull/7", "/cloud/u/acme/shop/pull/7"],
    ["/acme/shop/pull/7/d/3", "/cloud/u/acme/shop/pull/7/d/3"],
  ];
  for (const [from, to] of moved) {
    const response = await request.get(from, { maxRedirects: 0 });
    expect(response.status(), from).toBe(308);
    const location = new URL(response.headers()["location"]!, "http://127.0.0.1");
    expect(location.pathname + location.search, from).toBe(to);
  }
  expect((await request.get("/pricing", { maxRedirects: 0 })).status()).toBe(200);
  expect((await request.get("/s/shr_unknown", { maxRedirects: 0 })).status()).toBe(404);
});

test("CLD-20 a repository named team has its map page, and an account named settings has its account page", async ({ page, request }) => {
  await upload(request, "acme/team", { branch: "main", kind: "map", map: MAP, meta: { defaultBranch: "main" } });
  await signInAsDev(page, "/cloud/u/acme/team");
  await expect(page.locator("#aisus-viewer .node").first()).toBeVisible();
  await page.goto("/cloud/u/settings");
  await expect(page.locator("h1")).toHaveText("settings");
});
