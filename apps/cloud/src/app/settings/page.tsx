// The account: organizations, repository spaces and roles, the plans of the user's own account, the
// organizations they administer and the accounts they own repositories of, exporting the user's data,
// and deleting the account (CLD-01, CLD-07, CLD-11, CLD-13, P-7).
import { redirect } from "next/navigation";
import { billingConfig, planToBuy } from "../../../plans";
import { DeleteButton, PlanButton } from "../../components/Actions";
import { organizationsOf, spacesOf } from "../../lib/access";
import { planOfAccount, storedPlan } from "../../lib/billing";
import { services } from "../../lib/services";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await services().user();
  if (!user) redirect("/signin?callbackUrl=/settings");
  const db = await services().db();
  const orgs = await organizationsOf(db, user.userId);
  const spaces = await spacesOf(db, user.userId);
  const billing = billingConfig();
  // The user's own account and the organizations they administer can buy a plan before any of their repositories is stored.
  const administered = billing === null ? [] : (await services().github().memberships(user.githubToken)).filter((membership) => membership.admin).map((membership) => membership.login);
  const accounts = [...new Set([user.login, ...administered, ...spaces.filter((space) => space.role === "owner").map((space) => space.repo.owner)])].sort();
  const plans = await Promise.all(accounts.map(async (account) => ({ account, plan: await planOfAccount(db, account), customer: (await storedPlan(db, account))?.stripeCustomer ?? null })));
  return (
    <main className="page">
      <h1>{user.login}</h1>
      <h2>Organizations</h2>
      <p className="orgs">{orgs.length === 0 ? <span className="muted">None</span> : orgs.join(", ")}</p>
      <h2>Repositories</h2>
      {spaces.length === 0 ? (
        <p className="muted">Open a repository&apos;s map at /owner/name to add it here.</p>
      ) : (
        <ul className="spaces">
          {spaces.map(({ repo, role }) => (
            <li key={repo.id}>
              <a href={`/${repo.owner}/${repo.name}`}>
                {repo.owner}/{repo.name}
              </a>{" "}
              <span className="muted">{role}</span>
              {role === "owner" ? (
                <>
                  {" · "}
                  <a href={`/settings/${repo.owner}/${repo.name}`}>Settings</a>
                </>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      <h2>Plans</h2>
      {billing === null ? (
        <p className="muted">Billing is off on this server, so every account has every feature.</p>
      ) : (
        <ul className="plans">
          {plans.map(({ account, plan, customer }) => {
            // Your own account upgrades to Pro, and an organization's to Team. A subscription changes in the portal.
            const offer = planToBuy(account, user.login);
            const price = billing.priceTexts[offer];
            const subscribed = customer !== null && (plan.id === "pro" || plan.id === "team");
            const upgrade = !subscribed && (plan.id === "free" || (offer === "team" && plan.id === "pro"));
            return (
              <li key={account}>
                {account}: <strong className="plan-name">{plan.label}</strong>{" "}
                {subscribed ? (
                  <PlanButton url="/api/v1/billing/portal" account={account} label="Manage billing" />
                ) : upgrade && offer === "pro" ? (
                  <>
                    <span className="muted">Pro keeps the maps of your own repositories, public and private, with full history, pull request pages and share links.{price ? ` Pro is ${price}.` : ""}</span> <PlanButton url="/api/v1/billing/checkout" account={account} label="Upgrade to Pro" />
                  </>
                ) : upgrade ? (
                  <>
                    <span className="muted">Team keeps the maps of {account}&apos;s repositories for everyone in it, with the team dashboard.{price ? ` Team is ${price}.` : ""}</span> <PlanButton url="/api/v1/billing/checkout" account={account} label="Upgrade to Team" />
                  </>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
      <h2>Your data</h2>
      <p>
        <a href="/api/v1/account/export" download>
          Export your data
        </a>{" "}
        <span className="muted">as one JSON file: your account, your organizations, and every repository you own with its plan, tokens, share links and uploads. Token and link secrets are never kept, so they are not in it.</span>
      </p>
      <h2>Delete your account</h2>
      <p className="muted">Removes your account and every repository space it owns, with their maps, checks and tokens, at once.</p>
      <DeleteButton url="/api/v1/account" label="Delete my account" confirmText="Delete your account and everything it owns now?" then="signout" />
    </main>
  );
}
