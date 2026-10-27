// CLD-08 and P-7: signed out, `/` is the landing page. Signed in, it shows the first run until an
// account the user belongs to keeps maps or they skip it, and "Your repositories" after that.
// `?account=` opens step 2 for an account the user may buy for, and `?upgraded=` is step 3 after Checkout.
import { cookies } from "next/headers";
import { billingConfig } from "../../plans";
import { currentUser } from "../auth";
import { PickAccount, SetUpRepository, StartPlan } from "../components/FirstRun";
import { Home as RepositoryHome } from "../components/Home";
import { Landing } from "../components/Landing";
import { FIRST_RUN_COOKIE, firstRunDue, homeOf } from "../lib/home";
import { services } from "../lib/services";

export const dynamic = "force-dynamic";

export default async function Home({ searchParams }: { searchParams: Promise<{ account?: string; upgraded?: string }> }) {
  const user = await currentUser();
  if (!user) return <Landing />;
  const { account: chosen, upgraded } = await searchParams;
  const billing = billingConfig();
  const accounts = await homeOf(await services().db(), services().github(), user);
  const upgradedAccount = accounts.find((account) => account.login === upgraded);
  if (upgradedAccount) return <SetUpRepository account={upgradedAccount} />;
  const chosenAccount = accounts.find((account) => account.login === chosen && account.admin);
  if (billing !== null && chosenAccount) return <StartPlan account={chosenAccount} login={user.login} billing={billing} />;
  const skipped = (await cookies()).get(FIRST_RUN_COOKIE)?.value === "skipped";
  if (billing !== null && firstRunDue(accounts, skipped)) return <PickAccount accounts={accounts} login={user.login} billing={billing} />;
  return <RepositoryHome accounts={accounts} login={user.login} billing={billing !== null} />;
}
