// /install/intellij: redirects to the newest release's IntelliJ plugin, as /install does for the VS Code extension.
import { installUrl } from "../../../lib/install";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  return Response.redirect(await installUrl(process.env, fetch, Date.now(), "intellij"), 302);
}
