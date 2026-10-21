// /api/metrics (owner request, 2026-10-22): the cloud's counts for Prometheus, for the bearer of
// METRICS_TOKEN only. Without the setting the route does not exist.
import { metricsAllowed, metricsText } from "../../../lib/metrics";
import { services } from "../../../lib/services";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  if (!process.env["METRICS_TOKEN"]) return new Response("Not found", { status: 404 });
  if (!metricsAllowed(request.headers.get("authorization"))) return new Response("Unauthorized", { status: 401 });
  return new Response(await metricsText(await services().db()), { headers: { "content-type": "text/plain; version=0.0.4; charset=utf-8" } });
}
