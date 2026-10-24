// CLD-07 [web]: on an app with billing on, Free keeps no maps. The user upgrades their own account to
// Pro and an organization to Team through Stripe Checkout (mocked), whose signed webhook sets each
// plan, and can then manage billing (ADR 0067).
import { expect, test } from "@playwright/test";
import { BILLED_APP, MAP, signInAsDev, upload } from "./support";

test.use({ baseURL: `http://127.0.0.1:${BILLED_APP}` });

const MAIN_MAP = { branch: "main", kind: "map", map: MAP, meta: { defaultBranch: "main" } };

test("CLD-07 the user upgrades their own account to Pro and an organization to Team through Checkout, and each then keeps maps and pull request pages (changed by ADR 0067: Free kept maps, and Team was the only paid plan)", async ({ page, request }) => {
  await signInAsDev(page, "/dev/journal");
  await expect(page.locator(".plan-note")).toHaveText("Maps in aisus cloud come with Pro, for your own repositories, or Team, for an organization's. dev is on Free.");
  await page.goto("/acme/paid");
  await upload(request, "dev/journal", MAIN_MAP, 402);
  await upload(request, "acme/paid", MAIN_MAP, 402);

  await page.goto("/settings");
  const own = page.locator(".plans li", { hasText: /^dev:/ });
  const org = page.locator(".plans li", { hasText: /^acme:/ });
  await expect(own.locator(".plan-name")).toHaveText("Free");
  await expect(own).toContainText("Pro is $5 a month.");
  await expect(org.locator(".plan-name")).toHaveText("Free");
  await expect(org).toContainText("Team is $10 per seat a month.");
  await expect(org.getByRole("button", { name: "Upgrade to Pro" })).toHaveCount(0);

  await own.getByRole("button", { name: "Upgrade to Pro" }).click();
  await page.waitForURL("**/settings?upgraded=dev");
  await expect(own.locator(".plan-name")).toHaveText("Pro");
  await expect(own.getByRole("button", { name: "Manage billing" })).toBeVisible();
  await upload(request, "dev/journal", MAIN_MAP);
  await page.goto("/dev/journal/pull/1");
  await expect(page.locator("main")).toContainText("No check uploaded for this pull request yet.");

  await page.goto("/settings");
  await org.getByRole("button", { name: "Upgrade to Team" }).click();
  await page.waitForURL("**/settings?upgraded=acme");
  await expect(org.locator(".plan-name")).toHaveText("Team");
  await expect(org.getByRole("button", { name: "Manage billing" })).toBeVisible();
  await upload(request, "acme/paid", MAIN_MAP);
  await page.goto("/acme/paid/pull/1");
  await expect(page.locator("main")).toContainText("No check uploaded for this pull request yet.");
});
