// CLD-14 and CLD-15: uploads through a GitHub sign-in reach a personal or the team space, Free's
// personal space holds three branches, and the pull API answers a branch's maps to those who may read them.
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { mapSha256 } from "@aisus/core/model/upload";
import { GET } from "../../src/app/api/v1/repos/[owner]/[repo]/maps/route";
import { POST } from "../../src/app/api/v1/uploads/route";
import { openDatabase, type Database } from "../../src/db/client";
import { setPlan } from "../../src/lib/billing";
import type { GitHubApi, GitHubPermissions } from "../../src/lib/github";
import { useServices } from "../../src/lib/services";
import { createTokenRecord, upsertRepository } from "../../src/lib/store";
import { newToken } from "../../src/lib/tokens";
import { MAP, mapUpload, oidcKeys, oidcToken } from "../support/fixtures";

const KEYS = oidcKeys();
const BILLING = { STRIPE_SECRET_KEY: "sk_test_spaces", STRIPE_WEBHOOK_SECRET: "whsec_spaces", STRIPE_PRO_PRICE: "price_pro", STRIPE_TEAM_PRICE: "price_team" };
/** Each token's user and what GitHub lets them do on each repository. */
const PEOPLE: Record<string, { id: number; login: string; repos: Record<string, GitHubPermissions> }> = {
  gho_ana: { id: 1, login: "ana", repos: { "acme/shop": { push: true, pull: true }, "acme/lab": { push: true, pull: true } } },
  gho_bo: { id: 2, login: "bo", repos: { "acme/shop": { pull: true }, "acme/lab": { pull: true } } },
  gho_cy: { id: 3, login: "cy", repos: {} },
};
const github: GitHubApi = {
  async user(token) {
    const person = PEOPLE[token];
    if (!person) throw new Error("GitHub /user: 401");
    return { id: person.id, login: person.login, name: null };
  },
  async organizations() {
    return [];
  },
  async repositories() {
    return [];
  },
  async memberships() {
    return [];
  },
  async repository(token, owner, name) {
    const permissions = PEOPLE[token]?.repos[`${owner}/${name}`];
    return permissions ? { id: name === "shop" ? 4242 : 4343, owner, name, private: true, defaultBranch: "main", permissions } : null;
  },
};

let db: Database;
let restore: () => void;

beforeEach(async () => {
  db = await openDatabase();
  restore = useServices({ db: async () => db, jwks: async () => KEYS.jwks, github: () => github });
});

afterEach(() => {
  restore();
  for (const key of Object.keys(BILLING)) delete process.env[key];
});

/** A map whose title tells it apart. */
function titled(title: string): unknown {
  return { ...MAP, meta: { ...(MAP["meta"] as object), title } };
}

function upload(bearer: string, fields: Record<string, unknown>): Promise<Response> {
  return POST(new Request("http://cloud.test/api/v1/uploads", { method: "POST", body: JSON.stringify(mapUpload(fields)), headers: { authorization: `Bearer ${bearer}` } }));
}

async function pull(bearer: string, query: string, repo = "acme/shop"): Promise<{ status: number; body: Record<string, any> }> {
  const [owner, name] = repo.split("/") as [string, string];
  const response = await GET(new Request(`http://cloud.test/api/v1/repos/${repo}/maps?${query}`, { headers: { authorization: `Bearer ${bearer}` } }), { params: Promise.resolve({ owner, repo: name }) });
  return { status: response.status, body: (await response.json()) as Record<string, any> };
}

