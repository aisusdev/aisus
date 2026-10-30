// P-7 and CLD-20: the first run's step 1, which picks the account. With billing off every account keeps maps, so there is no first run.
import { redirect } from "next/navigation";
import { billingConfig } from "../../../../plans";
import { PickAccount } from "../../../components/FirstRun";
import { homeOf } from "../../../lib/home";
import { CLOUD, signInPath, startPath } from "../../../lib/paths";
import { services } from "../../../lib/services";

export const dynamic = "force-dynamic";

export default async function StartPage() {
  const user = await services().user();
  if (!user) redirect(signInPath(startPath()));
  const billing = billingConfig();
  if (billing === null) redirect(CLOUD);
  const accounts = await homeOf(await services().db(), services().github(), user);
  return <PickAccount accounts={accounts} login={user.login} billing={billing} />;
}
