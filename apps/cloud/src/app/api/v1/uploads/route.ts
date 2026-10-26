// CLD-02 and CLD-14: POST /api/v1/uploads. Authenticated by a GitHub Actions OIDC token for the
// repository, by the repository's upload token, or by a user's GitHub token from the extension. The
// body must pass checkUpload and stay under 1 MiB. A GitHub token uploads to its user's personal
// space with read access, and to the team space with write access; the other two reach the team
// space only.
import { checkUpload, MAX_UPLOAD_BYTES, type Upload } from "@aisus/core/model/upload";
import { atLeast, checkAccess, userForToken } from "../../../../lib/access";
import { planOfAccount, planOfRepository } from "../../../../lib/billing";
import { verifyOidc } from "../../../../lib/oidc";
import { siteOf } from "../../../../lib/requests";
import { services } from "../../../../lib/services";
import { personalBranches, repositoryForToken, type Repository, saveUpload, upsertRepository, uploadsInLastHour, UPLOADS_PER_HOUR } from "../../../../lib/store";
import { TOKEN_PREFIX } from "../../../../lib/tokens";

function refuse(status: number, message: string, errors?: unknown): Response {
  return Response.json({ status: "rejected", message, ...(errors === undefined ? {} : { errors }) }, { status });
}

export async function POST(request: Request): Promise<Response> {
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared > MAX_UPLOAD_BYTES) return refuse(413, "The upload is over 1 MiB.");
  const bytes = new Uint8Array(await request.arrayBuffer());
  if (bytes.byteLength > MAX_UPLOAD_BYTES) return refuse(413, "The upload is over 1 MiB.");
  let body: unknown;
  try {
    body = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return refuse(400, "The upload is not JSON.");
  }
  const issues = checkUpload(body);
  if (issues.length > 0) return refuse(422, "The upload is not a map, sidecars, a check and metadata.", issues);
  const upload = body as Upload;

  const bearer = /^Bearer (.+)$/.exec(request.headers.get("authorization") ?? "")?.[1];
  if (bearer === undefined) return refuse(401, "Sign the upload with an Actions OIDC token, an upload token or a GitHub sign-in.");
  const { db: openDb, jwks, github, now } = services();
  const db = await openDb();
  const [owner, name] = upload.repo.split("/") as [string, string];
  const space = upload.space ?? "team";
  let repo: Repository | undefined;
  let via: "oidc" | "token" | "github";
  let tokenId: number | null = null;
  let userId: number | null = null;
  const jwt = bearer.split(".").length === 3;
  if (space === "personal" && upload.kind !== "map") return refuse(422, "A personal space holds maps only.");
  if (space === "personal" && (jwt || bearer.startsWith(TOKEN_PREFIX))) return refuse(403, "Only a GitHub sign-in uploads to a personal space.");
  if (!jwt && !bearer.startsWith(TOKEN_PREFIX)) {
    const user = await userForToken(db, github(), bearer);
    if (user === null) return refuse(401, "GitHub did not accept this sign-in.");
    const held = await checkAccess(db, github(), user, owner, name, now());
    if (held === null) return refuse(403, `${user.login} can't see ${upload.repo} on GitHub.`);
    if (space === "team" && !atLeast(held.role, "member")) return refuse(403, `Sharing to the team needs write access to ${upload.repo}. Share to your personal space instead.`);
    const target = held.repo;
    repo = target;
    via = "github";
    userId = user.userId;
    if (space === "personal") {
      const plan = await planOfAccount(db, user.login);
      const kept = await personalBranches(db, user.userId);
      const full = plan.personalBranches !== null && kept.length >= plan.personalBranches && !kept.some((row) => row.repoId === target.id && row.branch === upload.branch);
      if (full) {
        const names = kept.map((row) => `${row.owner}/${row.name} ${row.branch}`).join(", ");
        return refuse(402, `Your personal space on ${plan.label} holds ${plan.personalBranches} branches: ${names}. Pro keeps every branch. Upgrade at ${siteOf(request)}/settings.`);
      }
    }
  } else if (bearer.startsWith(TOKEN_PREFIX)) {
    const held = await repositoryForToken(db, bearer);
    repo = held?.repo;
    if (!held || !repo || repo.owner !== owner || repo.name !== name) return refuse(403, "This token does not belong to that repository.");
    via = "token";
    tokenId = held.tokenId;
    if (upload.meta.defaultBranch) repo = await upsertRepository(db, { githubId: repo.githubId, owner, name, private: repo.private, defaultBranch: upload.meta.defaultBranch });
  } else {
    const verified = verifyOidc(bearer, upload.repo, await jwks(), now().getTime());
    if (!verified.ok) return refuse(403, `The OIDC token was refused: ${verified.reason}.`);
    repo = await upsertRepository(db, {
      githubId: verified.claims.repositoryId,
      owner,
      name,
      private: verified.claims.visibility !== "public",
      ...(upload.meta.defaultBranch ? { defaultBranch: upload.meta.defaultBranch } : {}),
    });
    via = "oidc";
  }
  if ((await uploadsInLastHour(db, repo.id, now())) >= UPLOADS_PER_HOUR) return refuse(429, `A repository may upload ${UPLOADS_PER_HOUR} times an hour.`);
  // CLD-07: the account's plan decides whether aisus cloud keeps the repository's team maps.
  if (space === "team") {
    const { refusal } = await planOfRepository(db, repo);
    if (refusal !== null) return refuse(402, `${refusal} Upgrade at ${siteOf(request)}/settings.`);
  }

  const { repo: _repo, commit, branch, kind, space: _space, ...rest } = upload;
  const saved = await saveUpload(db, { repoId: repo.id, kind, commit, branch, pull: upload.meta.pull ?? null, payload: rest, via, tokenId, userId, space, size: bytes.byteLength, createdAt: now() });
  const url = kind === "check" && upload.meta.pull !== undefined ? `/${owner}/${name}/pull/${upload.meta.pull}` : space === "personal" || branch === repo.defaultBranch ? `/${owner}/${name}` : `/${owner}/${name}?branch=${encodeURIComponent(branch)}`;
  return Response.json({ status: "accepted", id: saved.id, url }, { status: 201 });
}
