// CLD-18 [web]: on an app with billing on, the team page lists the people with their roles, the seats
// and the GitHub people link. An owner of a subscribed organization gets Manage seats, and a viewer of
// another subscribed organization does not.
import { expect, test } from "@playwright/test";
import { BILLED_APP, signInAsDev, subscribe } from "./support";

test.use({ baseURL: `http://127.0.0.1:${BILLED_APP}` });

test("CLD-18 an owner of a subscribed organization sees its people, seats and Manage seats, and a viewer sees the page without Manage seats", async ({ page, request }) => {
  await signInAsDev(page, "/guild/guildhall");
  await page.goto("/crew/crewlog");
  await page.goto("/settings");
  await page.locator(".plans li", { hasText: /^guild:/ }).getByRole("button", { name: "Upgrade to Team" }).click();
  await page.waitForURL("**/?upgraded=guild");

  await page.goto("/guild");
  await page.getByRole("link", { name: "People and seats" }).click();
  await page.waitForURL("**/guild/team");
  await expect(page.locator(".team tbody th")).toHaveText(["dev · Dev Example"]);
  await expect(page.locator(".team tbody td")).toHaveText(["owner"]);
  await expect(page.getByRole("link", { name: "Invite or remove people on GitHub" })).toHaveAttribute("href", "https://github.com/orgs/guild/people");
  await expect(page.locator(".team__seats")).toHaveText("1 seat in use.");
  await page.getByRole("button", { name: "Manage seats" }).click();
  await expect(page.getByRole("heading", { name: "Billing portal" })).toBeVisible();

  await subscribe(request, "crew");
  await page.goto("/crew/team");
  await expect(page.locator(".team tbody th")).toHaveText(["dev · Dev Example"]);
  await expect(page.locator(".team tbody td")).toHaveText(["viewer"]);
  await expect(page.locator(".team__seats")).toHaveText("1 seat in use.");
  await expect(page.getByRole("button", { name: "Manage seats" })).toHaveCount(0);
});
