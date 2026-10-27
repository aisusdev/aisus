// CLD-07 and P-7: who may buy or manage an account's plan: the account's own person, an admin of the
// organization, or an owner of one of its repositories, from this site, while billing is on.
import { and, eq } from "drizzle-orm";
import { billingConfig, type BillingConfig } from "../../plans";
import type { Database } from "../db/client";
import { access, repositories } from "../db/schema";
import { checkAccess, type SignedIn } from "./access";
import type { GitHubApi } from "./github";
import { refuse, signedIn, siteOf } from "./requests";
import { services } from "./services";

/**
 * Whether `user` may buy or manage `account`'s plan. GitHub confirms it each time. The user's own
 * account always qualifies. An organization qualifies when GitHub says the user administers it, or
 * when they own one of its stored repositories, and `checkAccess` updates or removes a row whose
 * access has changed.
 */
export async function mayBuy(db: Database, github: GitHubApi, user: SignedIn, account: string, now: Date): Promise<boolean> {
  if (account === user.login) return true;
  if ((await github.memberships(user.githubToken)).some((membership) => membership.admin && membership.login === account)) return true;
  const rows = await db
    .select({ name: repositories.name })
    .from(access)
    .innerJoin(repositories, eq(access.repoId, repositories.id))
    .where(and(eq(access.userId, user.userId), eq(access.role, "owner"), eq(repositories.owner, account)));
  for (const row of rows) {
    if ((await checkAccess(db, github, user, account, row.name, now, true))?.role === "owner") return true;
  }
  return false;
}

/** The account named in the request's body when the user may buy its plan, or a refusal. */
export async function billedAccount(request: Request): Promise<{ user: SignedIn; account: string; config: BillingConfig; site: string } | Response> {
  const config = billingConfig();
  if (config === null) return refuse(404, "Billing is off on this server.");
  const user = await signedIn(request);
  if (user instanceof Response) return user;
  const body = (await request.json().catch(() => ({}))) as { account?: unknown };
  if (typeof body.account !== "string" || body.account === "") return refuse(400, "Name the account.");
  const { db, github, now } = services();
  if (!(await mayBuy(await db(), github(), user, body.account, now()))) return refuse(403, "Only the account's own person, an admin of the organization, or an owner of one of its repositories can change its plan.");
  return { user, account: body.account, config, site: siteOf(request) };
}
