// /install (owner request, 2026-10-22): redirects to the newest release's VS Code extension.
import { installUrl } from "../../lib/install";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  return Response.redirect(await installUrl(), 302);
}