describe("CLD-14 spaces", () => {
  test("read access uploads to the personal space only, write access to the team space, and a personal map is its owner's alone", async () => {
    expect((await upload("gho_bo", { branch: "feature", space: "personal", map: titled("bo's draft") })).status).toBe(201);
    const refused = await upload("gho_bo", { branch: "feature", map: titled("bo to the team") });
    expect(refused.status).toBe(403);
    expect(((await refused.json()) as { message: string }).message).toContain("needs write access");
    const shared = await upload("gho_ana", { branch: "feature", space: "team", map: titled("ana's feature") });
    expect(shared.status).toBe(201);
    expect(await shared.json()).toMatchObject({ url: "/acme/shop?branch=feature" });

    expect((await pull("gho_bo", "branch=feature")).body).toMatchObject({ personal: { space: "personal", map: { meta: { title: "bo's draft" } } }, team: { map: { meta: { title: "ana's feature" } } } });
    expect((await pull("gho_ana", "branch=feature")).body["personal"]).toBeNull();
  });

  test("an upload token or an OIDC token can't reach a personal space, and a stranger can't upload at all", async () => {
    const repo = await upsertRepository(db, { githubId: 4242, owner: "acme", name: "shop", private: true });
    const token = newToken();
    await createTokenRecord(db, repo.id, "ci", token, null);
    expect((await upload(token, { space: "personal" })).status).toBe(403);
    expect((await upload(oidcToken(KEYS.key), { space: "personal" })).status).toBe(403);
    expect((await upload("gho_cy", { space: "personal" })).status).toBe(403);
    expect((await upload("gho_nobody", { space: "personal" })).status).toBe(401);
  });

  test("on Free the personal space holds three branches across repositories, takes more maps on them, and refuses a fourth with 402", async () => {
    Object.assign(process.env, BILLING);
    expect((await upload("gho_bo", { branch: "a", space: "personal" })).status).toBe(201);
    expect((await upload("gho_bo", { branch: "b", space: "personal" })).status).toBe(201);
    expect((await upload("gho_bo", { repo: "acme/lab", branch: "a", space: "personal" })).status).toBe(201);
    expect((await upload("gho_bo", { branch: "a", space: "personal", map: titled("again") })).status).toBe(201);
    const fourth = await upload("gho_bo", { repo: "acme/lab", branch: "b", space: "personal" });
    expect(fourth.status).toBe(402);
    expect(((await fourth.json()) as { message: string }).message).toBe(
      "Your personal space on Free holds 3 branches: acme/lab a, acme/shop a, acme/shop b. Pro keeps every branch. Upgrade at http://cloud.test/settings.",
    );
    await setPlan(db, "bo", { plan: "pro" });
    expect((await upload("gho_bo", { repo: "acme/lab", branch: "b", space: "personal" })).status).toBe(201);
  });
});

describe("CLD-15 pull maps", () => {
  test("a branch's team map, the main map with its hash, and the default branch's history newest first", async () => {
    const first = (await (await upload("gho_ana", { branch: "main", map: titled("main one") })).json()) as { id: number };
    const second = (await (await upload("gho_ana", { branch: "main", map: titled("main two") })).json()) as { id: number };
    await upload("gho_ana", { branch: "feature", map: titled("feature") });
    const { status, body } = await pull("gho_bo", "branch=feature");
    expect(status).toBe(200);
    expect(body).toMatchObject({ defaultBranch: "main", team: { branch: "feature", map: { meta: { title: "feature" } } }, main: { id: second.id, map: { meta: { title: "main two" } } }, personal: null });
    expect(body["main"].sha256).toBe(mapSha256(titled("main two")));
    expect(body["main"].sha256).not.toBe(mapSha256(titled("main one")));
    expect(body["mainHistory"].map((row: { id: number }) => row.id)).toEqual([second.id, first.id]);
    expect((await pull("gho_bo", `id=${first.id}`)).body).toMatchObject({ entry: { id: first.id, map: { meta: { title: "main one" } } } });
    expect((await pull("gho_bo", "branch=other")).body).toMatchObject({ team: null, main: { id: second.id } });
  });

  test("an OIDC token for the repository reads its team maps, and anyone without access is refused", async () => {
    await upload("gho_ana", { branch: "main" });
    expect((await pull(oidcToken(KEYS.key), "branch=main")).body).toMatchObject({ team: { branch: "main" }, personal: null });
    expect((await pull(oidcToken(KEYS.key, { repository: "acme/lab" }), "branch=main")).status).toBe(403);
    expect((await pull("gho_cy", "branch=main")).status).toBe(403);
    expect((await pull("gho_nobody", "branch=main")).status).toBe(401);
    expect((await pull("gho_bo", "")).status).toBe(400);
  });

  test("when the account's plan keeps no team maps, only the user's personal map comes back", async () => {
    await upload("gho_ana", { branch: "feature" });
    await upload("gho_ana", { branch: "feature", space: "personal", map: titled("mine") });
    Object.assign(process.env, BILLING);
    expect((await pull("gho_ana", "branch=feature")).body).toMatchObject({ team: null, main: null, mainHistory: [], personal: { map: { meta: { title: "mine" } } } });
  });
});
