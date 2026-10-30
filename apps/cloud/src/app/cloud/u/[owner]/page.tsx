// CLD-20: one page per account, with three tabs. Repositories lists the account's repositories the user
// can see. Dashboard is CLD-05's team dashboard, which comes with Team: totals over the account's
// repositories, then each repository's main map, its freshness, uncovered files and violations from the
// latest check, the boxes pull requests touch most, a trend and recent pull requests. Nothing is per
// person. People is CLD-18's team page: who has signed in with access to the account's repositories,
// each with their highest role, and the seats. GitHub decides who belongs, so the tab links there.
import { redirect } from "next/navigation";
import { relativeAge } from "@aisus/core/model/home";
import { billingConfig } from "../../../../../plans";
import { PlanButton } from "../../../../components/Actions";
import { CloudShell } from "../../../../components/CloudShell";
import { RepositoryRows } from "../../../../components/Home";
import { PlanGate } from "../../../../components/PlanGate";
import { spacesOf, type SignedIn } from "../../../../lib/access";
import { personalAccount, planOfAccount, storedPlan } from "../../../../lib/billing";
import { dashboardFor, TREND_CHECKS, type DashboardRepo } from "../../../../lib/dashboard";
import { homeOf, type HomeAccount } from "../../../../lib/home";
import { accountPath, pullPath, repoPath, signInPath, type AccountTab } from "../../../../lib/paths";
import { services } from "../../../../lib/services";
import { teamOf, type Team } from "../../../../lib/team";

export const dynamic = "force-dynamic";

const TABS: readonly { id: AccountTab; label: string }[] = [
  { id: "repositories", label: "Repositories" },
  { id: "dashboard", label: "Dashboard" },
  { id: "people", label: "People" },
];

function figure(value: number | null): string {
  return value === null ? "—" : String(value);
}

function total(rows: DashboardRepo[], pick: (row: DashboardRepo) => number | null): number {
  return rows.reduce((sum, row) => sum + (pick(row) ?? 0), 0);
}

function seatsText(team: Team): string {
  const used = `${team.seatsInUse} ${team.seatsInUse === 1 ? "seat" : "seats"}`;
  return team.seatsBought === null ? `${used} in use.` : `${team.seatsInUse} of ${team.seatsBought} seats in use.`;
}

