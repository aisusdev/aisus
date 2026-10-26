// CLD-07: aisus cloud's plans and what each allows (ADR 0067). The server enforces them; prices and
// Stripe's ids come from the environment. Without Stripe keys billing is off, and every account is Enterprise.

export type PlanId = "free" | "pro" | "team" | "enterprise";

/** The plans Stripe sells. */
export type PaidPlanId = "pro" | "team";

export interface Plan {
  id: PlanId;
  label: string;
  /** Whether aisus cloud keeps and shows the account's maps at all. */
  cloud: boolean;
  /** Days of map history kept, or `null` for all of it. */
  historyDays: number | null;
  pullPages: boolean;
  shareLinks: boolean;
  dashboard: boolean;
  /** Whether the maps of an organization's repositories are kept, as well as those of a person's own. */
  organizationRepositories: boolean;
  /** CLD-14: the branches a person's personal space holds across all repositories, or `null` for any number. */
  personalBranches: number | null;
}

export const PLANS: Readonly<Record<PlanId, Plan>> = {
  // Free shows no team maps, and its personal space holds three branches. Its 30 days of history decide what the daily retention job keeps of an account that stops paying.
  free: { id: "free", label: "Free", cloud: false, historyDays: 30, pullPages: false, shareLinks: false, dashboard: false, organizationRepositories: false, personalBranches: 3 },
  pro: { id: "pro", label: "Pro", cloud: true, historyDays: null, pullPages: true, shareLinks: true, dashboard: false, organizationRepositories: false, personalBranches: null },
  team: { id: "team", label: "Team", cloud: true, historyDays: null, pullPages: true, shareLinks: true, dashboard: true, organizationRepositories: true, personalBranches: null },
  enterprise: { id: "enterprise", label: "Enterprise", cloud: true, historyDays: null, pullPages: true, shareLinks: true, dashboard: true, organizationRepositories: true, personalBranches: null },
};

/** Billing's configuration: Stripe's secret key, the webhook's signing secret and the ids of the Pro and Team prices. */
export interface BillingConfig {
  secretKey: string;
  webhookSecret: string;
  prices: Readonly<Record<PaidPlanId, string>>;
  /** What each plan costs, as the settings page shows it, such as "$5 a month" and "$10 per seat a month". */
  priceTexts: Readonly<Record<PaidPlanId, string | null>>;
  /** Stripe's API, which tests replace. */
  apiUrl: string;
}

/** Billing's configuration, or `null` when billing is off because a Stripe value is missing. */
export function billingConfig(env: NodeJS.ProcessEnv = process.env): BillingConfig | null {
  const secretKey = env["STRIPE_SECRET_KEY"];
  const webhookSecret = env["STRIPE_WEBHOOK_SECRET"];
  const pro = env["STRIPE_PRO_PRICE"];
  const team = env["STRIPE_TEAM_PRICE"];
  if (!secretKey || !webhookSecret || !pro || !team) return null;
  return {
    secretKey,
    webhookSecret,
    prices: { pro, team },
    priceTexts: { pro: env["AISUS_PRO_PRICE_TEXT"] || null, team: env["AISUS_TEAM_PRICE_TEXT"] || null },
    apiUrl: (env["STRIPE_API_URL"] || "https://api.stripe.com").replace(/\/+$/, ""),
  };
}

/** The plan in force: the stored one while billing is on, Free when none is stored, and Enterprise when billing is off. */
export function planFor(stored: PlanId | null | undefined, env: NodeJS.ProcessEnv = process.env): Plan {
  return billingConfig(env) === null ? PLANS.enterprise : PLANS[stored ?? "free"];
}

/** The plan Checkout sells for `account` to the user signed in as `login`: Pro for their own account, and Team for an organization's. */
export function planToBuy(account: string, login: string): PaidPlanId {
  return account === login ? "pro" : "team";
}

/**
 * Why `plan` keeps no maps of a repository of `account`, or `null` when it keeps them. `organization`
 * tells an organization's account from a person's own.
 */
export function cloudRefusal(plan: Plan, account: string, repository: { organization: boolean }): string | null {
  if (!plan.cloud) return `Maps in aisus cloud come with Pro, for your own repositories, or Team, for an organization's. ${account} is on ${plan.label}.`;
  if (repository.organization && !plan.organizationRepositories) return `An organization's maps come with the Team plan. ${account} is on ${plan.label}.`;
  return null;
}
