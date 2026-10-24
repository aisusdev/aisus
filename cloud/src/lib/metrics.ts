// /api/metrics (owner request, 2026-10-22): what the cloud holds, for the owner's Prometheus. Only
// counts leave it; no sample names a person, an account or a repository (CLD-05).
import { timingSafeEqual } from "node:crypto";
import { count, gt, isNull, ne, sql } from "drizzle-orm";
import type { Database } from "../db/client";
import { accountPlans, repositories, shareLinks, tokens, uploads, users } from "../db/schema";

const DAY_MS = 24 * 60 * 60_000;

function gauge(name: string, help: string, samples: readonly (readonly [labels: string, value: number])[]): string {
  return `# HELP ${name} ${help}\n# TYPE ${name} gauge\n${samples.map(([labels, value]) => `${name}${labels} ${value}\n`).join("")}`;
}

/** The value of the row whose key is `key`, or 0. */
function valueOf<K>(rows: readonly { key: K; n: number }[], key: K): number {
  return Number(rows.find((row) => row.key === key)?.n ?? 0);
}

/** Every count, in Prometheus's text exposition format. */
export async function metricsText(db: Database, now = new Date()): Promise<string> {
  const [accounts] = await db.select({ n: count() }).from(users);
  const repos = await db.select({ key: repositories.private, n: count() }).from(repositories).groupBy(repositories.private);
  const kinds = await db.select({ key: uploads.kind, n: count() }).from(uploads).groupBy(uploads.kind);
  const [lastDay] = await db.select({ n: count() }).from(uploads).where(gt(uploads.createdAt, new Date(now.getTime() - DAY_MS)));
  const [uploadTokens] = await db.select({ n: count() }).from(tokens);
  const [links] = await db.select({ n: count() }).from(shareLinks).where(sql`${gt(shareLinks.expiresAt, now)} and ${isNull(shareLinks.revokedAt)}`);
  const plans = await db.select({ key: accountPlans.plan, n: count(), seats: sql<number>`coalesce(sum(${accountPlans.seats}), 0)` }).from(accountPlans).where(ne(accountPlans.plan, "free")).groupBy(accountPlans.plan);
  return [
    gauge("aisus_accounts", "People who have signed in.", [["", Number(accounts?.n ?? 0)]]),
    gauge("aisus_repositories", "Repositories the cloud knows, by visibility.", [
      ['{visibility="private"}', valueOf(repos, true)],
      ['{visibility="public"}', valueOf(repos, false)],
    ]),
    gauge("aisus_uploads", "Stored uploads, by kind.", [
      ['{kind="map"}', valueOf(kinds, "map")],
      ['{kind="check"}', valueOf(kinds, "check")],
    ]),
    gauge("aisus_uploads_last_day", "Uploads in the last 24 hours.", [["", Number(lastDay?.n ?? 0)]]),
    gauge("aisus_upload_tokens", "Upload tokens that exist.", [["", Number(uploadTokens?.n ?? 0)]]),
    gauge("aisus_share_links", "Share links that are neither expired nor revoked.", [["", Number(links?.n ?? 0)]]),
    gauge("aisus_paid_accounts", "Accounts on a paid plan, by plan.", [
      ['{plan="team"}', valueOf(plans, "team")],
      ['{plan="enterprise"}', valueOf(plans, "enterprise")],
    ]),
    gauge("aisus_paid_seats", "Seats across the paid accounts.", [["", plans.reduce((sum, row) => sum + Number(row.seats), 0)]]),
  ].join("");
}

/** Whether `authorization` carries `METRICS_TOKEN`. Without the setting nobody reads the metrics. */
export function metricsAllowed(authorization: string | null, env: Readonly<Record<string, string | undefined>> = process.env): boolean {
  const token = env["METRICS_TOKEN"] ?? "";
  if (token === "" || authorization === null) return false;
  const given = Buffer.from(authorization);
  const expected = Buffer.from(`Bearer ${token}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}
