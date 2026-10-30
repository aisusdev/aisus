// CLD-20: the rail beside the cloud's account pages. It lists every account the user can see, each with
// its plan, and the user's own settings.
import type { ReactNode } from "react";
import type { HomeAccount } from "../lib/home";
import { accountPath, CLOUD, CLOUD_SETTINGS } from "../lib/paths";

export function CloudShell({ accounts, current, billing, children }: { accounts: HomeAccount[]; current: string | null; billing: boolean; children: ReactNode }) {
  return (
    <div className="cloud-shell">
      <nav className="cloud-rail" aria-label="Accounts">
        <h2>Accounts</h2>
        <a href={CLOUD} aria-current={current === null ? "page" : undefined}>
          All repositories
        </a>
        {accounts.map((account) => (
          <a key={account.login} href={accountPath(account.login)} aria-current={current === account.login ? "page" : undefined}>
            {account.login}
            {billing ? <span className={account.plan.cloud ? "chip plan-badge" : "chip chip--free"}>{account.plan.label}</span> : null}
          </a>
        ))}
        <hr />
        <a href={CLOUD_SETTINGS}>Account settings</a>
      </nav>
      <main className="page cloud-main">{children}</main>
    </div>
  );
}
