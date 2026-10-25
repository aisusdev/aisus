// FRS-08: the code change an update works from, grouped by the boxes whose cited files it touches,
// as `change.md` for the skill and `changes.json` for the viewer. Browser-safe: git output and file
// reads come in as strings and callbacks.
import { parseDiff } from "./changes";
import { isDenied } from "./deny";
import type { FileEntry, RunChanges } from "./lineage";

/** aisus's own run folders, which are never part of the change. */
const OWN_OUTPUT = ".archify";

/** One changed file and the text `change.md` shows for it. */
export interface FileDiff {
  entry: FileEntry;
  text: string;
}

export interface ChangeInput {
  /** `git diff --unified=3 -M <base> --` with `a/` and `b/` prefixes. */
  diff: string;
  untracked: readonly string[];
  /** Paths that were uncommitted when the base map was made; folders end in `/`. */
  previousDirty: readonly string[];
  /** Every path the base map cites. */
  cited: ReadonlySet<string>;
  exists(path: string): boolean;
  /** An untracked file's text, or `null` when it is binary or unreadable. */
  readUntracked(path: string): string | null;
}

export interface ChangeMap {
  /** Boxes whose cited files changed, in map order. */
  touched: { id: string; label: string; files: FileDiff[] }[];
  /** Boxes whose cited files did not change. */
  untouched: { id: string; label: string }[];
  /** Changed files no box cites. */
  uncited: FileEntry[];
}

const isOwnOutput = (path: string | undefined): boolean => path !== undefined && (path === OWN_OUTPUT || path.startsWith(`${OWN_OUTPUT}/`));

const paths = (entry: FileEntry): string[] => (entry.oldPath === undefined ? [entry.path] : [entry.path, entry.oldPath]);

/** A file listed by name, with the reason its content is not shown. */
function nameOnly(entry: FileEntry, note: string): FileDiff {
  const name = entry.oldPath === undefined ? entry.path : `${entry.oldPath} → ${entry.path}`;
  return { entry, text: `${entry.status} ${name} (${note})\n` };
}

/** An untracked file shown as added in full. */
function addedFile(path: string, content: string): FileDiff {
  const lines = content.split("\n");
  if (content.endsWith("\n")) lines.pop();
  const count = content === "" ? 0 : lines.length;
  const head = [`diff --git a/${path} b/${path}`, "new file (untracked)", "--- /dev/null", `+++ b/${path}`];
  const body = count === 0 ? [] : [`@@ -0,0 +1,${count} @@`, ...lines.map((line) => `+${line}`)];
  return { entry: { status: "added", path }, text: `${[...head, ...body].join("\n")}\n` };
}

/** The sections of a unified diff, one per file. */
function sections(diff: string): string[] {
  const out: string[] = [];
  for (const line of diff.split("\n")) {
    if (line.startsWith("diff --git ")) out.push("");
    if (out.length > 0) out[out.length - 1] += `${line}\n`;
  }
  return out;
}

/**
 * The files changed since the base revision: the diff, untracked files as added, and files that
 * were uncommitted at the base map as modified, or deleted when gone. Deny-listed and binary files
 * keep only their names. `.archify/` is left out.
 */
export function collectChanges(input: ChangeInput): FileDiff[] {
  const files: FileDiff[] = [];
  const known = new Set<string>();
  for (const text of sections(input.diff)) {
    const change = parseDiff(text)[0];
    if (change === undefined) continue;
    const entry: FileEntry = change.status === "renamed" ? { status: "renamed", path: change.path, oldPath: change.oldPath } : { status: change.status, path: change.path };
    if (paths(entry).some(isOwnOutput)) continue;
    paths(entry).forEach((path) => known.add(path));
    if (paths(entry).some(isDenied)) files.push(nameOnly(entry, "on the deny list; content not shown"));
    else if (/^(Binary files .* differ|GIT binary patch)$/m.test(text)) files.push(nameOnly(entry, "binary; content not shown"));
    else files.push({ entry, text });
  }
  for (const path of input.untracked) {
    if (isOwnOutput(path) || known.has(path)) continue;
    known.add(path);
    const content = isDenied(path) ? null : input.readUntracked(path);
    files.push(content === null ? nameOnly({ status: "added", path }, "untracked; content not shown") : addedFile(path, content));
  }
  for (const dirty of input.previousDirty) {
    // An untracked folder matters only through the cited files below it.
    const below = dirty.endsWith("/") ? [...input.cited].filter((path) => path.startsWith(dirty)).sort() : [dirty];
    for (const path of below) {
      if (isOwnOutput(path) || known.has(path)) continue;
      known.add(path);
      files.push(nameOnly({ status: input.exists(path) ? "modified" : "deleted", path }, "uncommitted when the base map was made; read the current file"));
    }
  }
  return files;
}

/** Groups `files` by the boxes whose cited files they touch. A rename touches both of its paths. */
export function groupByBox(components: readonly { id: string; label: string; sources: readonly { path: string }[] }[], files: readonly FileDiff[]): ChangeMap {
  const touched: ChangeMap["touched"] = [];
  const untouched: ChangeMap["untouched"] = [];
  const cited = new Set<string>();
  for (const component of components) {
    const own = new Set(component.sources.map((source) => source.path));
    own.forEach((path) => cited.add(path));
    const mine = files.filter((file) => paths(file.entry).some((path) => own.has(path)));
    if (mine.length === 0) untouched.push({ id: component.id, label: component.label });
    else touched.push({ id: component.id, label: component.label, files: mine });
  }
  const uncited = files.filter((file) => !paths(file.entry).some((path) => cited.has(path))).map((file) => file.entry);
  return { touched, untouched, uncited };
}

/** A fence longer than any backtick run in `text`. */
function fence(text: string, lang = ""): string {
  let ticks = "```";
  while (text.includes(ticks)) ticks += "`";
  return `${ticks}${lang}\n${text}${text.endsWith("\n") || text === "" ? "" : "\n"}${ticks}\n`;
}

const name = (entry: FileEntry): string => (entry.oldPath === undefined ? `${entry.status} ${entry.path}` : `${entry.status} ${entry.oldPath} → ${entry.path}`);

/** `change.md`: the change from `base` to the working tree at `head`, grouped by box. */
export function renderChange(base: string, head: string, map: ChangeMap): string {
  const out = [`# The code change from ${base.slice(0, 7)} to the working tree at ${head.slice(0, 7)}, by box`, "", "## Changed code by box", ""];
  if (map.touched.length === 0) out.push("No box's cited files changed.", "");
  for (const box of map.touched) out.push(`### \`${box.id}\` (${box.label})`, "", fence(box.files.map((file) => file.text).join(""), "diff"));
  out.push("## Boxes whose cited files did not change", "", map.untouched.length === 0 ? "None." : map.untouched.map((box) => `- \`${box.id}\` (${box.label})`).join("\n"), "");
  out.push("## Changed files no box cites", "", map.uncited.length === 0 ? "None.\n" : fence(map.uncited.map(name).join("\n")));
  return out.join("\n");
}

/** `changes.json`: the same boxes and uncited files as `change.md`, as data. */
export function runChanges(map: ChangeMap, baseRevision: string, revision: string): RunChanges {
  return {
    schema: 1,
    baseRevision,
    revision,
    touched: map.touched.map((box) => ({ id: box.id, files: box.files.map((file) => file.entry) })),
    uncited: map.uncited,
  };
}
