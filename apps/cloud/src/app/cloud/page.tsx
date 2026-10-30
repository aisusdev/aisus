// CLD-20: the signed-in home. It sends the user to the first run until an account they belong to keeps
// maps or they skip it (P-7), and shows "Your repositories" after that.
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { billingConfig } from "../../../plans";
import { CloudShell } from "../../components/CloudShell";
import { Home } from "../../components/Home";
import { FIRST_RUN_COOKIE, firstRunDue, homeOf } from "../../lib/home";
import { CLOUD, signInPath, startPath } from "../../lib/paths";
import { services } from "../../lib/services";

export const dynamic = "force-dynamic";

export default async function CloudHome() {
  const user = await services().user();
  if (!user) redirect(signInPath(CLOUD));
  const billing = billingConfig();
  const accounts = await homeOf(await services().db(), services().github(), user);
  const skipped = (await cookies()).get(FIRST_RUN_COOKIE)?.value === "skipped";
  if (billing !== null && firstRunDue(accounts, skipped)) redirect(startPath());
  return (
    <CloudShell accounts={accounts} current={null} billing={billing !== null}>
      <Home accounts={accounts} login={user.login} billing={billing !== null} />
    </CloudShell>
  );
}
