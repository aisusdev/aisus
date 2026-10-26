// CLD-15: GET a branch's maps. Signed with a user's GitHub token, which needs read access to the
// repository, or with an Actions OIDC token for it. The team space's maps need a plan that keeps
// them, and a user's own personal map comes back only to that user.
import { and, desc, eq } from "drizzle-orm";
import { mapSha256 } from "@aisus/core/model/upload";
import { uploads } from "../../../../../../../db/schema";
import { checkAccess, userForToken } from "../../../../../../../lib/access";
import { planOfRepository } from "../../../../../../../lib/billing";
import { verifyOidc } from "../../../../../../../lib/oidc";
import { refuse } from "../../../../../../../lib/requests";
import { services } from "../../../../../../../lib/services";
import { branchMap, findRepository, personalMap, type Repository, type UploadRow } from "../../../../../../../lib/store";

/** Default-branch maps listed in `mainHistory`. */
export const MAIN_HISTORY = 50;

function entry(row: UploadRow | null): Record<string, unknown> | null {
  if (row === null) return null;
  const payload = row.payload as { map?: unknown; sidecars?: unknown; meta?: unknown };
  return {
    id: row.id,
    space: row.space,
    branch: row.branch,
    commit: row.commit,
    createdAt: row.createdAt.toISOString(),
    sha256: mapSha256(payload.map),
    map: payload.map,
    sidecars: payload.sidecars ?? null,
    meta: payload.meta ?? {},
  };
}

export async function GET(request: Request, { params }: { params: Promise<{ owner: string; repo: string }> }): Promise<Response> {
  const { owner, repo: name } = await params;
  const bearer = /^Bearer (.+)$/.exec(request.headers.get("authorization") ?? "")?.[1];
  if (bearer === undefined) return refuse(401, "Sign in with GitHub, or sign with an Actions OIDC token.");
  const { db: openDb, jwks, github, now } = services();
  const db = await openDb();
  let repo: Repository | undefined;
  let userId: number | null = null;
  if (bearer.split(".").length === 3) {
    const verified = verifyOidc(bearer, `${owner}/${name}`, await jwks(), now().getTime());
    if (!verified.ok) return refuse(403, `The OIDC token was refused: ${verified.reason}.`);
    repo = await findRepository(db, owner, name);
  } else {
    const user = await userForToken(db, github(), bearer);
    if (user === null) return refuse(401, "GitHub did not accept this sign-in.");
    const held = await checkAccess(db, github(), user, owner, name, now());
    if (held === null) return refuse(403, `${user.login} can't see ${owner}/${name} on GitHub.`);
    repo = held.repo;
    userId = user.userId;
  }
  if (repo === undefined) return refuse(404, `aisus cloud holds no maps of ${owner}/${name}.`);
  const team = (await planOfRepository(db, repo)).refusal === null;
  const url = new URL(request.url);

  const id = url.searchParams.get("id");
  if (id !== null) {
    const [row] = team && /^\d+$/.test(id) ? await db.select().from(uploads).where(and(eq(uploads.id, Number(id)), eq(uploads.repoId, repo.id), eq(uploads.kind, "map"), eq(uploads.space, "team"))) : [];
    return row === undefined ? refuse(404, `No team map ${id} in ${owner}/${name}.`) : Response.json({ entry: entry(row) });
  }

  const branch = url.searchParams.get("branch");
  if (branch === null || branch === "") return refuse(400, "Name the branch with ?branch=.");
  const history = team
    ? await db
        .select({ id: uploads.id, commit: uploads.commit, createdAt: uploads.createdAt })
        .from(uploads)
        .where(and(eq(uploads.repoId, repo.id), eq(uploads.kind, "map"), eq(uploads.space, "team"), eq(uploads.branch, repo.defaultBranch)))
        .orderBy(desc(uploads.createdAt), desc(uploads.id))
        .limit(MAIN_HISTORY)
    : [];
  return Response.json({
    defaultBranch: repo.defaultBranch,
    team: team ? entry(await branchMap(db, repo.id, branch)) : null,
    personal: userId === null ? null : entry(await personalMap(db, repo.id, userId, branch)),
    main: team ? entry(await branchMap(db, repo.id, repo.defaultBranch)) : null,
    mainHistory: history.map((row) => ({ id: row.id, commit: row.commit, createdAt: row.createdAt.toISOString() })),
  });
}
