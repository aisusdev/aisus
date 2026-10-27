// P-7 [web]: on a billed app where no account has a plan yet, signing in lands on the first run. Skip
// for now shows "Your repositories" and stays skipped. Step 1 offers Pro for the user's own account,
// Team for the organizations they administer, and a link for an admin where they are only a member.
// Pro goes through the mocked Checkout to step 3, and the home then lists each account's repositories.
// The plan gate offers Upgrade to an admin and names whom to ask to everyone else, a new token comes
// inside its publish command, and a repository's settings tell a reader who can manage it.
import { expect, test } from "@playwright/test";
import { FIRST_RUN_APP, signInAsDev } from "./support";

test.use({ baseURL: `http://127.0.0.1:${FIRST_RUN_APP}` });

test("P-7 Skip for now shows the repositories, and later visits stay there", async ({ page }) => {
  await signInAsDev(page, "/");
  await expect(page.locator("h1")).toHaveText("Where will your maps live?");
  await page.getByRole("button", { name: "Skip for now" }).click();
  await expect(page.locator("h1")).toHaveText("Your repositories");
  await page.reload();
  await expect(page.locator("h1")).toHaveText("Your repositories");
});

test("P-7 the first run picks an account, starts Pro through Checkout and sets up a repository, and the home then lists every account", async ({ page }) => {
  await signInAsDev(page, "/");
  await expect(page.locator(".choice h2")).toHaveText(["Pro for dev", "Team for acme", "Team for crew", "Team for guild"]);
  const crew = page.locator(".choice", { hasText: "Team for crew" });
  await expect(crew).toContainText("Only an admin of crew can start Team for it.");
  await expect(crew.getByRole("button", { name: "Copy link for an admin of crew" })).toBeVisible();
  await expect(crew.getByRole("link")).toHaveCount(0);

  await page.getByRole("link", { name: "Choose dev" }).click();
  await expect(page.locator("h1")).toHaveText("Start Pro for dev");
  await expect(page.locator(".choice")).toContainText("Pro is $5 a month.");
  await page.getByRole("button", { name: "Continue to checkout" }).click();
  await page.waitForURL("**/?upgraded=dev");
  await expect(page.locator("h1")).toHaveText("dev is on Pro");
  await expect(page.getByRole("link", { name: "Set up" })).toHaveAttribute("href", "/settings/dev/open-journal");

  await page.getByRole("link", { name: "Go to your repositories" }).click();
  await expect(page.locator("h1")).toHaveText("Your repositories");
  await expect(page.locator(".account-card h2")).toHaveText(["dev Pro", "acme Free", "crew Free", "guild Free"]);
  await expect(page.getByRole("region", { name: "dev" }).getByRole("button", { name: "Manage billing" })).toBeVisible();
  await expect(page.getByRole("region", { name: "acme" }).getByRole("button", { name: "Upgrade to Team" })).toBeVisible();
  const reader = page.getByRole("region", { name: "crew" });
  await expect(reader.getByRole("button")).toHaveCount(0);
  await expect(reader.locator(".repo-row")).toContainText("No map yet. An admin can set it up.");
});

test("P-7 the plan gate offers Upgrade to an admin and names whom to ask to a reader, a new token comes with its publish command, and a reader's settings say who manages the repository", async ({ page }) => {
  await signInAsDev(page, "/acme/gated");
  await expect(page.locator(".plan-note")).toHaveText("Maps in aisus cloud come with Pro, for your own repositories, or Team, for an organization's. acme is on Free.");
  await expect(page.getByRole("button", { name: "Upgrade to Team" })).toBeVisible();

  await page.goto("/crew/gated");
  await expect(page.locator(".plan-note")).toHaveText("Maps in aisus cloud come with Pro, for your own repositories, or Team, for an organization's. crew is on Free.");
  await expect(page.locator(".plan-gate")).toContainText("Ask an admin of crew to upgrade.");
  await expect(page.locator(".plan-gate").getByRole("button")).toHaveCount(0);

  await page.goto("/settings/crew/gated");
  await expect(page.locator(".settings-denied")).toHaveText("Only admins of crew/gated on GitHub can manage it. Its map is at /crew/gated.");

  await page.goto("/settings/acme/gated");
  await page.getByRole("button", { name: "Create upload token" }).click();
  await expect(page.locator(".new-token")).toHaveText(new RegExp(`^AISUS_TOKEN=\\S+ node aisus\\.mjs publish --url http://127\\.0\\.0\\.1:${FIRST_RUN_APP}$`));
  await expect(page.locator(".publish-command")).toContainText("Your shell history keeps this token.");
});
