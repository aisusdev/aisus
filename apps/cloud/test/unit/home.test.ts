// P-7: the signed-in home. The cloud reads the user's repositories and organization memberships from
// GitHub, knows when each repository's main map arrived, lets the user buy for their own account and
// the organizations they administer, and shows the first run until an account of theirs keeps maps.
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { POST as checkoutRoute } from "../../src/app/api/v1/billing/checkout/route";
import { openDatabase, type Database } from "../../src/db/client";
import { checkAccess, signIn, type SignedIn } from "../../src/lib/access";
import { setPlan } from "../../src/lib/billing";
import { githubApi, type GitHubApi } from "../../src/lib/github";
import { firstRunDue, homeOf } from "../../src/lib/home";
import { useServices } from "../../src/lib/services";
import { mainMapTimes, saveUpload, upsertRepository } from "../../src/lib/store";
import { COMMIT, MAP } from "../support/fixtures";

const BILLING = { STRIPE_SECRET_KEY: "sk_test_home", STRIPE_WEBHOOK_SECRET: "whsec_home", STRIPE_PRO_PRICE: "price_pro", STRIPE_TEAM_PRICE: "price_team" };
/** dev administers acme and is a member of crew. Every repository is dev's to read only. */
const github: GitHubApi = {
  async user() {
    return { id: 1, login: "dev", name: null };
  },
  async organizations() {
    return [];
  },
  async repository(_token, owner, name) {
    return { id: name.length, owner, name, private: false, defaultBranch: "main", permissions: { pull: true } };
  },
  async repositories() {
    return [];
  },
  async memberships() {
    return [
      { login: "acme", admin: true },
      { login: "crew", admin: false },
    ];
  },
};
let db: Database;
let me: SignedIn;
let restore: () => void;

beforeEach(async () => {
  db = await openDatabase();
  me = await signIn(db, github, "gho_token");
  restore = useServices({ db: async () => db, github: () => github, user: async () => me });
  Object.assign(process.env, BILLING);
});

afterEach(() => {
  restore();
  vi.unstubAllGlobals();
  for (const key of Object.keys(BILLING)) delete process.env[key];
});

describe("P-7 GitHub reads", () => {
  test("repositories and memberships read GitHub's answers into the cloud's shapes", async () => {
    const asked: string[] = [];
    const answers: Record<string, unknown> = {
      "/user/repos": [{ id: 5, name: "web", owner: { login: "acme" }, private: false, default_branch: "trunk", permissions: { admin: false, push: true, pull: true } }],
      "/user/memberships/orgs": [
        { role: "admin", state: "active", organization: { login: "acme" } },
        { role: "member", state: "active", organization: { login: "crew" } },
      ],
    };
    const github = githubApi("https://api.github.test", async (url) => {
      const path = new URL(String(url)).pathname;
      asked.push(String(url));
      return Response.json(answers[path]);
    });
    expect(await github.repositories("gho_token")).toEqual([{ id: 5, owner: "acme", name: "web", private: false, defaultBranch: "trunk", permissions: { admin: false, push: true, pull: true } }]);
    expect(await github.memberships("gho_token")).toEqual([
      { login: "acme", admin: true },
      { login: "crew", admin: false },
    ]);
    expect(asked).toEqual(["https://api.github.test/user/repos?sort=pushed&per_page=100", "https://api.github.test/user/memberships/orgs?state=active&per_page=100"]);
  });
});

describe("P-7 map times", () => {
  test("mainMapTimes answers each repository's latest default-branch map, and nothing for a repository with only checks or branch maps", async () => {
    const shop = await upsertRepository(db, { githubId: 1, owner: "acme", name: "shop", private: false, defaultBranch: "main" });
    const lab = await upsertRepository(db, { githubId: 2, owner: "acme", name: "lab", private: false, defaultBranch: "main" });
    const at = (iso: string): Date => new Date(iso);
    await saveUpload(db, { repoId: shop.id, kind: "map", commit: COMMIT, branch: "main", payload: MAP, via: "oidc", createdAt: at("2026-10-01T10:00:00Z") });
    await saveUpload(db, { repoId: shop.id, kind: "map", commit: COMMIT, branch: "main", payload: MAP, via: "oidc", createdAt: at("2026-10-02T10:00:00Z") });
    await saveUpload(db, { repoId: shop.id, kind: "map", commit: COMMIT, branch: "feature", payload: MAP, via: "oidc", createdAt: at("2026-10-03T10:00:00Z") });
    await saveUpload(db, { repoId: lab.id, kind: "check", commit: COMMIT, branch: "main", payload: {}, via: "oidc", createdAt: at("2026-10-03T10:00:00Z") });
    await saveUpload(db, { repoId: lab.id, kind: "map", commit: COMMIT, branch: "feature", payload: MAP, via: "oidc", createdAt: at("2026-10-03T10:00:00Z") });
    expect(await mainMapTimes(db, [shop.id, lab.id])).toEqual(new Map([[shop.id, at("2026-10-02T10:00:00Z")]]));
  });
});

