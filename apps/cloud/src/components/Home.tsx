// P-7: "Your repositories", one card per account with its plan, and each repository's map status
// with Open or Set up. CLD-20 draws it beside the account rail at /cloud.
import { planToBuy } from "../../plans";
import type { HomeAccount } from "../lib/home";
import { repoPath, repoSettingsPath } from "../lib/paths";
import { OpenRepository, PlanButton } from "./Actions";

/** The account's repositories: Open for one with a map, Set up for its admins, and a note for everyone else. */
export function RepositoryRows({ account }: { account: HomeAccount }) {
  if (account.repositories.length === 0) return <p className="muted account-card__empty">No repositories of {account.login} yet.</p>;
  return (
    <ul className="repo-rows">
      {account.repositories.map((repo) => (
        <li key={repo.name} className="repo-row">
          <span className="repo-row__name">
            {repo.owner}/<strong>{repo.name}</strong> <span className="chip">{repo.private ? "Private" : "Public"}</span>
          </span>
          <span className="repo-row__status muted">
            <i className={repo.mapAt ? "dot" : "dot dot--none"} aria-hidden="true" />
            {repo.mapAt ? `Map ${repo.mapAt.toISOString().slice(0, 10)}` : repo.role === "owner" ? "No map yet" : "No map yet. An admin can set it up."}
          </span>
          {repo.mapAt ? (
            <a className="button" href={repoPath(repo.owner, repo.name)}>
              Open
            </a>
          ) : repo.role === "owner" ? (
            <a className="button button--primary" href={repoSettingsPath(repo.owner, repo.name)}>
              Set up
            </a>
          ) : <span />}
        </li>
      ))}
    </ul>
  );
}

/** One account's card: its name and plan, the plan button for whoever may buy it, and its repositories. */
export function AccountCard({ account, login, billing }: { account: HomeAccount; login: string; billing: boolean }) {
  const offer = planToBuy(account.login, login);
  const upgrade = !account.subscribed && (!account.plan.cloud || (offer === "team" && account.plan.id === "pro"));
  return (
    <section className="account-card" aria-label={account.login}>
      <header className="account-card__head">
        <div>
          <h2>
            {account.login} {billing ? <span className={account.plan.cloud ? "chip plan-badge" : "chip chip--free"}>{account.plan.label}</span> : null}
          </h2>
          <p className="muted">{account.personal ? "Personal account" : "Organization"}</p>
        </div>
        {billing && account.admin ? (
          account.subscribed ? (
            <PlanButton url="/api/v1/billing/portal" account={account.login} label="Manage billing" />
          ) : upgrade ? (
            <PlanButton url="/api/v1/billing/checkout" account={account.login} label={`Upgrade to ${offer === "pro" ? "Pro" : "Team"}`} />
          ) : null
        ) : null}
      </header>
      <RepositoryRows account={account} />
    </section>
  );
}

export function Home({ accounts, login, billing }: { accounts: HomeAccount[]; login: string; billing: boolean }) {
  return (
    <>
      <h1>Your repositories</h1>
      <p className="cloud-lede">Your public repositories, and the private ones aisus already holds maps of. The rest of your private repositories arrive with the aisus GitHub app.</p>
      <OpenRepository />
      <div className="cloud-stack">
        {accounts.map((account) => (
          <AccountCard key={account.login} account={account} login={login} billing={billing} />
        ))}
      </div>
    </>
  );
}
