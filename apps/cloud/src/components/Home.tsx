// P-7: "Your repositories", one card per account with its plan, and each repository's map status
// with Open or Set up.
import { planToBuy } from "../../plans";
import type { HomeAccount } from "../lib/home";
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
          <span className="repo-row__status muted">{repo.mapAt ? `Map ${repo.mapAt.toISOString().slice(0, 10)}` : repo.role === "owner" ? "No map yet" : "No map yet. An admin can set it up."}</span>
          {repo.mapAt ? (
            <a className="button" href={`/${repo.owner}/${repo.name}`}>
              Open
            </a>
          ) : repo.role === "owner" ? (
            <a className="button" href={`/settings/${repo.owner}/${repo.name}`}>
              Set up
            </a>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

export function Home({ accounts, login, billing }: { accounts: HomeAccount[]; login: string; billing: boolean }) {
  return (
    <main className="page">
      <h1>Your repositories</h1>
      <p className="muted">Your public repositories, and the private ones aisus already holds maps of. The rest of your private repositories arrive with the aisus GitHub app.</p>
      {accounts.map((account) => {
        const offer = planToBuy(account.login, login);
        const upgrade = !account.subscribed && (!account.plan.cloud || (offer === "team" && account.plan.id === "pro"));
        return (
          <section key={account.login} className="account-card" aria-label={account.login}>
            <header className="account-card__head">
              <div>
                <h2>
                  {account.login} {billing ? <span className="chip plan-badge">{account.plan.label}</span> : null}
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
      })}
      <OpenRepository />
    </main>
  );
}
