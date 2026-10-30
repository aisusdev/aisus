// CLD-07: Checkout sells Pro and Team, signed Stripe webhooks set an account's plan, and the server
// enforces each plan's limits (ADR 0067). Without Stripe keys billing is off and every account has
// every feature.
import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { POST as webhook } from "../../src/app/api/stripe/webhook/route";
import { POST as checkoutRoute } from "../../src/app/api/v1/billing/checkout/route";
import { POST as portalRoute } from "../../src/app/api/v1/billing/portal/route";
import { POST as shareRoute } from "../../src/app/api/v1/repos/[owner]/[repo]/shares/route";
import { POST as uploadRoute } from "../../src/app/api/v1/uploads/route";
import { openDatabase, type Database } from "../../src/db/client";
import { checkAccess, signIn, type SignedIn } from "../../src/lib/access";
import { applyEvent, planOfAccount, setPlan, storedPlan } from "../../src/lib/billing";
import type { GitHubApi } from "../../src/lib/github";
import { useServices } from "../../src/lib/services";
import { historySince } from "../../src/lib/store";
import { billingConfig, PLANS, type BillingConfig } from "../../plans";
import { mapUpload, oidcKeys, oidcToken } from "../support/fixtures";

const SECRET = "whsec_unit";
/** The real time, since the OIDC tokens are signed with it. */
const NOW = new Date();
const KEYS = oidcKeys();
const BILLING = { STRIPE_SECRET_KEY: "sk_test_unit", STRIPE_WEBHOOK_SECRET: SECRET, STRIPE_PRO_PRICE: "price_pro", STRIPE_TEAM_PRICE: "price_team" };
const CONFIG = billingConfig({ ...process.env, ...BILLING }) as BillingConfig;
let db: Database;
let me: SignedIn;
let restore: () => void;

const github: GitHubApi = {
  async user() {
    return { id: 1, login: "dev", name: null };
  },
  async organizations() {
    return [{ id: 7, login: "acme" }];
  },
  async repositories() {
    return [];
  },
  async memberships() {
    return [];
  },
  async repository(_token, owner, name) {
    // The same id the OIDC tokens below carry for the repository.
    return { id: `${owner}/${name}`.length, owner, name, private: true, defaultBranch: "main", permissions: { admin: true } };
  },
};

beforeEach(async () => {
  db = await openDatabase();
  me = await signIn(db, github, "gho_token");
  restore = useServices({ db: async () => db, jwks: async () => KEYS.jwks, github: () => github, user: async () => me, now: () => NOW });
  Object.assign(process.env, BILLING);
});

afterEach(() => {
  restore();
  vi.unstubAllGlobals();
  for (const key of Object.keys(BILLING)) delete process.env[key];
});

function signed(payload: string, at = NOW, secret = SECRET): string {
  const time = Math.floor(at.getTime() / 1000);
  return `t=${time},v1=${createHmac("sha256", secret).update(`${time}.${payload}`).digest("hex")}`;
}

function post(payload: string, signature: string | null): Promise<Response> {
  return webhook(new Request("http://cloud.test/api/stripe/webhook", { method: "POST", body: payload, headers: signature === null ? {} : { "stripe-signature": signature } }));
}