describe("P-7 buying a plan", () => {
  test("Checkout accepts the user's own account and an organization they administer with no repository stored, refuses one where they are only a member, and returns to the home", async () => {
    const sent: URLSearchParams[] = [];
    vi.stubGlobal("fetch", async (_url: string, init: RequestInit) => {
      sent.push(new URLSearchParams(String(init.body)));
      return Response.json({ url: "https://checkout.stripe.test/session" });
    });
    const checkout = (account: string): Promise<Response> =>
      checkoutRoute(new Request("http://cloud.test/api/v1/billing/checkout", { method: "POST", body: JSON.stringify({ account }), headers: { "content-type": "application/json", origin: "http://cloud.test" } }));
    expect((await checkout("dev")).status).toBe(200);
    expect((await checkout("acme")).status).toBe(200);
    expect((await checkout("crew")).status).toBe(403);
    expect(sent.map((params) => [params.get("metadata[account]"), params.get("success_url"), params.get("cancel_url")])).toEqual([
      ["dev", "http://cloud.test/cloud/start/dev/done", "http://cloud.test/cloud"],
      ["acme", "http://cloud.test/cloud/start/acme/done", "http://cloud.test/cloud"],
    ]);
  });
});

describe("P-7 home", () => {
  test("homeOf groups repositories by account, the user's own first, and marks who can buy each plan; firstRunDue turns false after a plan, a skip, or with billing off", async () => {
    const listed = (id: number, owner: string, name: string, permissions: Record<string, boolean>) => ({ id, owner, name, private: false, defaultBranch: "main", permissions });
    const home: GitHubApi = {
      ...github,
      async repository(_token, owner, name) {
        return { id: 90, owner, name, private: true, defaultBranch: "main", permissions: { pull: true } };
      },
      async repositories() {
        return [listed(10, "dev", "open-journal", { admin: true }), listed(11, "acme", "web", { push: true }), listed(12, "crew", "docs", { pull: true }), listed(13, "other", "lib", { pull: true })];
      },
    };
    await checkAccess(db, home, me, "acme", "secret", new Date());
    const web = await upsertRepository(db, { githubId: 11, owner: "acme", name: "web", private: false, defaultBranch: "main" });
    await saveUpload(db, { repoId: web.id, kind: "map", commit: COMMIT, branch: "main", payload: MAP, via: "oidc", createdAt: new Date("2026-10-02T10:00:00Z") });

    const accounts = await homeOf(db, home, me);
    expect(accounts.map((account) => [account.login, account.personal, account.member, account.admin, account.plan.id])).toEqual([
      ["dev", true, true, true, "free"],
      ["acme", false, true, true, "free"],
      ["crew", false, true, false, "free"],
      ["other", false, false, false, "free"],
    ]);
    expect(accounts.map((account) => account.repositories.map((repo) => [repo.name, repo.private, repo.role, repo.mapAt?.toISOString() ?? null]))).toEqual([
      [["open-journal", false, "owner", null]],
      [
        ["secret", true, "viewer", null],
        ["web", false, "member", "2026-10-02T10:00:00.000Z"],
      ],
      [["docs", false, "viewer", null]],
      [["lib", false, "viewer", null]],
    ]);
    expect(firstRunDue(accounts, false)).toBe(true);
    expect(firstRunDue(accounts, true)).toBe(false);

    await setPlan(db, "other", { plan: "team", customer: "cus_other" });
    expect(firstRunDue(await homeOf(db, home, me), false)).toBe(true);
    await setPlan(db, "acme", { plan: "team", customer: "cus_acme" });
    const paid = await homeOf(db, home, me);
    expect(paid.find((account) => account.login === "acme")?.subscribed).toBe(true);
    expect(firstRunDue(paid, false)).toBe(false);

    for (const key of Object.keys(BILLING)) delete process.env[key];
    await setPlan(db, "acme", { plan: "free" });
    expect(firstRunDue(await homeOf(db, home, me), false)).toBe(false);
  });
});
