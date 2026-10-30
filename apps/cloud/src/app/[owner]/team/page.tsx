// CLD-18: the team page. It lists the people who have signed in with access to the account's
// repositories, each with their highest role, and the seats bought and in use. GitHub decides who
// belongs, so the page links there to invite or remove anyone. An owner manages the seats in
// Stripe's Customer Portal. It comes with every plan and shows nothing anyone did.
import { redirect } from "next/navigation";
import { billingConfig } from "../../../../plans";
import { PlanButton } from "../../../components/Actions";
import { spacesOf } from "../../../lib/access";
import { personalAccount, planOfAccount, storedPlan } from "../../../lib/billing";
import { services } from "../../../lib/services";
import { teamOf, type Team } from "../../../lib/team";

export const dynamic = "force-dynamic";

function seatsText(team: Team): string {
  const used = `${team.seatsInUse} ${team.seatsInUse === 1 ? "seat" : "seats"}`;
  return team.seatsBought === null ? `${used} in use.` : `${team.seatsInUse} of ${team.seatsBought} seats in use.`;
}

export default async function TeamPage({ params }: { params: Promise<{ owner: string }> }) {
  const { owner } = await params;
  const user = await services().user();
  if (user === null) redirect(`/signin?callbackUrl=${encodeURIComponent(`/${owner}/team`)}`);
  const db = await services().db();
  const roles = (await spacesOf(db, user.userId)).filter((space) => space.repo.owner === owner).map((space) => space.role);
  if (roles.length === 0) {
    return (
      <main className="page">
        <h1>{owner}</h1>
        <p className="muted">The team page opens for people with access to one of {owner}&apos;s repositories in aisus cloud.</p>
      </main>
    );
  }
  const team = await teamOf(db, owner);
  const plan = await planOfAccount(db, owner);
  const customer = (await storedPlan(db, owner))?.stripeCustomer ?? null;
  const manage = billingConfig()?.payments === true && customer !== null && plan.id === "team" && roles.includes("owner");
  const organization = !(await personalAccount(db, owner));
  return (
    <main className="page">
      <h1>{owner}</h1>
      <h2>People</h2>
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
      <h2>Seats</h2>
      <p className="team__seats">{plan.id === "team" ? seatsText(team) : `${owner} is on ${plan.label}, which has no seats.`}</p>
      {manage ? <PlanButton url="/api/v1/billing/portal" account={owner} label="Manage seats" /> : null}
    </main>
  );
}
