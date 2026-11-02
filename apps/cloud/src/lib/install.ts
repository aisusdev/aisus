// /install (owner request, 2026-10-22): one address for the VS Code extension. It redirects to the
// newest published release's .vsix, and to the releases page when there is none or GitHub is away.
// /install/intellij does the same for the IntelliJ plugin's zip.

export interface Release {
  html_url: string;
  draft?: boolean;
  assets: { name: string; browser_download_url: string }[];
}

const DEFAULT_REPO = "aisusdev/aisus";
/** How long one answer from GitHub is reused. */
const CACHE_MS = 5 * 60_000;

/** The repository whose releases carry the extension, from `AISUS_RELEASES_REPO`. */
export function releasesRepo(env: Readonly<Record<string, string | undefined>> = process.env): string {
  const repo = env["AISUS_RELEASES_REPO"]?.trim() ?? "";
  return /^[\w.-]+\/[\w.-]+$/.test(repo) ? repo : DEFAULT_REPO;
}

/** The two downloads a release carries: the VS Code extension and the IntelliJ plugin. */
export type Download = "vsix" | "intellij";

const IS_DOWNLOAD: Record<Download, (name: string) => boolean> = {
  vsix: (name) => name.endsWith(".vsix"),
  intellij: (name) => name.startsWith("aisus-intellij-") && name.endsWith(".zip"),
};

/** The newest published release's download, or the releases page. `releases` is newest first, as GitHub lists them. */
export function installTarget(releases: readonly Release[], repo: string, download: Download = "vsix"): string {
  for (const release of releases) {
    if (release.draft) continue;
    const asset = release.assets.find((candidate) => IS_DOWNLOAD[download](candidate.name));
    if (asset) return asset.browser_download_url;
  }
  return `https://github.com/${repo}/releases`;
}

const cached = new Map<Download, { repo: string; url: string; at: number }>();

/** Where /install or /install/intellij sends the visitor, asking GitHub at most once every five minutes for each. */
export async function installUrl(env: Readonly<Record<string, string | undefined>> = process.env, fetcher: typeof fetch = fetch, now = Date.now(), download: Download = "vsix"): Promise<string> {
  const repo = releasesRepo(env);
  const hit = cached.get(download);
  if (hit && hit.repo === repo && now - hit.at < CACHE_MS && now >= hit.at) return hit.url;
  let url = `https://github.com/${repo}/releases`;
  try {
    const api = (env["GITHUB_API_URL"] || "https://api.github.com").replace(/\/+$/, "");
    const response = await fetcher(`${api}/repos/${repo}/releases?per_page=20`, { headers: { accept: "application/vnd.github+json" } });
    if (response.ok) url = installTarget((await response.json()) as Release[], repo, download);
  } catch {
    // GitHub is unreachable; the releases page still lists every download.
  }
  cached.set(download, { repo, url, at: now });
  return url;
}
