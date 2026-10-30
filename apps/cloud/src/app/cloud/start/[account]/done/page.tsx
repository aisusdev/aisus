// P-7 and CLD-20: the first run's step 3, where Stripe's Checkout returns, with the account's repositories to set up.
import { notFound, redirect } from "next/navigation";
import { SetUpRepository } from "../../../../../components/FirstRun";
import { homeOf } from "../../../../../lib/home";
import { signInPath, startPath } from "../../../../../lib/paths";
import { services } from "../../../../../lib/services";

export const dynamic = "force-dynamic";

export default async function StartDonePage({ params }: { params: Promise<{ account: string }> }) {
  const { account: login } = await params;
  const user = await services().user();
  if (!user) redirect(signInPath(startPath(login, true)));
  const account = (await homeOf(await services().db(), services().github(), user)).find((entry) => entry.login === login);
  if (!account) notFound();
  return <SetUpRepository account={account} />;
}
