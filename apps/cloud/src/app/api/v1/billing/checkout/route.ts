// CLD-07: POST {account} answers a Stripe Checkout page. The user's own account buys Pro for one
// person, and an organization's account buys Team for its seats.
import { planToBuy } from "../../../../../../plans";
import { checkoutUrl, seatsOf } from "../../../../../lib/billing";
import { billedAccount } from "../../../../../lib/billingRequests";
import { refuse } from "../../../../../lib/requests";
import { services } from "../../../../../lib/services";

export async function POST(request: Request): Promise<Response> {
  const billed = await billedAccount(request);
  if (billed instanceof Response) return billed;
  const plan = planToBuy(billed.account, billed.user.login);
  const seats = plan === "pro" ? 1 : await seatsOf(await services().db(), billed.account);
  try {
    return Response.json({ url: await checkoutUrl(billed.config, billed.account, plan, seats, billed.site) });
  } catch (error) {
    return refuse(502, `Stripe could not start the checkout: ${(error as Error).message}`);
  }
}
