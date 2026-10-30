// CLD-05 [web]: the team dashboard lists each repository of the organization the user can see, with
// its main map, the latest check's figures, the hotspots and the recent pull requests.
import { expect, test } from "@playwright/test";
import { check, MAP, signInAsDev, upload } from "./support";

test("CLD-05 the organization's dashboard shows each repository's map, figures, hotspots and pull requests", async ({ page, request }) => {
  await upload(request, "acme/board", { branch: "main", kind: "map", map: MAP, meta: { defaultBranch: "main" } });
  await upload(request, "acme/board", check(12));
  await signInAsDev(page, "/cloud/u/acme?tab=dashboard");
  const card = page.getByRole("region", { name: "board" });
  await expect(card.locator(".cloud-card__head")).toContainText("boxes");
  const figure = (label: string) => card.locator(".repo-card__stats div", { has: page.locator("dt", { hasText: label }) }).locator("dd");
  await expect(figure("Stale boxes")).toHaveText("1");
  await expect(figure("Uncovered files")).toHaveText("1");
  await expect(card).toContainText("Most changed: first (1)");
  await expect(card.getByRole("link", { name: "#12" })).toHaveAttribute("href", "/cloud/u/acme/board/pull/12");
  for (const label of await page.locator(".dashboard-totals dt, .repo-card dt").allTextContents()) expect(label).not.toMatch(/author|who/i);
});
