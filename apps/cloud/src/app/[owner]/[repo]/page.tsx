// CLD-03: a repository's main map, the latest uploaded from its default branch, with freshness from
// the latest check and the history of maps. `?map=<id>` shows an earlier one, and `?compare=<id>`
// draws what changed since another (FRS-07). The team space lists its branches, and `?branch=<name>`
// shows that branch's latest map (CLD-14).
import { notFound, redirect } from "next/navigation";
import { relativeAge } from "@aisus/core/model/home";
import { MapViewer } from "../../../components/MapViewer";
import { mapName, mapPageData } from "../../../lib/mapPage";
import { openSpace } from "../../../lib/pages";
import { services } from "../../../lib/services";
import { planOfRepository } from "../../../lib/billing";
import { branchMap, historySince, latestCheck, mainMap, mapHistory, teamBranches } from "../../../lib/store";

export const dynamic = "force-dynamic";

export default async function MapPage({ params, searchParams }: { params: Promise<{ owner: string; repo: string }>; searchParams: Promise<{ map?: string; compare?: string; branch?: string }> }) {
  const { owner, repo: name } = await params;
  const { map: chosen, compare, branch } = await searchParams;
  const space = await openSpace(owner, name);
  if (space === "sign-in") redirect(`/signin?callbackUrl=${encodeURIComponent(`/${owner}/${name}`)}`);
  if (space === "not-found") notFound();
  const db = await services().db();
  // CLD-07: the account's plan decides whether maps show, and how much history.
  const { plan, refusal } = await planOfRepository(db, space.repo);
  if (refusal !== null) {
    return (
      <main className="page">
        <h1>
          {owner}/{name}
        </h1>
        <p className="muted plan-note">{refusal}</p>
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
      <main className="page">
        <h1>
          {owner}/{name}
        </h1>
        <p className="muted">No map from {branch ?? space.repo.defaultBranch} yet. Upload one with the aisus Action, `aisus.mjs publish` or Share to aisus cloud in VS Code.</p>
      </main>
    );
  }
  const check = await latestCheck(db, space.repo);
  const against = compare === undefined ? undefined : history.find((row) => String(row.id) === compare && row.id !== shown.id);
  const here = (query: Record<string, number>): string => `/${owner}/${name}?${new URLSearchParams(Object.entries({ ...(chosen === undefined ? {} : { map: chosen }), ...(chosen === undefined && branch !== undefined ? { branch } : {}), ...query }).map(([key, value]) => [key, String(value)])).toString()}`;
  const now = services().now();
  return (
    <>
      <MapViewer data={mapPageData(space.repo, shown, check, undefined, against)} />
      <aside className="map-side" aria-label="Map history">
        <h2>
          {owner}/{name}
        </h2>
        <p className="muted">
          Map of {shown.branch} at {shown.commit.slice(0, 7)}
          {space.role === "owner" ? (
            <>
              {" · "}
              <a href={`/settings/${owner}/${name}`}>Settings</a>
            </>
          ) : null}
        </p>
        <h2>Branches</h2>
        <ul className="branches" aria-label="Branches">
          {branches.map((row) => (
            <li key={row.branch}>
              <a href={row.branch === space.repo.defaultBranch ? `/${owner}/${name}` : `/${owner}/${name}?branch=${encodeURIComponent(row.branch)}`} aria-current={row.branch === shown.branch && chosen === undefined ? "page" : undefined}>
                {row.branch}
              </a>
              {` · ${relativeAge(row.createdAt.toISOString(), now)} · ${row.commit.slice(0, 7)}`}
            </li>
          ))}
        </ul>
        <h2>History</h2>
        <ol className="history">
          {history.map((row) => (
            <li key={row.id}>
              <a href={`/${owner}/${name}?map=${row.id}`}>
                {row.createdAt.toISOString().slice(0, 16).replace("T", " ")} · {row.branch} · {row.commit.slice(0, 7)}
              </a>
              {row.id === shown.id ? null : (
                <>
                  {" · "}
                  <a href={here({ compare: row.id })} aria-label={`Compare with ${mapName(row)}`}>
                    Compare
                  </a>
                </>
              )}
            </li>
          ))}
        </ol>
      </aside>
    </>
  );
}