function RepoCard({ repo, now }: { repo: DashboardRepo; now: Date }) {
  return (
    <section className="cloud-card repo-card" aria-label={repo.name}>
      <header className="cloud-card__head">
        <h2>
          <a href={repoPath(repo.owner, repo.name)}>{repo.name}</a> {repo.private ? <span className="chip">Private</span> : null}
        </h2>
        <span className="muted">
          <i className={repo.mapAt === null ? "dot dot--none" : (repo.stale ?? 0) > 0 ? "dot dot--stale" : "dot"} aria-hidden="true" />
          {repo.mapAt === null ? "No map" : `Main map ${relativeAge(repo.mapAt, now)}${repo.boxes === null ? "" : ` · ${repo.boxes} boxes`}`}
        </span>
      </header>
      <dl className="repo-card__stats">
        <div>
          <dt>Stale boxes</dt>
          <dd>{figure(repo.stale)}</dd>
        </div>
        <div>
          <dt>Uncovered files</dt>
          <dd>{figure(repo.uncovered)}</dd>
        </div>
        <div>
          <dt>Violations</dt>
          <dd>{figure(repo.violations)}</dd>
        </div>
        <div>
          <dt>Stale, last {TREND_CHECKS} checks</dt>
          <dd aria-label={`Stale boxes over the last ${repo.trend.length} checks`}>{repo.trend.length === 0 ? "—" : repo.trend.map((point) => point.stale).join(" → ")}</dd>
        </div>
      </dl>
      {repo.hotspots.length > 0 ? (
        <p>
          <b>Most changed:</b> {repo.hotspots.map((box) => `${box.label} (${box.pulls})`).join(", ")}
        </p>
      ) : null}
      {repo.pulls.length > 0 ? (
        <div className="repo-card__pulls">
          <b>Recent pull requests:</b>
          <ul className="dashboard__pulls">
            {repo.pulls.map((pull) => (
              <li key={pull.number}>
                <a href={pullPath(repo.owner, repo.name, pull.number)}>#{pull.number}</a> {pull.result === "fail" ? "fails" : "passes"}
                {pull.boxes.length > 0 ? ` · ${pull.boxes.join(", ")}` : ""}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

async function Dashboard({ owner, user }: { owner: string; user: SignedIn }) {
  const { db: openDb, github, now: clock } = services();
  const db = await openDb();
  // CLD-07: the dashboard comes with the Team plan.
  const plan = await planOfAccount(db, owner);
  if (!plan.dashboard) return <PlanGate owner={owner} message={`The team dashboard comes with the Team plan. ${owner} is on ${plan.label}.`} user={user} />;
  const now = clock();
  const rows = await dashboardFor(db, github(), user, owner, now);
  if (rows.length === 0) return <p className="muted">No repository of {owner} that you can see has a map in aisus cloud yet.</p>;
  return (
    <>
      <dl className="dashboard-totals">
        <div>
          <dt>Repositories with maps</dt>
          <dd>{rows.filter((row) => row.mapAt !== null).length}</dd>
        </div>
        <div>
          <dt>Stale boxes</dt>
          <dd>{total(rows, (row) => row.stale)}</dd>
        </div>
        <div>
          <dt>Files on no box</dt>
          <dd>{total(rows, (row) => row.uncovered)}</dd>
        </div>
        <div>
          <dt>Open violations</dt>
          <dd>{total(rows, (row) => row.violations)}</dd>
        </div>
      </dl>
      <div className="cloud-stack dashboard">
        {rows.map((repo) => (
          <RepoCard key={repo.name} repo={repo} now={now} />
        ))}
      </div>
    </>
  );
}

async function People({ owner, user }: { owner: string; user: SignedIn }) {
  const db = await services().db();
  const roles = (await spacesOf(db, user.userId)).filter((space) => space.repo.owner === owner).map((space) => space.role);
  if (roles.length === 0) return <p className="muted">The People tab opens for people with access to one of {owner}&apos;s repositories in aisus cloud.</p>;
  const team = await teamOf(db, owner);
  const plan = await planOfAccount(db, owner);
  const customer = (await storedPlan(db, owner))?.stripeCustomer ?? null;
  const manage = billingConfig()?.payments === true && customer !== null && plan.id === "team" && roles.includes("owner");
  const organization = !(await personalAccount(db, owner));
  return (
    <>
      <section className="cloud-card seats">
        <div>
          <h2>Seats</h2>
          <p className="team__seats">{plan.id === "team" ? seatsText(team) : `${owner} is on ${plan.label}, which has no seats.`}</p>
          {plan.id === "team" && team.seatsBought !== null && team.seatsBought > 0 ? (
            <div className="seats__meter" aria-hidden="true">
              <i style={{ width: `${Math.min(100, (100 * team.seatsInUse) / team.seatsBought)}%` }} />
            </div>
          ) : null}
        </div>
        {manage ? <PlanButton url="/api/v1/billing/portal" account={owner} label="Manage seats" /> : null}
      </section>
      <table className="team">
        <thead>
          <tr>
            <th scope="col">Person</th>
            <th scope="col">Role</th>
          </tr>
        </thead>
        <tbody>
          {team.people.map((person) => (
            <tr key={person.login}>
              <th scope="row">
                {person.login}
                {person.name ? <span className="muted"> · {person.name}</span> : null}
              </th>
              <td>{person.role}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {organization ? (
        <p>
          <a href={`https://github.com/orgs/${owner}/people`}>Invite or remove people on GitHub</a>
        </p>
      ) : null}
    </>
  );
}

function Repositories({ account, owner }: { account: HomeAccount | undefined; owner: string }) {
  return account ? <RepositoryRows account={account} /> : <p className="muted">No repositories of {owner} that you can see.</p>;
}

export default async function AccountPage({ params, searchParams }: { params: Promise<{ owner: string }>; searchParams: Promise<{ tab?: string }> }) {
  const { owner } = await params;
  const { tab: asked } = await searchParams;
  const tab = TABS.find((entry) => entry.id === asked)?.id ?? "repositories";
  const user = await services().user();
  if (user === null) redirect(signInPath(accountPath(owner, tab)));
  const db = await services().db();
  const accounts = await homeOf(db, services().github(), user);
  const account = accounts.find((entry) => entry.login === owner);
  const billing = billingConfig() !== null;
  const plan = account?.plan ?? (await planOfAccount(db, owner));
  const personal = account?.personal ?? (await personalAccount(db, owner));
  return (
    <CloudShell accounts={accounts} current={owner} billing={billing}>
      <h1>{owner}</h1>
      <p className="cloud-lede">
        {personal ? "Personal account" : "Organization"}
        {billing ? ` on ${plan.label}` : ""}.
      </p>
      <nav className="cloud-tabs" aria-label={`${owner} tabs`}>
        {TABS.map((entry) => (
          <a key={entry.id} href={accountPath(owner, entry.id)} aria-current={entry.id === tab ? "page" : undefined}>
            {entry.label}
          </a>
        ))}
      </nav>
      {tab === "dashboard" ? <Dashboard owner={owner} user={user} /> : tab === "people" ? <People owner={owner} user={user} /> : <Repositories account={account} owner={owner} />}
    </CloudShell>
  );
}
