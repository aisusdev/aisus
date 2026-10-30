// CLD-04: a pull request's latest check on the map: touched boxes, new box candidates as ghosts,
// and stale boxes, with the counts beside it. CLD-20 puts it under /cloud/u/<owner>/<repo>.
import { notFound, redirect } from "next/navigation";
import { MapViewer } from "../../../../../../../components/MapViewer";
import { PlanGate } from "../../../../../../../components/PlanGate";
import { checkOf, mapOf, mapPageData } from "../../../../../../../lib/mapPage";
import { planOfRepository } from "../../../../../../../lib/billing";
import { openSpace } from "../../../../../../../lib/pages";
import { accountPath, pullPath, repoPath, signInPath } from "../../../../../../../lib/paths";
import { services } from "../../../../../../../lib/services";
import { latestCheck, mainMap } from "../../../../../../../lib/store";

export const dynamic = "force-dynamic";

export default async function PullPage({ params }: { params: Promise<{ owner: string; repo: string; n: string }> }) {
  const { owner, repo: name, n } = await params;
  const pull = Number(n);
  if (!Number.isInteger(pull) || pull < 1) notFound();
  const space = await openSpace(owner, name);
  if (space === "sign-in") redirect(signInPath(pullPath(owner, name, pull)));
  if (space === "not-found") notFound();
  const db = await services().db();
  // CLD-07: pull request pages come with Pro and Team.
  const { plan, refusal } = await planOfRepository(db, space.repo);
  if (refusal !== null || !plan.pullPages) {
    return (
      <main className="page cloud-main cloud-main--narrow">
        <h1>
          {owner}/{name} #{pull}
        </h1>
        <PlanGate owner={owner} message={refusal ?? `Pull request pages come with Pro and Team. ${owner} is on ${plan.label}.`} user={space.user} />
      </main>
    );
  }
  const check = await latestCheck(db, space.repo, pull);
  const report = checkOf(check);
  const map = mapOf(check) !== null ? check : await mainMap(db, space.repo);
  if (!check || !report || !map) {
    return (
      <main className="page cloud-main cloud-main--narrow">
        <h1>
          {owner}/{name} #{pull}
        </h1>
        <p className="muted">No check uploaded for this pull request yet.</p>
      </main>
    );
  }
  const touched = report.touched.strong.length + report.touched.weak.length;
  return (
    <>
      <MapViewer data={mapPageData(space.repo, map, check, pull)} />
      <aside className="map-side map-panel" aria-label="Check">
        <p className="map-panel__crumb">
          <a href={accountPath(owner)}>{owner}</a> / <a href={repoPath(owner, name)}>{name}</a> / #{pull}
        </p>
        <h2>
          {owner}/{name} #{pull}: {report.result}
        </h2>
        <ul className="counts">
          <li>{touched} touched</li>
          <li>{report.candidates.length} new box candidates</li>
          <li>{report.stale.length} stale</li>
          <li>{report.gone.length} gone</li>
          <li>{report.uncovered.length} files not on the map</li>
        </ul>
        {report.candidates.length > 0 ? (
          <>
            <h2>New box candidates</h2>
            <ul>
              {report.candidates.map((candidate) => (
                <li key={candidate.dir}>
                  <code>{candidate.dir}/</code>: {candidate.files.length} files, {candidate.lines} lines
                </li>
              ))}
            </ul>
          </>
        ) : null}
        <p className="muted">
          Checked <code>{check.commit.slice(0, 7)}</code> · <a href={repoPath(owner, name)}>Main map</a>
        </p>
      </aside>
    </>
  );
}
