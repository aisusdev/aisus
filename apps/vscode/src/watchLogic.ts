// Debouncing and decisions behind the candidate watcher (FR-WAT-01). No `vscode` import, so
// the rules are unit-tested in Node; watcher.ts wires them to FileSystemWatchers.

export const DEBOUNCE_MS = 300;
export const DELETED_MESSAGE = "This diagram was deleted.";

/**
 * Collects file events and calls `flush` once no event arrived for {@link DEBOUNCE_MS}. A file
 * counts as created when any of its batched events was a creation.
 */
export class ChangeBatch {
  private readonly pending = new Map<string, boolean>();
  private timer: NodeJS.Timeout | undefined;

  constructor(private readonly flush: (changes: ReadonlyMap<string, boolean>) => void) {}

  add(file: string, created: boolean): void {
    this.pending.set(file, created || this.pending.get(file) === true);
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = undefined;
      const changes = new Map(this.pending);
      this.pending.clear();
      this.flush(changes);
    }, DEBOUNCE_MS);
  }

  dispose(): void {
    clearTimeout(this.timer);
    this.pending.clear();
  }
}

/**
 * The `candidate.json` an event under `<root>/.aisus/maps/` concerns: the one in the run folder the
 * path lies in, or `undefined` for paths outside a run folder.
 */
export function candidateOf(mapDir: string, path: string, sep: string): string | undefined {
  if (!path.startsWith(mapDir + sep)) return undefined;
  const run = path.slice(mapDir.length + sep.length).split(sep)[0];
  return run === undefined || run === "" ? undefined : `${mapDir}${sep}${run}${sep}candidate.json`;
}

/**
 * What a path under `<root>/.aisus/` is to the session watcher: the `active` lock, a run folder's
 * `session.json`, one of the folders `.aisus` and `.aisus/sessions`, or `undefined` for every other path.
 */
export function sessionPathOf(root: string, path: string, sep: string): "lock" | "session" | "folder" | undefined {
  if (!path.startsWith(root + sep)) return undefined;
  const parts = path.slice(root.length + sep.length).split(sep);
  if (parts[0] !== ".aisus") return undefined;
  if (parts.length === 1 || (parts.length === 2 && parts[1] === "sessions")) return "folder";
  if (parts[1] !== "sessions") return undefined;
  if (parts.length === 3 && parts[2] === "active") return "lock";
  return parts.length === 4 && parts[2] !== "" && parts[3] === "session.json" ? "session" : undefined;
}

/** How often a {@link LockPoll} checks the session lock. */
export const LOCK_POLL_MS = 1_000;

/**
 * Checks a lock once a second while it exists and calls `onGone` once it is gone, then stops.
 * File watchers can miss the lock's deletion, as VS Code's recursive watcher on Linux does inside
 * a folder created together with its parent.
 */
export class LockPoll {
  private timer: NodeJS.Timeout | undefined;

  constructor(
    private readonly exists: () => boolean,
    private readonly onGone: () => void,
  ) {}

  /** Starts checking when the lock exists and no check is running. */
  start(): void {
    if (this.timer !== undefined || !this.exists()) return;
    this.timer = setInterval(() => {
      if (this.exists()) return;
      this.dispose();
      this.onGone();
    }, LOCK_POLL_MS);
  }

  dispose(): void {
    clearInterval(this.timer);
    this.timer = undefined;
  }
}

/**
 * Whether a candidate that `exists` now is new, judged against the candidates already `known`,
 * which it updates. File watchers can miss a file created inside a folder created a moment
 * before, so "new" comes from this comparison rather than from the event kind.
 */
export function noteCandidate(known: Set<string>, file: string, exists: boolean): boolean {
  if (!exists) {
    known.delete(file);
    return false;
  }
  if (known.has(file)) return false;
  known.add(file);
  return true;
}

/** One debounced change, with the facts needed to decide what to do. */
export interface CandidateChange {
  file: string;
  /** A creation was among the batched events. */
  created: boolean;
  /** The file exists after the batch. */
  exists: boolean;
  /** Repo root (workspace folder) the file belongs to. */
  root: string;
  /** Newest candidate of that root after the batch (FR-VIEW-02), if any. */
  newest: string | undefined;
}

export type WatchAction =
  | { kind: "reload" }
  | { kind: "deleted" }
  | { kind: "switch"; root: string; file: string }
  | { kind: "notify"; root: string; file: string };

/**
 * What to do for one change, given the panel's state (`undefined` when no panel is open):
 * - the panel's file changed → reload it (viewport kept); deleted → empty state;
 * - a new candidate that is now the newest of its folder → load it into a panel open for that
 *   folder, otherwise offer it in a notification;
 * - anything else → nothing.
 */
export function watchAction(change: CandidateChange, panel: { root: string; file: string } | undefined): WatchAction | undefined {
  if (panel && change.file === panel.file) return change.exists ? { kind: "reload" } : { kind: "deleted" };
  if (!change.exists || !change.created || change.newest !== change.file) return undefined;
  if (panel && panel.root === change.root) return { kind: "switch", root: change.root, file: change.file };
  return { kind: "notify", root: change.root, file: change.file };
}
