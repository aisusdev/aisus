// P-7 and CLD-20: the first run's step 2, the plan an account the user may buy for can start, and Checkout. Anyone else is shown step 1.
import { redirect } from "next/navigation";
import { billingConfig } from "../../../../../plans";
import { StartPlan } from "../../../../components/FirstRun";
import { homeOf } from "../../../../lib/home";
import { CLOUD, signInPath, startPath } from "../../../../lib/paths";
import { services } from "../../../../lib/services";

export const dynamic = "force-dynamic";

export default async function StartPlanPage({ params }: { params: Promise<{ account: string }> }) {
  const { account: login } = await params;
  const user = await services().user();
  if (!user) redirect(signInPath(startPath(login)));
  const billing = billingConfig();
  if (billing === null) redirect(CLOUD);
  const account = (await homeOf(await services().db(), services().github(), user)).find((entry) => entry.login === login && entry.admin);
  if (!account) redirect(startPath());
  return <StartPlan account={account} login={user.login} billing={billing} />;
}
