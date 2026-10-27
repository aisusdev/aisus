// CLD-18: the team page's people, their highest roles and the seats.
import { expect, test } from "vitest";
import { openDatabase } from "../../src/db/client";
import { access, users } from "../../src/db/schema";
import { setPlan } from "../../src/lib/billing";
import { upsertRepository } from "../../src/lib/store";
import { teamOf } from "../../src/lib/team";

test("CLD-18 each person with access to the account's repositories is listed once with their highest role, and the seats are those bought and those listed", async () => {
  const db = await openDatabase();
  const shop = await upsertRepository(db, { githubId: 1, owner: "acme", name: "shop", private: true, defaultBranch: "main" });
  const site = await upsertRepository(db, { githubId: 2, owner: "acme", name: "site", private: false, defaultBranch: "main" });
  const other = await upsertRepository(db, { githubId: 3, owner: "globex", name: "app", private: true, defaultBranch: "main" });
  const [ann, bob, cat, dee] = await db
    .insert(users)
    .values([
      { githubId: 11, login: "ann", name: "Ann Example" },
      { githubId: 12, login: "bob", name: null },
      { githubId: 13, login: "cat", name: "Cat Example" },
      { githubId: 14, login: "dee", name: null },
    ])
    .returning();
  await db.insert(access).values([
    { userId: ann!.id, repoId: shop.id, role: "viewer" },
    { userId: ann!.id, repoId: site.id, role: "owner" },
    { userId: bob!.id, repoId: shop.id, role: "member" },
    { userId: dee!.id, repoId: site.id, role: "member" },
    { userId: cat!.id, repoId: other.id, role: "owner" },
  ]);
  await setPlan(db, "acme", { plan: "team", seats: 5 });

  expect(await teamOf(db, "acme")).toEqual({
    people: [
      { login: "ann", name: "Ann Example", role: "owner" },
      { login: "bob", name: null, role: "member" },
      { login: "dee", name: null, role: "member" },
    ],
    seatsBought: 5,
    seatsInUse: 3,
  });
  expect(await teamOf(db, "nobody")).toEqual({ people: [], seatsBought: null, seatsInUse: 0 });
});
