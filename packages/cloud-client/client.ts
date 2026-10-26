// CLD-09, CLD-12 and CLD-15: the only shipped code that sends anything over the network. It uploads
// to aisus cloud when the user runs `aisus.mjs publish`, sets the Action's `upload`, or shares from
// the extension, and asks GitHub Actions for an OIDC token for that upload. It pulls a branch's maps
// for the extension's load order and the Action's merge. Nothing else may use the network (spec §3).

/** The audience aisus cloud expects in an Actions OIDC token. */
export const CLOUD_AUDIENCE = "aisus-cloud";

export type UploadResult = { ok: true; status: number; body: unknown } | { ok: false; status: number; body: unknown; message: string };

/** POSTs `payload` to `<cloud>/api/v1/uploads`, signed with `bearer`. */
export async function postUpload(cloud: string, bearer: string, payload: unknown, fetcher: typeof fetch = fetch): Promise<UploadResult> {
  const response = await fetcher(`${cloud.replace(/\/+$/, "")}/api/v1/uploads`, {
    method: "POST",
    headers: { Authorization: `Bearer ${bearer}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body: unknown = await response.json().catch(() => null);
  if (response.ok) return { ok: true, status: response.status, body };
  const message = (body as { message?: unknown } | null)?.message;
  return { ok: false, status: response.status, body, message: typeof message === "string" ? message : `aisus cloud answered ${response.status}` };
}

/** CLD-15: one map as the cloud answers it. */
export interface CloudMap {
  id: number;
  space: "team" | "personal";
  branch: string;
  commit: string;
  createdAt: string;
  /** SHA-256 of the map's canonical JSON. */
  sha256: string;
  map: unknown;
  sidecars: { run?: unknown; fingerprints?: unknown; evidence?: unknown; tour?: unknown } | null;
  meta: Record<string, unknown>;
}

/** CLD-15: a branch's maps in the cloud. */
export interface BranchMaps {
  defaultBranch: string;
  team: CloudMap | null;
  personal: CloudMap | null;
  main: CloudMap | null;
  mainHistory: { id: number; commit: string; createdAt: string }[];
}

async function getJson<T>(url: string, bearer: string, fetcher: typeof fetch): Promise<T> {
  const response = await fetcher(url, { headers: { Authorization: `Bearer ${bearer}`, Accept: "application/json" } });
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message = (body as { message?: unknown } | null)?.message;
    throw new Error(typeof message === "string" ? message : `aisus cloud answered ${response.status}`);
  }
  return body as T;
}

/** CLD-15: the maps of `branch` in `repo` (`owner/name`), read with `bearer`. */
export function pullMaps(cloud: string, bearer: string, repo: string, branch: string, fetcher: typeof fetch = fetch): Promise<BranchMaps> {
  return getJson<BranchMaps>(`${cloud.replace(/\/+$/, "")}/api/v1/repos/${repo}/maps?branch=${encodeURIComponent(branch)}`, bearer, fetcher);
}

/** CLD-15: one team map of `repo` by its id. */
export async function pullMap(cloud: string, bearer: string, repo: string, id: number, fetcher: typeof fetch = fetch): Promise<CloudMap> {
  return (await getJson<{ entry: CloudMap }>(`${cloud.replace(/\/+$/, "")}/api/v1/repos/${repo}/maps?id=${id}`, bearer, fetcher)).entry;
}

/**
 * An OIDC token for aisus cloud from the running GitHub Actions job. The job needs
 * `permissions: id-token: write`, which provides the two ACTIONS_ID_TOKEN_REQUEST_* variables.
 */
export async function actionsOidcToken(env: NodeJS.ProcessEnv, fetcher: typeof fetch = fetch): Promise<string> {
  const url = env["ACTIONS_ID_TOKEN_REQUEST_URL"];
  const token = env["ACTIONS_ID_TOKEN_REQUEST_TOKEN"];
  if (!url || !token) throw new Error("Uploading needs `permissions: id-token: write` on the job.");
  const response = await fetcher(`${url}${url.includes("?") ? "&" : "?"}audience=${CLOUD_AUDIENCE}`, { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } });
  if (!response.ok) throw new Error(`GitHub Actions refused an OIDC token: ${response.status}`);
  const value = ((await response.json()) as { value?: unknown }).value;
  if (typeof value !== "string") throw new Error("GitHub Actions returned no OIDC token.");
  return value;
}
