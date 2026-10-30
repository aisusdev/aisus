// CLD-03: a repository's main map, the latest uploaded from its default branch, with freshness from
// the latest check and the history of maps. `?map=<id>` shows an earlier one, and `?compare=<id>`
// draws what changed since another (FRS-07). The team space lists its branches, and `?branch=<name>`
// shows that branch's latest map (CLD-14). CLD-20 splits the side panel into the Overview, Branches and
// History tabs, which `?panel=` picks.
import { notFound, redirect } from "next/navigation";
import { relativeAge } from "@aisus/core/model/home";
import { MapViewer } from "../../../../../components/MapViewer";
import { PlanGate } from "../../../../../components/PlanGate";
import { checkOf, mapName, mapOf, mapPageData } from "../../../../../lib/mapPage";
import { openSpace } from "../../../../../lib/pages";
import { accountPath, repoPath, repoSettingsPath, signInPath } from "../../../../../lib/paths";
import { services } from "../../../../../lib/services";
import { planOfRepository } from "../../../../../lib/billing";
import { branchMap, historySince, latestCheck, mainMap, mapHistory, teamBranches } from "../../../../../lib/store";

export const dynamic = "force-dynamic";

const PANELS = [
  { id: "overview", label: "Overview" },
  { id: "branches", label: "Branches" },
  { id: "history", label: "History" },
] as const;

export default async function MapPage({ params, searchParams }: { params: Promise<{ owner: string; repo: string }>; searchParams: Promise<{ map?: string; compare?: string; branch?: string; panel?: string }> }) {
  const { owner, repo: name } = await params;
  const { map: chosen, compare, branch, panel: asked } = await searchParams;
  const panel = PANELS.find((entry) => entry.id === asked)?.id ?? "overview";
  const space = await openSpace(owner, name);
  if (space === "sign-in") redirect(signInPath(repoPath(owner, name)));
  if (space === "not-found") notFound();
  const db = await services().db();
  // CLD-07: the account's plan decides whether maps show, and how much history.
  const { plan, refusal } = await planOfRepository(db, space.repo);
  if (refusal !== null) {
    return (
      <main className="page cloud-main cloud-main--narrow">
        <h1>
          {owner}/{name}
        </h1>
        <PlanGate owner={owner} message={refusal} user={space.user} />
      </main>
    );
  }
  const since = historySince(plan, services().now());
  const history = await mapHistory(db, space.repo.id, since);
  const shown =
    chosen !== undefined
      ? history.find((row) => String(row.id) === chosen)
      : branch !== undefined
        ? ((await branchMap(db, space.repo.id, branch)) ?? undefined)
        : await mainMap(db, space.repo);
  const branches = (await teamBranches(db, space.repo.id)).filter((row) => since === null || row.createdAt >= since);
  if (!shown) {
    return (
      <main className="page cloud-main cloud-main--narrow">
        <h1>
          {owner}/{name}
        </h1>
        <p className="muted">No map from {branch ?? space.repo.defaultBranch} yet. Upload one with the aisus Action, `aisus.mjs publish` or Share to aisus cloud in VS Code.</p>
        {space.role === "owner" ? (
          <p>
            <a className="button button--primary" href={repoSettingsPath(owner, name)}>
              Set up
            </a>
          </p>
        ) : null}
      </main>
    );
  }
  const check = await latestCheck(db, space.repo);
  const report = checkOf(check);
  const against = compare === undefined ? undefined : history.find((row) => String(row.id) === compare && row.id !== shown.id);
  const here = (query: Record<string, string | number>): string => {
    const kept = { ...(chosen === undefined ? {} : { map: chosen }), ...(chosen === undefined && branch !== undefined ? { branch } : {}), ...(compare === undefined ? {} : { compare }), ...query };
    const search = new URLSearchParams(Object.entries(kept).map(([key, value]) => [key, String(value)])).toString();
    return `${repoPath(owner, name)}${search === "" ? "" : `?${search}`}`;
  };
  const now = services().now();
  const boxes = mapOf(shown)?.components?.length ?? null;
  return (
    <>
      <MapViewer data={mapPageData(space.repo, shown, check, undefined, against)} />
      <aside className="map-side map-panel" aria-label="Map history">
        <header>
          <p className="map-panel__crumb">
            <a href={accountPath(owner)}>{owner}</a> / {name}
          </p>
          <h2>
            {owner}/{name}
          </h2>
          <p className="muted">
            Map of {shown.branch} at <code>{shown.commit.slice(0, 7)}</code>, {relativeAge(shown.createdAt.toISOString(), now)}
          </p>
        </header>
        <nav className="cloud-tabs" aria-label="Panel">
          {PANELS.map((entry) => (
            <a key={entry.id} href={here({ panel: entry.id })} aria-current={entry.id === panel ? "page" : undefined}>
              {entry.label}
            </a>
          ))}
        </nav>
        {panel === "overview" ? (
          <div className="map-panel__body">
            <dl className="map-panel__counts">
              <div>
                <dt>boxes</dt>
                <dd>{boxes ?? "—"}</dd>
              </div>
              <div>
                <dt>stale</dt>
                <dd>{report ? report.stale.length : "—"}</dd>
              </div>
              <div>
                <dt>files on no box</dt>
                <dd>{report ? report.uncovered.length : "—"}</dd>
              </div>
              <div>
                <dt>maps kept</dt>
                <dd>{history.length}</dd>
              </div>
            </dl>
            {space.role === "owner" ? (
              <p>
                <a className="button" href={repoSettingsPath(owner, name)}>
                  Settings
                </a>
              </p>
            ) : null}
          </div>
        ) : panel === "branches" ? (
          <ul className="branches map-panel__list" aria-label="Branches">
            {branches.map((row) => (
              <li key={row.branch}>
                <a href={row.branch === space.repo.defaultBranch ? `${repoPath(owner, name)}?panel=branches` : `${repoPath(owner, name)}?branch=${encodeURIComponent(row.branch)}&panel=branches`} aria-current={row.branch === shown.branch && chosen === undefined ? "page" : undefined}>
                  {row.branch}
                </a>
                <span className="muted">{`${relativeAge(row.createdAt.toISOString(), now)} · ${row.commit.slice(0, 7)}`}</span>
              </li>
            ))}
          </ul>
        ) : (
          <ol className="history map-panel__list">
            {history.map((row) => (
              <li key={row.id} aria-current={row.id === shown.id ? "true" : undefined}>
                <a href={`${repoPath(owner, name)}?map=${row.id}&panel=history`}>
                  {row.createdAt.toISOString().slice(0, 16).replace("T", " ")} · {row.branch} · {row.commit.slice(0, 7)}
                </a>
                {row.id === shown.id ? (
                  <span className="muted">Shown</span>
                ) : (
                  <a href={here({ compare: row.id, panel: "history" })} aria-label={`Compare with ${mapName(row)}`}>
                    Compare
                  </a>
                )}
              </li>
            ))}
          </ol>
        )}
      </aside>
    </>
  );
}
