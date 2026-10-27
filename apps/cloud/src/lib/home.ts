// P-7: the signed-in home. It lists the user's repositories by account, from GitHub's list and the
// repositories aisus already stores, with each account's plan and each repository's latest map.
import { inArray } from "drizzle-orm";
import type { Plan } from "../../plans";
import type { Database } from "../db/client";
import { repositories } from "../db/schema";
import { roleFor, spacesOf, type Role, type SignedIn } from "./access";
import { planOfAccount, storedPlan } from "./billing";
import type { GitHubApi } from "./github";
import { mainMapTimes } from "./store";

/** The cookie that remembers Skip for now. */
export const FIRST_RUN_COOKIE = "aisus_first_run";

export interface HomeRepository {
  owner: string;
  name: string;
  private: boolean;
  role: Role;
  /** When the main map arrived, or `null` when there is none. */
  mapAt: Date | null;
}

export interface HomeAccount {
  login: string;
  personal: boolean;
  /** Whether the user belongs to it: it is their own, or GitHub lists them as a member of the organization. */
  member: boolean;
  /** Whether the user may buy its plan: it is their own, they administer the organization, or they own one of its repositories. */
  admin: boolean;
  plan: Plan;
  subscribed: boolean;
  repositories: HomeRepository[];
}

/** The user's accounts: their own first, then their organizations, then other owners of their repositories, each by login. */
export async function homeOf(db: Database, github: GitHubApi, user: SignedIn): Promise<HomeAccount[]> {
  const [listed, memberships, spaces] = await Promise.all([github.repositories(user.githubToken), github.memberships(user.githubToken), spacesOf(db, user.userId)]);
  const stored = listed.length === 0 ? [] : await db.select({ id: repositories.id, githubId: repositories.githubId }).from(repositories).where(inArray(repositories.githubId, listed.map((repo) => repo.id)));
  const idOf = new Map(stored.map((row) => [row.githubId, row.id]));
  const times = await mainMapTimes(db, [...stored.map((row) => row.id), ...spaces.map((space) => space.repo.id)]);
  const repos = new Map<string, HomeRepository>();
  // A stored role was checked with GitHub within the hour. GitHub's list is newer, so it wins.
  for (const { repo, role } of spaces) repos.set(`${repo.owner}/${repo.name}`, { owner: repo.owner, name: repo.name, private: repo.private, role, mapAt: times.get(repo.id) ?? null });
  for (const repo of listed) {
    const role = roleFor(repo.permissions);
    const id = idOf.get(repo.id);
    if (role !== null) repos.set(`${repo.owner}/${repo.name}`, { owner: repo.owner, name: repo.name, private: repo.private, role, mapAt: id === undefined ? null : (times.get(id) ?? null) });
  }
  const logins = [user.login, ...memberships.map((membership) => membership.login).sort(), ...[...repos.values()].map((repo) => repo.owner).sort()];
  return Promise.all(
    [...new Set(logins)].map(async (login) => {
      const own = [...repos.values()].filter((repo) => repo.owner === login).sort((a, b) => a.name.localeCompare(b.name));
      const membership = memberships.find((entry) => entry.login === login);
      const plan = await planOfAccount(db, login);
      const customer = (await storedPlan(db, login))?.stripeCustomer ?? null;
      return {
        login,
        personal: login === user.login,
        member: login === user.login || membership !== undefined,
        admin: login === user.login || membership?.admin === true || own.some((repo) => repo.role === "owner"),
        plan,
        subscribed: customer !== null && (plan.id === "pro" || plan.id === "team"),
        repositories: own,
      };
    }),
  );
}

/** Whether the first run shows: no account the user belongs to keeps maps, and they have not skipped it. With billing off every account keeps maps. */
export function firstRunDue(accounts: HomeAccount[], skipped: boolean): boolean {
  return !skipped && !accounts.some((account) => account.member && account.plan.cloud);
}
