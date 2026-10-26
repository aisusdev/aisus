// CLD-16: which map the extension opens for the checked-out branch, and how stale it is. Local work
// on this branch that the cloud doesn't hold comes first, unless a cloud map of the branch was drawn
// at a later commit. A local map drawn at a commit outside the branch is not this branch's work.
// Then the branch's cloud map, personal or team, then the default branch's. Commits decide which of
// two maps is newer. Browser-safe: git answers come in through `isAncestor`.

/** What the choice needs of a map in the cloud. */
export interface CloudCandidate {
  sha256: string;
  commit: string;
  createdAt: string;
}

/** The newest local map: its file, the SHA-256 of its map and the commit it was drawn at, if known. */
export interface LocalCandidate {
  file: string;
  sha256: string;
  commit: string | null;
}

export interface CloudCandidates<T extends CloudCandidate> {
  team: T | null;
  personal: T | null;
  main: T | null;
}

export type MapChoice<T extends CloudCandidate> = { source: "local"; local: LocalCandidate } | { source: "branch"; map: T } | { source: "main"; map: T } | { source: "none" };

/** Whether `ancestor` is `of` or one of its ancestors, as git sees it. */
export type IsAncestor = (ancestor: string, of: string) => boolean;

/** Of two maps, the one drawn at the later commit; by upload time when neither commit contains the other. */
function later<T extends CloudCandidate>(a: T | null, b: T | null, isAncestor: IsAncestor): T | null {
  if (a === null || b === null) return a ?? b;
  if (a.commit !== b.commit) {
    if (isAncestor(a.commit, b.commit)) return b;
    if (isAncestor(b.commit, a.commit)) return a;
  }
  return Date.parse(b.createdAt) > Date.parse(a.createdAt) ? b : a;
}

/** `locals` are the local maps newest first, and `head` the checked-out commit. */
export function chooseMap<T extends CloudCandidate>(locals: readonly LocalCandidate[], cloud: CloudCandidates<T> | null, isAncestor: IsAncestor, head: string): MapChoice<T> {
  const local = locals.find((candidate) => candidate.commit === null || isAncestor(candidate.commit, head)) ?? null;
  const branch = cloud === null ? null : later(cloud.personal, cloud.team, isAncestor);
  if (local !== null) {
    const shared = [cloud?.personal, cloud?.team].some((entry) => entry?.sha256 === local.sha256);
    const behind = branch !== null && local.commit !== null && local.commit !== branch.commit && isAncestor(local.commit, branch.commit);
    if (!shared && !behind) return { source: "local", local };
  }
  if (branch !== null) return { source: "branch", map: branch };
  if (cloud?.main) return { source: "main", map: cloud.main };
  return { source: "none" };
}

/** How far a map's commit is from HEAD: at it, some commits behind it, outside the branch, or unknown. */
export type Staleness = { kind: "head" } | { kind: "behind"; commits: number } | { kind: "elsewhere" } | { kind: "unknown" };

/** The clause the opening message gives a map drawn at `commit`. */
export function stalenessText(commit: string | null, staleness: Staleness): string {
  const short = commit?.slice(0, 7) ?? "";
  switch (staleness.kind) {
    case "head":
      return `drawn at this commit (${short})`;
    case "behind":
      return `drawn ${staleness.commits} ${staleness.commits === 1 ? "commit" : "commits"} ago at ${short}`;
    case "elsewhere":
      return `drawn at ${short}, which isn't in this branch`;
    case "unknown":
      return commit === null ? "drawn at an unknown commit" : `drawn at ${short}`;
  }
}
