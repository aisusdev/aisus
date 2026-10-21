// /install (owner request, 2026-10-22): one address for the VS Code extension. It redirects to the
// newest published release's .vsix, and to the releases page when there is none or GitHub is away.

export interface Release {
  html_url: string;
  draft?: boolean;
  assets: { name: string; browser_download_url: string }[];
}

const DEFAULT_REPO = "xplus2g4/sustain";
/** How long one answer from GitHub is reused. */
const CACHE_MS = 5 * 60_000;

/** The repository whose releases carry the extension, from `SUSTAIN_RELEASES_REPO`. */
export function releasesRepo(env: Readonly<Record<string, string | undefined>> = process.env): string {
  const repo = env["SUSTAIN_RELEASES_REPO"]?.trim() ?? "";
  return /^[\w.-]+\/[\w.-]+$/.test(repo) ? repo : DEFAULT_REPO;
}

/** The newest published release's .vsix, or the releases page. `releases` is newest first, as GitHub lists them. */
export function installTarget(releases: readonly Release[], repo: string): string {
  for (const release of releases) {
    if (release.draft) continue;
    const vsix = release.assets.find((asset) => asset.name.endsWith(".vsix"));
    if (vsix) return vsix.browser_download_url;
  }
  return `https://github.com/${repo}/releases`;
}

let cached: { repo: string; url: string; at: number } | null = null;

/** Where /install sends the visitor, asking GitHub at most once every five minutes. */
export async function installUrl(env: Readonly<Record<string, string | undefined>> = process.env, fetcher: typeof fetch = fetch, now = Date.now()): Promise<string> {
  const repo = releasesRepo(env);
  if (cached && cached.repo === repo && now - cached.at < CACHE_MS && now >= cached.at) return cached.url;
  let url = `https://github.com/${repo}/releases`;
  try {
    const api = (env["GITHUB_API_URL"] || "https://api.github.com").replace(/\/+$/, "");
    const response = await fetcher(`${api}/repos/${repo}/releases?per_page=20`, { headers: { accept: "application/vnd.github+json" } });
    if (response.ok) url = installTarget((await response.json()) as Release[], repo);
  } catch {
    // GitHub is unreachable; the releases page still lists every download.
  }
  cached = { repo, url, at: now };
  return url;
}
