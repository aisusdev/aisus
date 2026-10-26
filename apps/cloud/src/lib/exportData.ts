// CLD-13: everything aisus cloud holds for a user, as one JSON document: their account, their
// organizations, and each repository they own with its plan, tokens (never the secrets), share
// links (never the links), and every team upload, and their own personal maps (CLD-14).
import { and, asc, eq } from "drizzle-orm";
import type { Database } from "../db/client";
import { repositories as repositoryTable, shareLinks, tokens, uploads, users } from "../db/schema";
import { organizationsOf, spacesOf } from "./access";
import { storedPlan } from "./billing";

export async function exportData(db: Database, userId: number, now = new Date()): Promise<Record<string, unknown>> {
  const [user] = await db.select({ login: users.login, name: users.name, createdAt: users.createdAt }).from(users).where(eq(users.id, userId));
  const owned = (await spacesOf(db, userId)).filter((space) => space.role === "owner");
  const repositories = [];
  for (const { repo } of owned) {
    const plan = await storedPlan(db, repo.owner);
    repositories.push({
      owner: repo.owner,
      name: repo.name,
      defaultBranch: repo.defaultBranch,
      private: repo.private,
      publicMaps: repo.publicMaps,
      createdAt: repo.createdAt,
      plan: plan === undefined ? null : { plan: plan.plan, seats: plan.seats, stripeCustomer: plan.stripeCustomer, updatedAt: plan.updatedAt },
      tokens: await db.select({ name: tokens.name, createdAt: tokens.createdAt, lastUsedAt: tokens.lastUsedAt }).from(tokens).where(eq(tokens.repoId, repo.id)).orderBy(asc(tokens.id)),
      shareLinks: await db.select({ id: shareLinks.id, expiresAt: shareLinks.expiresAt, revokedAt: shareLinks.revokedAt, createdAt: shareLinks.createdAt }).from(shareLinks).where(eq(shareLinks.repoId, repo.id)).orderBy(asc(shareLinks.id)),
      uploads: await db
        .select({ id: uploads.id, kind: uploads.kind, commit: uploads.commit, branch: uploads.branch, pull: uploads.pull, via: uploads.via, size: uploads.size, createdAt: uploads.createdAt, payload: uploads.payload })
        .from(uploads)
        .where(and(eq(uploads.repoId, repo.id), eq(uploads.space, "team")))
        .orderBy(asc(uploads.id)),
    });
  }
  const personalMaps = await db
    .select({ id: uploads.id, owner: repositoryTable.owner, name: repositoryTable.name, commit: uploads.commit, branch: uploads.branch, size: uploads.size, createdAt: uploads.createdAt, payload: uploads.payload })
    .from(uploads)
    .innerJoin(repositoryTable, eq(uploads.repoId, repositoryTable.id))
    .where(and(eq(uploads.space, "personal"), eq(uploads.userId, userId)))
    .orderBy(asc(uploads.id));
  return { exportedAt: now.toISOString(), user: user ?? null, organizations: await organizationsOf(db, userId), repositories, personalMaps };
}
