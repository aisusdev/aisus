// CLD-07: who may buy or manage an account's plan: a signed-in owner of one of its repositories, from
// this site, while billing is on.
import { and, eq } from "drizzle-orm";
import { billingConfig, type BillingConfig } from "../../plans";
import { access, repositories } from "../db/schema";
import { checkAccess, type SignedIn } from "./access";
import { refuse, signedIn, siteOf } from "./requests";
import { services } from "./services";

/**
 * The account named in the request's body when the user owns one of its repositories, or a refusal.
 * GitHub confirms the ownership on every request. Each stored repository is asked in turn, and
 * `checkAccess` updates or removes a row whose access has changed.
 */
export async function billedAccount(request: Request): Promise<{ user: SignedIn; account: string; config: BillingConfig; site: string } | Response> {
  const config = billingConfig();
  if (config === null) return refuse(404, "Billing is off on this server.");
  const user = await signedIn(request);
  if (user instanceof Response) return user;
  const body = (await request.json().catch(() => ({}))) as { account?: unknown };
  if (typeof body.account !== "string" || body.account === "") return refuse(400, "Name the account.");
  const { db: database, github, now } = services();
  const db = await database();
  const rows = await db
    .select({ name: repositories.name })
    .from(access)
    .innerJoin(repositories, eq(access.repoId, repositories.id))
    .where(and(eq(access.userId, user.userId), eq(access.role, "owner"), eq(repositories.owner, body.account)));
  let confirmed = false;
  for (const row of rows) {
    if ((await checkAccess(db, github(), user, body.account, row.name, now(), true))?.role === "owner") {
      confirmed = true;
      break;
    }
  }
  if (!confirmed) return refuse(403, "Only an owner of one of the account's repositories can change its plan.");
  return { user, account: body.account, config, site: siteOf(request) };
}
