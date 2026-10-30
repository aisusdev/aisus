// CLD-14 [web]: the map page lists the team space's branches, and a branch's link shows its map.
import { expect, test } from "@playwright/test";
import { MAP, signInAsDev, upload } from "./support";

test("CLD-14 the map page lists each branch with a map, and ?branch= shows that branch's map", async ({ page, request }) => {
  const feature = { ...MAP, components: (MAP["components"] as unknown[]).slice(0, 3), connections: [] };
  await upload(request, "acme/branches", { branch: "main", kind: "map", map: MAP, meta: { defaultBranch: "main" } });
  await upload(request, "acme/branches", { branch: "feature/login", kind: "map", map: feature, meta: { defaultBranch: "main" } });
  await signInAsDev(page, "/cloud/u/acme/branches");
  await expect(page.locator("#aisus-viewer .node").first()).toBeVisible();
  await page.getByRole("navigation", { name: "Panel" }).getByRole("link", { name: "Branches" }).click();
  const branches = page.getByRole("list", { name: "Branches" }).getByRole("link");
  await expect(branches).toHaveText(["feature/login", "main"]);
  await expect(page.getByRole("list", { name: "Branches" }).getByRole("link", { name: "main" })).toHaveAttribute("aria-current", "page");

  await branches.first().click();
  await expect(page).toHaveURL(/\?branch=feature%2Flogin&panel=branches$/);
  await expect(page.locator("#aisus-viewer .node")).toHaveCount(3);
  await expect(page.locator(".map-side")).toContainText("Map of feature/login");
});
