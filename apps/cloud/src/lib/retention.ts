// CLD-13: the daily job that enforces each plan's history. Uploads older than the plan keeps are
// removed, except the newest map of each repository's default branch, so a quiet repository keeps
// its map. Personal maps follow their owner's plan, keeping the newest map of each branch (CLD-14).
import { and, desc, eq, lt, ne, notInArray } from "drizzle-orm";
import type { Database } from "../db/client";
import { repositories, uploads, users } from "../db/schema";
import { planOfAccount } from "./billing";
import { historySince } from "./store";

/** How often the job runs. */
export const RETENTION_INTERVAL_MS = 86_400_000;

/** Removes the uploads every repository's plan no longer keeps; returns how many went. */
export async function enforceRetention(db: Database, now = new Date(), env: NodeJS.ProcessEnv = process.env): Promise<number> {
  let removed = 0;
  for (const repo of await db.select().from(repositories)) {
    const since = historySince(await planOfAccount(db, repo.owner, env), now);
    if (since === null) continue;
    const [main] = await db
      .select({ id: uploads.id })
      .from(uploads)
      .where(and(eq(uploads.repoId, repo.id), eq(uploads.kind, "map"), eq(uploads.space, "team"), eq(uploads.branch, repo.defaultBranch)))
      .orderBy(desc(uploads.createdAt), desc(uploads.id))
      .limit(1);
    const old = and(eq(uploads.repoId, repo.id), eq(uploads.space, "team"), lt(uploads.createdAt, since), ...(main === undefined ? [] : [ne(uploads.id, main.id)]));
    removed += (await db.delete(uploads).where(old).returning({ id: uploads.id })).length;
  }
  for (const user of await db.select({ id: users.id, login: users.login }).from(users)) {
    const since = historySince(await planOfAccount(db, user.login, env), now);
    if (since === null) continue;
    const newest = await db
      .selectDistinctOn([uploads.repoId, uploads.branch], { id: uploads.id })
      .from(uploads)
      .where(and(eq(uploads.space, "personal"), eq(uploads.userId, user.id)))
      .orderBy(uploads.repoId, uploads.branch, desc(uploads.createdAt), desc(uploads.id));
    const old = and(eq(uploads.space, "personal"), eq(uploads.userId, user.id), lt(uploads.createdAt, since), ...(newest.length === 0 ? [] : [notInArray(uploads.id, newest.map((row) => row.id))]));
    removed += (await db.delete(uploads).where(old).returning({ id: uploads.id })).length;
  }
  return removed;
}
