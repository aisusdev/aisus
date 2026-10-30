// P-7: the first run after signing in. Step 1 picks the account, step 2 starts its plan through Stripe
// Checkout, and step 3 follows Checkout with the account's repositories to set up.
import { planToBuy, type BillingConfig, type PaidPlanId } from "../../plans";
import { FIRST_RUN_COOKIE, type HomeAccount } from "../lib/home";
import { CopyButton, PlanButton, SkipFirstRun } from "./Actions";
import { RepositoryRows } from "./Home";

const OFFERS: Readonly<Record<PaidPlanId, { label: string; summary: (account: string) => string; features: readonly string[] }>> = {
  pro: { label: "Pro", summary: () => "Keep the maps of your own repositories in aisus cloud.", features: ["Full map history", "Pull request pages", "Read-only share links"] },
  team: { label: "Team", summary: (account) => `Keep ${account}’s maps available to its members, with a team dashboard.`, features: ["Organization repositories", "Full history and pull request pages", "Team dashboard and share links"] },
};

function Step({ n, title, lede, children }: { n: number; title: string; lede: string; children: React.ReactNode }) {
  return (
    <main className="page first-run">
      <p className="first-run__step">Step {n} of 3</p>
      <h1>{title}</h1>
      <p className="first-run__lede">{lede}</p>
      {children}
    </main>
  );
}

/** Step 1: the user's own account and each organization they belong to. A member who is not an admin can ask one. */
export function PickAccount({ accounts, login, billing }: { accounts: HomeAccount[]; login: string; billing: BillingConfig }) {
  return (
    <Step n={1} title="Where will your maps live?" lede="Choose your own account or an organization you administer.">
      <ul className="choices">
        {accounts
          .filter((account) => account.member)
          .map((account) => {
            const offer = planToBuy(account.login, login);
            const price = billing.priceTexts[offer];
            return (
              <li key={account.login} className="choice">
                <div>
                  <h2>
                    {OFFERS[offer].label} for {account.login}
                  </h2>
                  {account.admin ? (
                    <p>
                      {OFFERS[offer].summary(account.login)}
                      {price ? ` ${OFFERS[offer].label} is ${price}.` : ""}
                    </p>
                  ) : (
                    <p>Only an admin of {account.login} can start Team for it. Send them a link to this page.</p>
                  )}
                </div>
                {account.admin ? (
                  <a className="button button--primary" href={`/?account=${encodeURIComponent(account.login)}`}>
                    Choose {account.login}
                  </a>
                ) : (
                  <CopyButton path={`/?account=${encodeURIComponent(account.login)}`} label={`Copy link for an admin of ${account.login}`} />
                )}
              </li>
            );
          })}
      </ul>
      <p className="first-run__foot">
        <SkipFirstRun cookie={FIRST_RUN_COOKIE} />
      </p>
    </Step>
  );
}

/** Step 2: the plan the account can buy, its price, and Checkout. */
export function StartPlan({ account, login, billing }: { account: HomeAccount; login: string; billing: BillingConfig }) {
  const offer = planToBuy(account.login, login);
  const price = billing.priceTexts[offer];
  return (
    <Step n={2} title={`Start ${OFFERS[offer].label} for ${account.login}`} lede={billing.payments ? "Checkout opens on Stripe. You come back here when it is done." : "Payments are off for now, so the plan starts at once."}>
      <section className="choice choice--plan">
        <div>
          <h2>
            {OFFERS[offer].label} for {account.login}
          </h2>
          <p>
            {OFFERS[offer].summary(account.login)}
            {price ? ` ${OFFERS[offer].label} is ${price}.` : ""}
          </p>
          <ul>
            {OFFERS[offer].features.map((feature) => (
              <li key={feature}>{feature}</li>
            ))}
          </ul>
        </div>
        <PlanButton url="/api/v1/billing/checkout" account={account.login} label={billing.payments ? "Continue to checkout" : `Start ${OFFERS[offer].label}`} primary />
      </section>
      <p className="first-run__foot">
        <a href="/">Choose another account</a> <SkipFirstRun cookie={FIRST_RUN_COOKIE} label="Not now, keep using the free extension" />
      </p>
    </Step>
  );
}

/** Step 3: back from Checkout. The webhook may land a moment after the user does. */
export function SetUpRepository({ account }: { account: HomeAccount }) {
  const ready = account.plan.cloud;
  return (
    <Step
      n={3}
      title={ready ? `${account.login} is on ${account.plan.label}` : `Stripe is confirming ${account.login}’s plan`}
      lede={ready ? "Set up a repository. Its settings hold the command that publishes its map." : "Reload in a few seconds to see the new plan."}
    >
      <section className="account-card">
        <RepositoryRows account={account} />
      </section>
      <p className="first-run__foot">
        <a href="/">Go to your repositories</a>
      </p>
    </Step>
  );
}
