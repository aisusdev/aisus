// CLD-07: POST {account} answers a Stripe Checkout page. The user's own account buys Pro for one
// person, and an organization's account buys Team for its seats. While payments are off, the plan
// starts at once and the answer is the first run's step 3 under /cloud.
import { planToBuy } from "../../../../../../plans";
import { checkoutUrl, seatsOf, setPlan } from "../../../../../lib/billing";
import { billedAccount } from "../../../../../lib/billingRequests";
import { startPath } from "../../../../../lib/paths";
import { refuse } from "../../../../../lib/requests";
import { services } from "../../../../../lib/services";

export async function POST(request: Request): Promise<Response> {
  const billed = await billedAccount(request);
  if (billed instanceof Response) return billed;
  const plan = planToBuy(billed.account, billed.user.login);
  const db = await services().db();
  const seats = plan === "pro" ? 1 : await seatsOf(db, billed.account);
  if (!billed.config.payments) {
    await setPlan(db, billed.account, { plan, seats }, services().now());
    return Response.json({ url: `${billed.site}${startPath(billed.account, true)}` });
  }
  try {
    return Response.json({ url: await checkoutUrl(billed.config, billed.account, plan, seats, billed.site) });
  } catch (error) {
    return refuse(502, `Stripe could not start the checkout: ${(error as Error).message}`);
  }
}