describe("CLD-07 webhooks", () => {
  const completed = JSON.stringify({ type: "checkout.session.completed", data: { object: { client_reference_id: "acme", metadata: { account: "acme", plan: "team" }, customer: "cus_1", subscription: "sub_1" } } });

  test("a webhook signed with the secret sets the account to Team, and a wrong, missing or old signature changes nothing", async () => {
    expect((await post(completed, signed(completed, NOW, "whsec_other"))).status).toBe(400);
    expect((await post(completed, null)).status).toBe(400);
    expect((await post(completed, signed(completed, new Date(NOW.getTime() - 301_000)))).status).toBe(400);
    expect((await post(`${completed} `, signed(completed))).status).toBe(400);
    expect((await planOfAccount(db, "acme")).id).toBe("free");
    expect((await post(completed, signed(completed))).status).toBe(200);
    expect((await planOfAccount(db, "acme")).id).toBe("team");
  });

  test("a subscription that lapses or ends sets Free, and an active one sets Team with its seats", async () => {
    const subscription = (type: string, status: string): unknown => ({ type, data: { object: { status, metadata: { account: "acme" }, items: { data: [{ quantity: 4 }] } } } });
    await applyEvent(db, CONFIG, subscription("customer.subscription.updated", "active"), NOW);
    expect((await planOfAccount(db, "acme")).id).toBe("team");
    expect((await storedPlan(db, "acme"))?.seats).toBe(4);
    await applyEvent(db, CONFIG, subscription("customer.subscription.updated", "past_due"), NOW);
    expect((await planOfAccount(db, "acme")).id).toBe("free");
    await applyEvent(db, CONFIG, subscription("customer.subscription.updated", "trialing"), NOW);
    await applyEvent(db, CONFIG, subscription("customer.subscription.deleted", "canceled"), NOW);
    expect((await planOfAccount(db, "acme")).id).toBe("free");
  });

  test("a completed Checkout sets Pro or Team from its metadata, and Team without one; a subscription sets the plan of its price, or for another price the plan in the price's metadata, else in its own", async () => {
    const session = (account: string, plan: string): unknown => ({ type: "checkout.session.completed", data: { object: { client_reference_id: account, metadata: { account, plan }, customer: `cus_${account}` } } });
    await applyEvent(db, CONFIG, session("dev", "pro"), NOW);
    await applyEvent(db, CONFIG, session("acme", "team"), NOW);
    await applyEvent(db, CONFIG, { type: "checkout.session.completed", data: { object: { client_reference_id: "old", metadata: { account: "old" } } } }, NOW);
    expect([(await planOfAccount(db, "dev")).id, (await planOfAccount(db, "acme")).id, (await planOfAccount(db, "old")).id]).toEqual(["pro", "team", "team"]);
    const updated = (plan: string, price: string, pricePlan?: string): unknown => ({
      type: "customer.subscription.updated",
      data: { object: { status: "active", metadata: { account: "acme", plan }, items: { data: [{ quantity: 3, price: { id: price, ...(pricePlan ? { metadata: { plan: pricePlan } } : {}) } }] } } },
    });
    await applyEvent(db, CONFIG, updated("pro", "price_older_pro"), NOW);
    expect((await planOfAccount(db, "acme")).id).toBe("pro");
    await applyEvent(db, CONFIG, updated("team", "price_older_team"), NOW);
    expect((await planOfAccount(db, "acme")).id).toBe("team");
    await applyEvent(db, CONFIG, updated("team", "price_older_pro", "pro"), NOW);
    expect((await planOfAccount(db, "acme")).id).toBe("pro");
    await applyEvent(db, CONFIG, updated("pro", "price_team"), NOW);
    expect((await planOfAccount(db, "acme")).id).toBe("team");
  });
});

describe("CLD-07 Checkout", () => {
  test("Checkout sells Pro to the user's own account for one person and Team to an organization for its seats, with the plan in the session's and the subscription's metadata", async () => {
    const sent: URLSearchParams[] = [];
    vi.stubGlobal("fetch", async (_url: string, init: RequestInit) => {
      sent.push(new URLSearchParams(String(init.body)));
      return Response.json({ url: "https://checkout.stripe.test/session" });
    });
    await checkAccess(db, github, me, "dev", "journal", NOW);
    await checkAccess(db, github, me, "acme", "shop", NOW);
    const ops = await signIn(db, { ...github, user: async () => ({ id: 2, login: "ops", name: null }) }, "gho_ops");
    await checkAccess(db, github, ops, "acme", "shop", NOW);
    const checkout = (account: string): Promise<Response> =>
      checkoutRoute(new Request("http://cloud.test/api/v1/billing/checkout", { method: "POST", body: JSON.stringify({ account }), headers: { "content-type": "application/json", origin: "http://cloud.test" } }));
    expect((await checkout("dev")).status).toBe(200);
    expect((await checkout("acme")).status).toBe(200);
    const fields = (params: URLSearchParams): string[] =>
      ["line_items[0][price]", "line_items[0][quantity]", "metadata[account]", "metadata[plan]", "subscription_data[metadata][account]", "subscription_data[metadata][plan]"].map((key) => params.get(key) ?? "");
    expect(sent.map(fields)).toEqual([
      ["price_pro", "1", "dev", "pro", "dev", "pro"],
      ["price_team", "2", "acme", "team", "acme", "team"],
    ]);
  });

  test("Checkout and the portal ask GitHub again, and refuse with 403 a user who has lost admin access since the stored check", async () => {
    vi.stubGlobal("fetch", async () => Response.json({ url: "https://billing.stripe.test/session" }));
    await checkAccess(db, github, me, "acme", "shop", NOW);
    await setPlan(db, "acme", { plan: "team", customer: "cus_acme" }, NOW);
    const billing = (route: (request: Request) => Promise<Response>): Promise<Response> =>
      route(new Request("http://cloud.test/api/v1/billing", { method: "POST", body: JSON.stringify({ account: "acme" }), headers: { "content-type": "application/json", origin: "http://cloud.test" } }));
    expect((await billing(portalRoute)).status).toBe(200);
    useServices({ github: () => ({ ...github, repository: async (_token, owner, name) => ({ ...(await github.repository("", owner, name))!, permissions: { push: true } }) }) });
    expect((await billing(portalRoute)).status).toBe(403);
    expect((await billing(checkoutRoute)).status).toBe(403);
  });
});

