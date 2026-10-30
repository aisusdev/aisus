// A repository's settings, for its owners: upload tokens, public maps, share links, the audit log of
// uploads, and deleting maps or all of its data (CLD-02, CLD-03, CLD-06, CLD-11, CLD-13). Everyone else
// signed in learns who can manage it (P-7). CLD-20 lists the sections beside them.
import { redirect } from "next/navigation";
import { DeleteButton, NewShareLink, NewToken, PublicToggle } from "../../../../../../components/Actions";
import { PlanGate } from "../../../../../../components/PlanGate";
import { checkAccess } from "../../../../../../lib/access";
import { planOfRepository } from "../../../../../../lib/billing";
import { accountPath, repoPath, signInPath, repoSettingsPath } from "../../../../../../lib/paths";
import { services } from "../../../../../../lib/services";
import { listShares, SHARE_DAYS } from "../../../../../../lib/shares";
import { auditLog, listTokens, mapHistory } from "../../../../../../lib/store";

export const dynamic = "force-dynamic";

const SECTIONS = [
  { id: "publishing", label: "Publishing" },
  { id: "visibility", label: "Visibility" },
  { id: "share-links", label: "Share links" },
  { id: "maps", label: "Maps" },
  { id: "uploads", label: "Uploads" },
  { id: "delete", label: "Delete data" },
];

export default async function RepositorySettings({ params }: { params: Promise<{ owner: string; repo: string }> }) {
  const { owner, repo: name } = await params;
  const { db: openDb, github, now, user: currentUser } = services();
  const user = await currentUser();
  if (!user) redirect(signInPath(repoSettingsPath(owner, name)));
  const db = await openDb();
  const access = await checkAccess(db, github(), user, owner, name, now());
  const crumb = (
    <p className="cloud-crumb">
      <a href={accountPath(owner)}>{owner}</a> / <a href={repoPath(owner, name)}>{name}</a>
    </p>
  );
  // P-7: a signed-in user who cannot manage the repository learns who can, the same way whether or not it exists.
  if (!access || access.role !== "owner") {
    return (
      <main className="page cloud-main cloud-main--narrow">
        {crumb}
        <h1>Repository settings</h1>
        <p className="settings-denied">
          Only admins of {owner}/{name} on GitHub can manage it. Its map is at <a href={repoPath(owner, name)}>{repoPath(owner, name)}</a>.
        </p>
      </main>
    );
  }
  const api = `/api/v1/repos/${owner}/${name}`;
  const maps = await mapHistory(db, access.repo.id);
  const tokens = await listTokens(db, access.repo.id);
  const shares = await listShares(db, access.repo.id, now());
  const { plan, refusal } = await planOfRepository(db, access.repo);
  const audit = await auditLog(db, access.repo.id);
  return (
    <main className="page cloud-main cloud-main--settings">
      {crumb}
      <h1>Repository settings</h1>
      <div className="settings-layout">
        <nav className="settings-nav" aria-label="Sections">
          {SECTIONS.map((section) => (
            <a key={section.id} href={`#${section.id}`}>
              {section.label}
            </a>
          ))}
        </nav>
        <div className="settings-sections">
          <section className="cloud-card" id="publishing">
            <h2>Publishing</h2>
            <p className="muted">The aisus Action uploads with OIDC and needs no token. `aisus.mjs publish` reads one from AISUS_TOKEN.</p>
            <ul className="tokens settings-lines">
              {tokens.map((token) => (
                <li key={token.id}>
                  <span>
                    <b>{token.name}</b> <span className="muted">created {token.createdAt.toISOString().slice(0, 10)}</span>
                  </span>
                  <DeleteButton url={`${api}/tokens/${token.id}`} label="Revoke" confirmText={`Revoke the token ${token.name}?`} />
                </li>
              ))}
            </ul>
            <NewToken url={`${api}/tokens`} />
          </section>
          <section className="cloud-card" id="visibility">
            <h2>Visibility</h2>
            <PublicToggle url={`${api}/public`} value={access.repo.publicMaps} allowed={!access.repo.private} />
            {access.repo.private ? <p className="muted">A private repository&apos;s maps stay private.</p> : null}
          </section>
          <section className="cloud-card" id="share-links">
            <h2>Share links</h2>
            <p className="muted">A share link shows the main map read-only to anyone who has it, without signing in, until it expires or you revoke it.</p>
            <ul className="shares settings-lines">
              {shares.map((share) => (
                <li key={share.id}>
                  <span>
                    Link {share.id} <span className="muted">expires {share.expiresAt.toISOString().slice(0, 16).replace("T", " ")}</span>
                  </span>
                  <DeleteButton url={`${api}/shares/${share.id}`} label="Revoke" confirmText="Revoke this link now?" />
                </li>
              ))}
            </ul>
            {refusal === null && plan.shareLinks ? <NewShareLink url={`${api}/shares`} days={SHARE_DAYS} /> : <PlanGate owner={owner} message={refusal ?? `Share links come with Pro and Team. ${owner} is on ${plan.label}.`} user={user} />}
          </section>
          <section className="cloud-card" id="maps">
            <h2>Maps</h2>
            {maps.length === 0 ? <p className="muted">No maps yet.</p> : null}
            <ul className="maps settings-lines">
              {maps.map((map) => (
                <li key={map.id}>
                  <span>
                    {map.createdAt.toISOString().slice(0, 16).replace("T", " ")} · {map.branch} · {map.commit.slice(0, 7)}
                  </span>
                  <DeleteButton url={`${api}/uploads/${map.id}`} label="Delete" confirmText="Delete this map now?" />
                </li>
              ))}
            </ul>
          </section>
          <section className="cloud-card" id="uploads">
            <h2>Uploads</h2>
            <p className="muted">The latest uploads, with how each was signed.</p>
            {audit.length === 0 ? (
              <p className="muted">No uploads yet.</p>
            ) : (
              <table className="audit">
                <thead>
                  <tr>
                    <th scope="col">When</th>
                    <th scope="col">What</th>
                    <th scope="col">Signed by</th>
                    <th scope="col">Size</th>
                  </tr>
                </thead>
                <tbody>
                  {audit.map((entry) => (
                    <tr key={entry.id}>
                      <td>{entry.createdAt.toISOString().slice(0, 16).replace("T", " ")}</td>
                      <td>{entry.kind}</td>
                      <td>{entry.via}</td>
                      <td>{entry.size === null ? "—" : `${(entry.size / 1024).toFixed(1)} KB`}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
          <section className="cloud-card cloud-card--danger" id="delete">
            <h2>Delete this repository&apos;s data</h2>
            <p className="muted">Removes every map, check and token of {owner}/{name} at once.</p>
            <DeleteButton url={api} label="Delete all data" confirmText={`Delete all of ${owner}/${name}'s data now?`} then="home" />
          </section>
        </div>
      </div>
    </main>
  );
}
