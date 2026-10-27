// CLD-18: the team page at /<org>/team. It lists who has signed in with access to the account's
// repositories and the seats they take. Nothing here reads what anyone did.
import { eq } from "drizzle-orm";
import type { Database } from "../db/client";
import { access, repositories, users } from "../db/schema";
import type { Role } from "./access";
import { storedPlan } from "./billing";

export interface TeamPerson {
  login: string;
  name: string | null;
  /** The highest role the person holds on any of the account's repositories. */
  role: Role;
}

export interface Team {
  /** Owners first, then members, then viewers, each by login. */
  people: TeamPerson[];
  /** The seats Stripe last reported for the account, or `null` before it reports any. */
  seatsBought: number | null;
  /** One seat for each person listed. */
  seatsInUse: number;
}

const RANK: Record<Role, number> = { viewer: 1, member: 2, owner: 3 };

export async function teamOf(db: Database, account: string): Promise<Team> {
  const rows = await db
    .select({ id: users.id, login: users.login, name: users.name, role: access.role })
    .from(access)
    .innerJoin(repositories, eq(access.repoId, repositories.id))
    .innerJoin(users, eq(access.userId, users.id))
    .where(eq(repositories.owner, account));
  const byUser = new Map<number, TeamPerson>();
  for (const row of rows) {
    const held = byUser.get(row.id);
    if (held === undefined || RANK[row.role] > RANK[held.role]) byUser.set(row.id, { login: row.login, name: row.name, role: row.role });
  }
  const people = [...byUser.values()].sort((a, b) => RANK[b.role] - RANK[a.role] || a.login.localeCompare(b.login));
  return { people, seatsBought: (await storedPlan(db, account))?.seats ?? null, seatsInUse: people.length };
}