describe("Payments off", () => {
  const post = (route: (request: Request) => Promise<Response>, account: string): Promise<Response> =>
    route(new Request("http://cloud.test/api/v1/billing", { method: "POST", body: JSON.stringify({ account }), headers: { "content-type": "application/json", origin: "http://cloud.test" } }));

  beforeEach(() => {
    for (const key of Object.keys(BILLING)) delete process.env[key];
    process.env["AISUS_PAYMENTS"] = "off";
  });

  afterEach(() => {
    delete process.env["AISUS_PAYMENTS"];
  });

  test("an account stays on Free until Upgrade, which gives the user's own account Pro and an organization Team at once, with no request to Stripe", async () => {
    const stripe = vi.fn();
    vi.stubGlobal("fetch", stripe);
    await checkAccess(db, github, me, "dev", "journal", NOW);
    await checkAccess(db, github, me, "acme", "shop", NOW);
    expect((await planOfAccount(db, "dev")).id).toBe("free");
    expect((await planOfAccount(db, "acme")).id).toBe("free");
    const dev = await post(checkoutRoute, "dev");
    expect(await dev.json()).toEqual({ url: "http://cloud.test/?upgraded=dev" });
    expect((await post(checkoutRoute, "acme")).status).toBe(200);
    expect((await planOfAccount(db, "dev")).id).toBe("pro");
    expect((await planOfAccount(db, "acme")).id).toBe("team");
    expect(stripe).not.toHaveBeenCalled();
  });

  test("the portal and the webhook answer 404", async () => {
    await checkAccess(db, github, me, "acme", "shop", NOW);
    await setPlan(db, "acme", { plan: "team", customer: "cus_acme" }, NOW);
    expect((await post(portalRoute, "acme")).status).toBe(404);
    expect((await webhook(new Request("http://cloud.test/api/stripe/webhook", { method: "POST", body: "{}" }))).status).toBe(404);
  });
});

describe("CLD-07 limits", () => {
  const upload = (repo: string, visibility: "private" | "public"): Promise<Response> =>
    uploadRoute(
      new Request("http://cloud.test/api/v1/uploads", {
        method: "POST",
        body: JSON.stringify(mapUpload({ repo })),
        headers: { authorization: `Bearer ${oidcToken(KEYS.key, { repository: repo, repository_id: repo.length, repository_owner: repo.split("/")[0], repository_visibility: visibility })}` },
      }),
    );

  test("Free refuses every upload with 402, naming Pro and Team and where to upgrade, and Team keeps an organization's maps (changed by ADR 0067: Free kept one private repository and any public ones)", async () => {
    const refused = await upload("acme/one", "private");
    expect(refused.status).toBe(402);
    expect(((await refused.json()) as { message: string }).message).toBe("Maps in aisus cloud come with Pro, for your own repositories, or Team, for an organization's. acme is on Free. Upgrade at http://cloud.test/settings.");
    expect((await upload("acme/open-docs", "public")).status).toBe(402);
    await setPlan(db, "acme", { plan: "team" }, NOW);
    expect((await upload("acme/one", "private")).status).toBe(201);
    expect((await upload("acme/open-docs", "public")).status).toBe(201);
  });

  test("Pro keeps the maps of the user's own repositories and refuses an organization's with 402", async () => {
    await setPlan(db, "dev", { plan: "pro" }, NOW);
    expect((await upload("dev/journal", "private")).status).toBe(201);
    await setPlan(db, "acme", { plan: "pro" }, NOW);
    const refused = await upload("acme/one", "private");
    expect(refused.status).toBe(402);
    expect(((await refused.json()) as { message: string }).message).toBe("An organization's maps come with the Team plan. acme is on Pro. Upgrade at http://cloud.test/settings.");
  });

  test("Free keeps 30 days of history and makes no share links; without Stripe keys every account has every feature", async () => {
    expect(historySince(PLANS.free, NOW)).toEqual(new Date(NOW.getTime() - 30 * 86_400_000));
    expect(historySince(PLANS.team, NOW)).toBeNull();
    expect((await upload("acme/one", "private")).status).toBe(402);
    const share = (): Promise<Response> =>
      shareRoute(new Request("http://cloud.test/api/v1/repos/acme/one/shares", { method: "POST", body: JSON.stringify({ days: 7 }), headers: { "content-type": "application/json", origin: "http://cloud.test" } }), { params: Promise.resolve({ owner: "acme", repo: "one" }) });
    expect((await share()).status).toBe(402);
    for (const key of Object.keys(BILLING)) delete process.env[key];
    expect((await planOfAccount(db, "acme")).id).toBe("enterprise");
    expect((await share()).status).toBe(201);
    expect((await upload("acme/second", "private")).status).toBe(201);
  });
});
