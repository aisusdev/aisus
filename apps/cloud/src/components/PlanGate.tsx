// P-7: what a locked feature needs. Someone who may buy the account's plan gets Upgrade, and every
// other signed-in user is told whom to ask.
import { planToBuy } from "../../plans";
import type { SignedIn } from "../lib/access";
import { personalAccount } from "../lib/billing";
import { mayBuy } from "../lib/billingRequests";
import { services } from "../lib/services";
import { PlanButton } from "./Actions";

export async function PlanGate({ owner, message, user }: { owner: string; message: string; user: SignedIn | null }) {
  const { db: openDb, github, now } = services();
  const db = await openDb();
  const canBuy = user !== null && (await mayBuy(db, github(), user, owner, now()));
  const offer = user === null ? "team" : planToBuy(owner, user.login);
  return (
    <div className="plan-gate">
      <p className="muted plan-note">{message}</p>
      {canBuy ? (
        <PlanButton url="/api/v1/billing/checkout" account={owner} label={`Upgrade to ${offer === "pro" ? "Pro" : "Team"}`} primary />
      ) : user !== null ? (
        <p className="plan-gate__ask">{(await personalAccount(db, owner)) ? `Ask ${owner} to upgrade.` : `Ask an admin of ${owner} to upgrade.`}</p>
      ) : null}
    </div>
  );
}
