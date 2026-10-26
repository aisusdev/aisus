// packages/core/agent/repo-facts.ts
import { existsSync as existsSync3 } from "node:fs";
import { basename as basename2, join as join8 } from "node:path";

// packages/core/model/git.ts
import { spawnSync } from "node:child_process";
import { realpathSync } from "node:fs";

// packages/core/model/changes.ts
var REVISION_PATTERN = /^(?!-)[A-Za-z0-9._/~^@{}-]+$/;
function unquotePath(raw) {
  if (!raw.startsWith('"')) return raw;
  const bytes = [];
  const escapes = { a: 7, b: 8, t: 9, n: 10, v: 11, f: 12, r: 13, '"': 34, "\\": 92 };
  for (let i = 1; i < raw.length - 1; i++) {
    const char = raw[i];
    if (char !== "\\") {
      bytes.push(...new TextEncoder().encode(char));
      continue;
    }
    const next = raw[i + 1];
    if (/[0-7]/.test(next)) {
      bytes.push(parseInt(raw.slice(i + 1, i + 4), 8));
      i += 3;
    } else {
      bytes.push(escapes[next] ?? next.charCodeAt(0));
      i += 1;
    }
  }
  return new TextDecoder().decode(Uint8Array.from(bytes));
}
function headerPaths(rest) {
  let oldRaw;
  let newRaw;
  if (rest.startsWith('"')) {
    const end = /^"(?:[^"\\]|\\.)*"/.exec(rest)?.[0] ?? rest;
    oldRaw = end;
    newRaw = rest.slice(end.length + 1);
  } else {
    const split = Math.max(rest.lastIndexOf(" b/"), rest.lastIndexOf(' "b/'));
    oldRaw = split < 0 ? rest : rest.slice(0, split);
    newRaw = split < 0 ? rest : rest.slice(split + 1);
  }
  const strip = (raw, prefix) => {
    const path = unquotePath(raw);
    return path.startsWith(prefix) ? path.slice(prefix.length) : path;
  };
  return [strip(oldRaw, "a/"), strip(newRaw, "b/")];
}
function sidePath(line, prefix) {
  const raw = unquotePath(line.slice(4).replace(/\t$/, ""));
  if (raw === "/dev/null") return null;
  return raw.startsWith(prefix) ? raw.slice(2) : raw;
}
function parseDiff(text) {
  const files = [];
  let current = null;
  for (const line of text.split("\n")) {
    if (line.startsWith("diff --git ")) {
      const [oldPath, path] = headerPaths(line.slice("diff --git ".length));
      current = { path, oldPath, status: "modified", hunks: [] };
      files.push(current);
    } else if (current === null) {
      continue;
    } else if (line.startsWith("rename from ")) {
      current.oldPath = unquotePath(line.slice("rename from ".length));
      current.status = "renamed";
    } else if (line.startsWith("rename to ")) {
      current.path = unquotePath(line.slice("rename to ".length));
    } else if (line.startsWith("new file mode")) {
      current.status = "added";
    } else if (line.startsWith("deleted file mode")) {
      current.status = "deleted";
    } else if (line.startsWith("--- ")) {
      const old = sidePath(line, "a/");
      if (old !== null) current.oldPath = old;
    } else if (line.startsWith("+++ ")) {
      const next = sidePath(line, "b/");
      if (next !== null) current.path = next;
      else current.path = current.oldPath;
    } else if (line.startsWith("@@ ")) {
      const hunk = /^@@ -(\d+)(?:,(\d+))? \+\d+(?:,(\d+))? @@/.exec(line);
      if (hunk) {
        current.hunks.push({ oldStart: Number(hunk[1]), oldLines: hunk[2] === void 0 ? 1 : Number(hunk[2]) });
        current.added = (current.added ?? 0) + (hunk[3] === void 0 ? 1 : Number(hunk[3]));
      }
    }
  }
  return files;
}

// packages/core/model/which.ts
import { accessSync, constants, statSync } from "node:fs";
import { delimiter, join, posix, win32 } from "node:path";
function isExecutableFile(path, platform) {
  try {
    if (!statSync(path).isFile()) return false;
    if (platform !== "win32") accessSync(path, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}
function findOnPath(cli, env, platform = process.platform) {
  const pathValue = env["PATH"] ?? env["Path"] ?? "";
  const extensions = platform === "win32" ? ["", ...(env["PATHEXT"] ?? ".COM;.EXE;.BAT;.CMD").split(";").filter(Boolean)] : [""];
  const absolute = platform === "win32" ? win32.isAbsolute : posix.isAbsolute;
  for (const dir of pathValue.split(platform === "win32" ? ";" : delimiter)) {
    if (!absolute(dir)) continue;
    for (const extension of extensions) {
      const candidate = join(dir, cli + extension);
      if (isExecutableFile(candidate, platform)) return candidate;
    }
  }
  return void 0;
}

// packages/core/model/git.ts
var MAX_DIRTY_PATHS = 200;
var GIT_PREFIX = ["-c", "core.fsmonitor=false", "--no-optional-locks"];
var GIT_READS = {
  topLevel: [...GIT_PREFIX, "rev-parse", "--show-toplevel"],
  head: [...GIT_PREFIX, "rev-parse", "--verify", "--quiet", "HEAD"],
  origin: [...GIT_PREFIX, "config", "--get", "remote.origin.url"],
  status: [...GIT_PREFIX, "status", "--porcelain=v1", "-z"]
};
function gitProgram(env = process.env) {
  return findOnPath("git", env);
}
function runRaw(program, root, argv) {
  const result = spawnSync(program, argv, {
    cwd: root,
    env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
    stdio: ["ignore", "pipe", "ignore"],
    maxBuffer: 64 * 1024 * 1024
  });
  if (result.error || result.status !== 0) return null;
  return result.stdout;
}
function run(program, root, argv) {
  return runRaw(program, root, argv)?.toString("utf8") ?? null;
}
function sanitizeOrigin(url) {
  const match = /^(https?):\/\/(.*)$/is.exec(url);
  if (!match) return url;
  const scheme = match[1];
  const rest = match[2];
  const authorityEnd = rest.search(/[/?#]/);
  const authority = authorityEnd < 0 ? rest : rest.slice(0, authorityEnd);
  const tail = authorityEnd < 0 ? "" : rest.slice(authorityEnd);
  const host = authority.slice(authority.lastIndexOf("@") + 1);
  return `${scheme}://${host}${tail}`;
}
function parsePorcelainZ(output) {
  const fields = output.split("\0");
  const paths2 = [];
  for (let i = 0; i < fields.length; i += 1) {
    const record = fields[i];
    if (record.length < 4) continue;
    paths2.push(record.slice(3));
    if (/[RC]/.test(record.slice(0, 2))) i += 1;
  }
  return paths2;
}
function collectGitFacts(root, env = process.env) {
  const program = gitProgram(env);
  if (program === void 0) return null;
  const top = run(program, root, GIT_READS.topLevel);
  if (top === null) return null;
  try {
    if (realpathSync(top.trim()) !== realpathSync(root)) return null;
  } catch {
    return null;
  }
  const head = run(program, root, GIT_READS.head)?.trim().toLowerCase();
  if (head === void 0 || !/^[0-9a-f]{40}$/.test(head)) return null;
  const origin = run(program, root, GIT_READS.origin)?.trim() ?? "";
  const allDirty = parsePorcelainZ(run(program, root, GIT_READS.status) ?? "");
  return {
    head,
    origin: origin === "" ? null : sanitizeOrigin(origin),
    dirtyCount: allDirty.length,
    dirty: allDirty.slice(0, MAX_DIRTY_PATHS)
  };
}
var DIFF_FLAGS = ["diff", "--no-color", "--no-ext-diff", "--no-textconv", "--unified=0", "-M", "--src-prefix=a/", "--dst-prefix=b/"];
function trackedFiles(root, env = process.env) {
  const program = gitProgram(env);
  if (program === void 0) return null;
  const output = run(program, root, [...GIT_PREFIX, "ls-files", "--stage", "-z"]);
  if (output === null) return null;
  const files = [];
  for (const entry of output.split("\0")) {
    const tab = entry.indexOf("	");
    if (tab > 0 && (entry.startsWith("100644 ") || entry.startsWith("100755 "))) files.push(entry.slice(tab + 1));
  }
  return files;
}
function generatedFiles(root, paths2, env = process.env) {
  const program = gitProgram(env);
  if (program === void 0 || paths2.length === 0) return /* @__PURE__ */ new Set();
  const result = spawnSync(program, [...GIT_PREFIX, "check-attr", "-z", "--stdin", "linguist-generated", "linguist-vendored"], {
    cwd: root,
    env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
    input: paths2.join("\0"),
    stdio: ["pipe", "pipe", "ignore"],
    maxBuffer: 64 * 1024 * 1024
  });
  if (result.error || result.status !== 0) return /* @__PURE__ */ new Set();
  const fields = result.stdout.toString("utf8").split("\0");
  const marked = /* @__PURE__ */ new Set();
  for (let i = 0; i + 2 < fields.length; i += 3) if (fields[i + 2] === "set" || fields[i + 2] === "true") marked.add(fields[i]);
  return marked;
}
function untrackedFiles(root, env = process.env) {
  const program = gitProgram(env);
  if (program === void 0) return [];
  return (run(program, root, [...GIT_PREFIX, "ls-files", "--others", "--exclude-standard", "-z"]) ?? "").split("\0").filter((path) => path !== "");
}
function contextDiffSince(root, revision, env = process.env) {
  const program = gitProgram(env);
  if (program === void 0 || !REVISION_PATTERN.test(revision)) return null;
  return run(program, root, [...GIT_PREFIX, ...DIFF_FLAGS.map((flag) => flag === "--unified=0" ? "--unified=3" : flag), revision, "--"]);
}
function isAncestorOfHead(root, revision, env = process.env) {
  const program = gitProgram(env);
  if (program === void 0 || !REVISION_PATTERN.test(revision)) return false;
  return run(program, root, [...GIT_PREFIX, "merge-base", "--is-ancestor", revision, "HEAD"]) !== null;
}
function commitInfo(root, revision, env = process.env) {
  const program = gitProgram(env);
  if (program === void 0 || !REVISION_PATTERN.test(revision)) return null;
  const output = run(program, root, [...GIT_PREFIX, "log", "-1", "--format=%cI%x00%s", revision, "--"]);
  const at = output?.indexOf("\0") ?? -1;
  return output === null || output === void 0 || at < 0 ? null : { committedAt: output.slice(0, at), subject: output.slice(at + 1).trim() };
}

// packages/core/model/lineage.ts
import { existsSync as existsSync2, readdirSync as readdirSync2, readFileSync as readFileSync4 } from "node:fs";
import { join as join6 } from "node:path";

// packages/core/model/deny.ts
var DENIED_NAMES = [".git", ".archify", ".npmrc", ".pypirc", ".netrc"];
var ENV_EXCEPTIONS = [".env.example", ".env.sample"];
var DENIED_PREFIXES = ["id_rsa", "id_ed25519"];
var DENIED_EXTENSIONS = ["pem", "key", "p12", "pfx"];
function segmentDenied(segment) {
  const name2 = segment.toLowerCase();
  if (DENIED_NAMES.includes(name2)) return true;
  if (name2 === ".env" || name2.startsWith(".env.") && !ENV_EXCEPTIONS.includes(name2)) return true;
  if (DENIED_PREFIXES.some((prefix) => name2.startsWith(prefix))) return true;
  const dot = name2.lastIndexOf(".");
  return dot >= 0 && DENIED_EXTENSIONS.includes(name2.slice(dot + 1));
}
function isDenied(path) {
  return path.split("/").some(segmentDenied);
}

// packages/core/model/changeMap.ts
var OWN_OUTPUT = ".archify";
var isOwnOutput = (path) => path !== void 0 && (path === OWN_OUTPUT || path.startsWith(`${OWN_OUTPUT}/`));
var paths = (entry) => entry.oldPath === void 0 ? [entry.path] : [entry.path, entry.oldPath];
function nameOnly(entry, note) {
  const name2 = entry.oldPath === void 0 ? entry.path : `${entry.oldPath} \u2192 ${entry.path}`;
  return { entry, text: `${entry.status} ${name2} (${note})
` };
}
function addedFile(path, content) {
  const lines = content.split("\n");
  if (content.endsWith("\n")) lines.pop();
  const count = content === "" ? 0 : lines.length;
  const head = [`diff --git a/${path} b/${path}`, "new file (untracked)", "--- /dev/null", `+++ b/${path}`];
  const body = count === 0 ? [] : [`@@ -0,0 +1,${count} @@`, ...lines.map((line) => `+${line}`)];
  return { entry: { status: "added", path }, text: `${[...head, ...body].join("\n")}
` };
}
function sections(diff) {
  const out = [];
  for (const line of diff.split("\n")) {
    if (line.startsWith("diff --git ")) out.push("");
    if (out.length > 0) out[out.length - 1] += `${line}
`;
  }
  return out;
}
function collectChanges(input) {
  const files = [];
  const known = /* @__PURE__ */ new Set();
  for (const text of sections(input.diff)) {
    const change = parseDiff(text)[0];
    if (change === void 0) continue;
    const entry = change.status === "renamed" ? { status: "renamed", path: change.path, oldPath: change.oldPath } : { status: change.status, path: change.path };
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
    const below = dirty.endsWith("/") ? [...input.cited].filter((path) => path.startsWith(dirty)).sort() : [dirty];
    for (const path of below) {
      if (isOwnOutput(path) || known.has(path)) continue;
      known.add(path);
      files.push(nameOnly({ status: input.exists(path) ? "modified" : "deleted", path }, "uncommitted when the base map was made; read the current file"));
    }
  }
  return files;
}
function groupByBox(components2, files) {
  const touched = [];
  const untouched = [];
  const cited = /* @__PURE__ */ new Set();
  for (const component of components2) {
    const own = new Set(component.sources.map((source) => source.path));
    own.forEach((path) => cited.add(path));
    const mine = files.filter((file) => paths(file.entry).some((path) => own.has(path)));
    if (mine.length === 0) untouched.push({ id: component.id, label: component.label });
    else touched.push({ id: component.id, label: component.label, files: mine });
  }
  const uncited = files.filter((file) => !paths(file.entry).some((path) => cited.has(path))).map((file) => file.entry);
  return { touched, untouched, uncited };
}
function fence(text, lang = "") {
  let ticks = "```";
  while (text.includes(ticks)) ticks += "`";
  return `${ticks}${lang}
${text}${text.endsWith("\n") || text === "" ? "" : "\n"}${ticks}
`;
}
var name = (entry) => entry.oldPath === void 0 ? `${entry.status} ${entry.path}` : `${entry.status} ${entry.oldPath} \u2192 ${entry.path}`;
function renderChange(base, head, map) {
  const out = [`# The code change from ${base.slice(0, 7)} to the working tree at ${head.slice(0, 7)}, by box`, "", "## Changed code by box", ""];
  if (map.touched.length === 0) out.push("No box's cited files changed.", "");
  for (const box of map.touched) out.push(`### \`${box.id}\` (${box.label})`, "", fence(box.files.map((file) => file.text).join(""), "diff"));
  out.push("## Boxes whose cited files did not change", "", map.untouched.length === 0 ? "None." : map.untouched.map((box) => `- \`${box.id}\` (${box.label})`).join("\n"), "");
  out.push("## Changed files no box cites", "", map.uncited.length === 0 ? "None.\n" : fence(map.uncited.map(name).join("\n")));
  return out.join("\n");
}
function runChanges(map, baseRevision, revision) {
  return {
    schema: 1,
    baseRevision,
    revision,
    touched: map.touched.map((box) => ({ id: box.id, files: box.files.map((file) => file.entry) })),
    uncited: map.uncited
  };
}

// packages/core/model/confine.ts
import { lstatSync, realpathSync as realpathSync2 } from "node:fs";
import { dirname, isAbsolute, relative } from "node:path";
function isWithin(parentReal, childReal) {
  const rel = relative(parentReal, childReal);
  return rel === "" || !rel.startsWith("..") && !isAbsolute(rel);
}
function lstatOrNull(path) {
  try {
    return lstatSync(path);
  } catch {
    return null;
  }
}
function assertNotLink(path) {
  if (lstatOrNull(path)?.isSymbolicLink()) throw new Error(`${path} is a link. aisus does not write through links.`);
}
function assertWritable(root, path) {
  const rootReal = realpathSync2(root);
  let ancestor = dirname(path);
  while (lstatOrNull(ancestor) === null && dirname(ancestor) !== ancestor) ancestor = dirname(ancestor);
  let ancestorReal;
  try {
    ancestorReal = realpathSync2(ancestor);
  } catch {
    throw new Error(`${path} would be written through a broken link at ${ancestor}`);
  }
  if (!isWithin(rootReal, ancestorReal)) throw new Error(`${path} would be written outside ${root}`);
  assertNotLink(path);
}

// packages/core/model/refresh.ts
function inScope(path, globs) {
  return globs.length === 0 || globs.some((glob) => glob.test(path));
}

// packages/core/model/runFolder.ts
import { closeSync, fsyncSync, mkdirSync, openSync, realpathSync as realpathSync3, renameSync, rmSync, statSync as statSync2, unlinkSync, writeSync } from "node:fs";
import { basename, dirname as dirname2, join as join2, resolve, sep } from "node:path";
var MAP_DIR = ".archify";
var DRAFT_FILE = "draft.json";
var CANDIDATE_FILE = "candidate.json";
var SLUG_MAX = 40;
var RUN_NAME_PATTERN = /^([a-z0-9]+)-(.+)-(\d{8}-\d{6})(?:-(\d+))?$/;
var SEQUENCE_PREFIX = "sequence";
var MAX_COLLISIONS = 1e3;
function kebab(text) {
  let out = "";
  for (const ch of text) {
    if (/^[A-Za-z0-9]$/.test(ch)) out += ch.toLowerCase();
    else if (out !== "" && !out.endsWith("-")) out += "-";
    if (out.length > SLUG_MAX) break;
  }
  if (out.length > SLUG_MAX) {
    const head = out.slice(0, SLUG_MAX);
    const lastDash = head.lastIndexOf("-");
    out = out[SLUG_MAX] === "-" || lastDash < 0 ? head : head.slice(0, lastDash);
  }
  return out.replace(/-+$/, "");
}
function slugify(focus, repoFolderName) {
  return kebab(focus) || kebab(repoFolderName) || "repo";
}
function runTimestamp(date) {
  const two = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}${two(date.getMonth() + 1)}${two(date.getDate())}-${two(date.getHours())}${two(date.getMinutes())}${two(date.getSeconds())}`;
}
function parseRunName(name2) {
  const match = RUN_NAME_PATTERN.exec(name2);
  if (!match) return null;
  return { prefix: match[1], slug: match[2], timestamp: match[3], n: match[4] === void 0 ? 1 : Number(match[4]) };
}
function parseRunFolderName(name2) {
  const parsed = parseRunName(name2);
  if (parsed === null || parsed.prefix !== "architecture") return null;
  return { slug: parsed.slug, timestamp: parsed.timestamp, n: parsed.n };
}
function isInside(parentReal, childReal) {
  return childReal.startsWith(parentReal.endsWith(sep) ? parentReal : parentReal + sep);
}
function createRunFolder(root, slug, timestamp, options = {}) {
  const dir = options.dir ?? MAP_DIR;
  const prefix = options.prefix ?? "architecture";
  if (dir === "." || dir === ".." || /[/\\]/.test(dir)) throw new Error(`"${dir}" is not a valid run folder directory`);
  if (!/^[a-z0-9]+$/.test(prefix)) throw new Error(`"${prefix}" is not a valid run folder prefix`);
  const base = `${prefix}-${slug}-${timestamp}`;
  if (!parseRunName(base) || /[/\\]/.test(base)) throw new Error(`"${base}" is not a valid run folder name`);
  const parent = join2(root, dir);
  mkdirSync(parent, { recursive: true });
  const parentReal = realpathSync3(parent);
  if (!isInside(realpathSync3(root), parentReal) || !statSync2(parentReal).isDirectory()) {
    throw new Error(`${dir} must be a folder inside the repository root`);
  }
  for (let n = 1; n <= MAX_COLLISIONS; n += 1) {
    const name2 = n === 1 ? base : `${base}-${n}`;
    try {
      mkdirSync(join2(parentReal, name2));
      return name2;
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
    }
  }
  throw new Error(`can't create ${dir}/${base}: too many folders with that name`);
}

// packages/core/model/runRecord.ts
import { readdirSync, readFileSync as readFileSync2 } from "node:fs";
import { join as join4 } from "node:path";

// packages/core/model/session.ts
import {
  appendFileSync,
  closeSync as closeSync2,
  existsSync,
  fsyncSync as fsyncSync2,
  mkdirSync as mkdirSync2,
  openSync as openSync2,
  readFileSync,
  renameSync as renameSync2,
  rmSync as rmSync2,
  writeSync as writeSync2
} from "node:fs";
import { dirname as dirname3, join as join3 } from "node:path";
var STALE_IDLE_MS = 24 * 60 * 60 * 1e3;
function writeAtomic(path, content) {
  const temp = join3(dirname3(path), `.tmp-${process.pid}-${Date.now()}`);
  try {
    const fd = openSync2(temp, "wx");
    try {
      writeSync2(fd, content);
      fsyncSync2(fd);
    } finally {
      closeSync2(fd);
    }
    renameSync2(temp, path);
  } catch (error) {
    rmSync2(temp, { force: true });
    throw error;
  }
}
function writeJson(path, value) {
  writeAtomic(path, `${JSON.stringify(value, null, 2)}
`);
}

// packages/core/model/types.ts
function isJsonObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// packages/core/model/runRecord.ts
var RUN_FILE = "run.json";
function newRunRecord(fields, now = /* @__PURE__ */ new Date()) {
  return {
    schema: 1,
    kind: fields.kind ?? "full",
    focus: fields.focus,
    paths: fields.paths ?? [],
    base: fields.base ?? null,
    parent: fields.parent ?? null,
    createdAt: now.toISOString(),
    skillVersion: fields.skillVersion,
    phase: "created",
    attempts: 0
  };
}
function readRunRecord(runDir) {
  try {
    const value = JSON.parse(readFileSync2(join4(runDir, RUN_FILE), "utf8"));
    return isJsonObject(value) && value["schema"] === 1 && typeof value["phase"] === "string" ? value : null;
  } catch {
    return null;
  }
}
function writeRunRecord(root, runDir, record) {
  const path = join4(runDir, RUN_FILE);
  assertWritable(root, path);
  writeJson(path, record);
}

// packages/core/model/staleness.ts
import { readFileSync as readFileSync3 } from "node:fs";
import { join as join5 } from "node:path";

// packages/core/model/fingerprints.ts
var FINGERPRINTS_FILE = "fingerprints.json";

// packages/core/model/staleness.ts
function readFingerprints(runDir) {
  try {
    const value = JSON.parse(readFileSync3(join5(runDir, FINGERPRINTS_FILE), "utf8"));
    return isJsonObject(value) && value["schema"] === 1 && Array.isArray(value["citations"]) ? value : null;
  } catch {
    return null;
  }
}

// packages/core/model/lineage.ts
var LINEAGE_FILE = "lineage.json";
var MAX_UPDATES = 5;
var MAX_CHANGE_BYTES = 2 * 1024 * 1024;
var isCount = (value) => Number.isInteger(value) && value >= 0;
var isNullableString = (value) => value === null || typeof value === "string";
function commit(value) {
  return isJsonObject(value) && typeof value["subject"] === "string" && typeof value["committedAt"] === "string" ? { subject: value["subject"], committedAt: value["committedAt"] } : null;
}
function parseLineage(value) {
  if (!isJsonObject(value) || value["schema"] !== 1 || value["mode"] !== "update" && value["mode"] !== "regenerate") return null;
  const { reason, previousRun, baseRevision, revision, dirty, dirtyCount, updatesSinceRegeneration } = value;
  if (typeof reason !== "string" || !isNullableString(previousRun) || !isNullableString(baseRevision) || !isNullableString(revision)) return null;
  if (!Array.isArray(dirty) || !dirty.every((path) => typeof path === "string") || !isCount(dirtyCount) || !isCount(updatesSinceRegeneration)) return null;
  return {
    schema: 1,
    mode: value["mode"],
    reason,
    previousRun,
    baseRevision,
    revision,
    baseCommit: commit(value["baseCommit"]),
    headCommit: commit(value["headCommit"]),
    dirty,
    dirtyCount,
    updatesSinceRegeneration
  };
}
function readJsonFile(path) {
  try {
    return JSON.parse(readFileSync4(path, "utf8"));
  } catch {
    return void 0;
  }
}
function readLineage(runDir) {
  return parseLineage(readJsonFile(join6(runDir, LINEAGE_FILE)));
}
function writeRunFile(root, runDir, file, value) {
  const path = join6(runDir, file);
  assertWritable(root, path);
  writeJson(path, value);
}
function redrawReason(facts) {
  if (!facts.hasGit) return "no-git";
  if (facts.base === null) return "no-base-revision";
  if (facts.previous !== null && facts.previous.dirtyCount > MAX_DIRTY_PATHS) return "dirty-baseline";
  if (!facts.reachable(facts.base)) return "base-unreachable";
  if (facts.previous !== null && facts.previous.updatesSinceRegeneration >= MAX_UPDATES) return "scheduled";
  return null;
}
function components(doc) {
  const list = isJsonObject(doc) && Array.isArray(doc["components"]) ? doc["components"] : [];
  return list.flatMap((component) => {
    if (!isJsonObject(component) || typeof component["id"] !== "string") return [];
    const sources = Array.isArray(component["sources"]) ? component["sources"].filter((source) => isJsonObject(source) && typeof source["path"] === "string") : [];
    return [{ id: component["id"], label: typeof component["label"] === "string" ? component["label"] : component["id"], sources }];
  });
}
function planRefresh(root, run2, globs = []) {
  const runDir = join6(root, MAP_DIR, run2);
  const focus = readRunRecord(runDir)?.focus ?? "";
  const previous = readLineage(runDir);
  const git = collectGitFacts(root);
  const base = previous?.revision ?? readFingerprints(runDir)?.revision ?? null;
  const reason = redrawReason({ hasGit: git !== null, previous, base, reachable: (revision) => isAncestorOfHead(root, revision) });
  if (reason !== null) return { mode: "regenerate", reason, focus };
  const diff = contextDiffSince(root, base);
  if (diff === null || git === null) return { mode: "regenerate", reason: "base-unreachable", focus };
  const boxes = components(readJsonFile(join6(runDir, CANDIDATE_FILE)));
  const cited = new Set(boxes.flatMap((box) => box.sources.map((source) => source.path)));
  const files = collectChanges({
    diff,
    untracked: untrackedFiles(root),
    previousDirty: previous?.dirty ?? [],
    cited,
    exists: (path) => existsSync2(join6(root, path)),
    readUntracked: (path) => {
      try {
        const bytes = readFileSync4(join6(root, path));
        return bytes.includes(0) ? null : bytes.toString("utf8");
      } catch {
        return null;
      }
    }
  }).filter((file) => inScope(file.entry.path, globs) || file.entry.oldPath !== void 0 && inScope(file.entry.oldPath, globs));
  const map = groupByBox(boxes, files);
  const change = renderChange(base, git.head, map);
  if (new TextEncoder().encode(change).length > MAX_CHANGE_BYTES) return { mode: "regenerate", reason: "change-too-large", focus };
  const lineage = {
    schema: 1,
    mode: "update",
    reason: "update",
    previousRun: run2,
    baseRevision: base,
    revision: git.head,
    baseCommit: commitInfo(root, base),
    headCommit: commitInfo(root, git.head),
    dirty: git.dirty,
    dirtyCount: git.dirtyCount,
    updatesSinceRegeneration: (previous?.updatesSinceRegeneration ?? 0) + 1
  };
  return { mode: "update", focus, base, git, map, change, lineage, changes: runChanges(map, base, git.head) };
}
function previousMap(root, slug, except = null) {
  let best = null;
  let names;
  try {
    names = readdirSync2(join6(root, MAP_DIR));
  } catch {
    return null;
  }
  for (const run2 of names) {
    const parsed = parseRunFolderName(run2);
    if (parsed === null || parsed.slug !== slug || run2 === except || !existsSync2(join6(root, MAP_DIR, run2, CANDIDATE_FILE))) continue;
    if (readRunRecord(join6(root, MAP_DIR, run2))?.kind === "drill") continue;
    const key = `${parsed.timestamp}-${String(parsed.n).padStart(6, "0")}`;
    if (best === null || key > best.key) best = { run: run2, key };
  }
  return best?.run ?? null;
}

// packages/core/model/coefficients.json
var coefficients_default = {
  basis: "provisional",
  fittedAt: null,
  runs: 0,
  lines: {
    claude: {
      full: {
        base: 12e4,
        perLine: 1.5,
        perFile: 30,
        low: 0.7,
        high: 1.4
      },
      refresh: {
        base: 6e4,
        perLine: 0.3,
        perFile: 10,
        low: 0.6,
        high: 1.6
      },
      ask: {
        base: 3e4,
        perLine: 0.1,
        perFile: 5,
        low: 0.5,
        high: 2
      }
    },
    codex: {
      full: {
        base: 9e4,
        perLine: 1.5,
        perFile: 30,
        low: 0.7,
        high: 1.4
      },
      refresh: {
        base: 45e3,
        perLine: 0.3,
        perFile: 10,
        low: 0.6,
        high: 1.6
      },
      ask: {
        base: 25e3,
        perLine: 0.1,
        perFile: 5,
        low: 0.5,
        high: 2
      }
    }
  },
  mix: {
    claude: {
      input: 0.05,
      cacheWrite: 0.1,
      cacheRead: 0.82,
      output: 0.03
    },
    codex: {
      input: 0.15,
      cacheWrite: 0,
      cacheRead: 0.8,
      output: 0.05
    }
  }
};

// packages/core/model/pricing.json
var pricing_default = {
  asOf: "2026-10-18",
  unit: "USD per million tokens",
  defaults: { claude: "claude-opus-5-5", codex: "gpt-5.5" },
  models: [
    { id: "claude-fable-5-1", label: "Claude Fable 5.1", agent: "claude", input: 10, cacheWrite: 12.5, cacheRead: 0.25, output: 50, source: "https://platform.claude.com/docs/en/about-claude/pricing" },
    { id: "claude-opus-5-5", label: "Claude Opus 5.5", agent: "claude", input: 4, cacheWrite: 5, cacheRead: 0.2, output: 20, source: "https://platform.claude.com/docs/en/about-claude/pricing" },
    { id: "claude-sonnet-5-5", label: "Claude Sonnet 5.5", agent: "claude", input: 2, cacheWrite: 2.5, cacheRead: 0.1, output: 10, source: "https://platform.claude.com/docs/en/about-claude/pricing" },
    { id: "gpt-5.5", label: "GPT-5.5", agent: "codex", input: 5, cacheWrite: 0, cacheRead: 0.5, output: 30, source: "https://developers.openai.com/api/docs/pricing" },
    { id: "gpt-5.4", label: "GPT-5.4", agent: "codex", input: 2.5, cacheWrite: 0, cacheRead: 0.25, output: 15, source: "https://developers.openai.com/api/docs/pricing" },
    { id: "gpt-5.3-codex", label: "GPT-5.3-Codex", agent: "codex", input: 1.75, cacheWrite: 0, cacheRead: 0.175, output: 14, source: "https://developers.openai.com/api/docs/pricing" }
  ]
};

// packages/core/model/estimate.ts
var COEFFICIENTS = coefficients_default;
var PRICING = pricing_default;
function estimate(size, agent, kind, table = COEFFICIENTS) {
  const line = table.lines[agent][kind];
  const tokens = line.base + line.perLine * size.nonTestLines + line.perFile * size.files;
  return { low: Math.round(tokens * line.low), high: Math.round(tokens * line.high), basis: table.basis };
}
function modelPrice(agent, id, table = PRICING) {
  return table.models.find((model) => model.id === (id ?? table.defaults[agent]) && model.agent === agent);
}
function dollars(tokens, model, mix) {
  return tokens / 1e6 * (mix.input * model.input + mix.cacheWrite * model.cacheWrite + mix.cacheRead * model.cacheRead + mix.output * model.output);
}
function priceRange(range, agent, model, table = COEFFICIENTS) {
  const mix = table.mix[agent];
  return { low: dollars(range.low, model, mix), high: dollars(range.high, model, mix) };
}
function tokenAmount(tokens) {
  if (tokens >= 995e3) return `${(tokens / 1e6).toFixed(1).replace(/\.0$/, "")}M`;
  return `${Math.max(10, Math.round(tokens / 1e4) * 10)}k`;
}
var usd = (value) => `$${Math.max(0.01, value).toFixed(2)}`;
function estimateText(range, price) {
  const tokens = `About ${tokenAmount(range.low)}\u2013${tokenAmount(range.high)} tokens`;
  return price === null ? tokens : `${tokens} (${usd(price.low)}\u2013${usd(price.high)} at API prices)`;
}
function runEstimate(size, agent, kind, confirmAbove) {
  const range = estimate(size, agent, kind);
  const model = modelPrice(agent);
  return { range, text: estimateText(range, model ? priceRange(range, agent, model) : null), model: model?.id ?? null, confirm: range.high > confirmAbove };
}
function skillEstimates(size, kind) {
  const entry = (agent) => {
    const { range, text } = runEstimate(size, agent, kind, Infinity);
    return { ...range, text };
  };
  return { claude: entry("claude"), codex: entry("codex") };
}

// packages/core/model/repoSize.ts
import { lstatSync as lstatSync2, readdirSync as readdirSync3, readFileSync as readFileSync5 } from "node:fs";
import { join as join7 } from "node:path";
var SKIPPED_DIRS = [".git", "node_modules", "vendor", "dist", "build", "target", "out", ".aisus"];
var COUNT_LIMIT = 2e3;
var MAX_FILE_BYTES = 1024 * 1024;
var TIER_BOUNDS = { M: 2e4, L: 15e4 };
var READ_BUDGET = { S: 25, M: 45, L: 70 };
var LANGUAGES = {
  ts: "TypeScript",
  tsx: "TypeScript",
  mts: "TypeScript",
  cts: "TypeScript",
  js: "JavaScript",
  jsx: "JavaScript",
  mjs: "JavaScript",
  cjs: "JavaScript",
  py: "Python",
  java: "Java",
  kt: "Kotlin",
  kts: "Kotlin",
  scala: "Scala",
  groovy: "Groovy",
  gradle: "Gradle",
  go: "Go",
  rs: "Rust",
  rb: "Ruby",
  php: "PHP",
  cs: "C#",
  fs: "F#",
  swift: "Swift",
  dart: "Dart",
  c: "C",
  h: "C",
  cc: "C++",
  cpp: "C++",
  cxx: "C++",
  hpp: "C++",
  hh: "C++",
  m: "Objective-C",
  mm: "Objective-C",
  ex: "Elixir",
  exs: "Elixir",
  erl: "Erlang",
  hs: "Haskell",
  clj: "Clojure",
  lua: "Lua",
  r: "R",
  jl: "Julia",
  sh: "Shell",
  bash: "Shell",
  zsh: "Shell",
  ps1: "PowerShell",
  sql: "SQL",
  html: "HTML",
  htm: "HTML",
  css: "CSS",
  scss: "CSS",
  sass: "CSS",
  less: "CSS",
  vue: "Vue",
  svelte: "Svelte",
  md: "Markdown",
  mdx: "Markdown",
  rst: "reStructuredText",
  adoc: "AsciiDoc",
  json: "JSON",
  yml: "YAML",
  yaml: "YAML",
  toml: "TOML",
  xml: "XML",
  proto: "Protocol Buffers",
  graphql: "GraphQL",
  tf: "Terraform"
};
var NAMED = { dockerfile: "Dockerfile", makefile: "Makefile", gemfile: "Ruby", rakefile: "Ruby" };
var BINARY = new Set(
  "png jpg jpeg gif bmp ico webp tif tiff psd pdf zip gz tgz bz2 xz 7z rar jar war ear class o a so dylib dll exe bin wasm woff woff2 ttf otf eot mp3 mp4 m4a mov avi mkv webm wav flac ogg sqlite db pyc pyo vsix lockb".split(" ")
);
var GENERATED = /(^|\/)(package-lock\.json|npm-shrinkwrap\.json|yarn\.lock|pnpm-lock\.yaml|bun\.lock|Cargo\.lock|poetry\.lock|Pipfile\.lock|composer\.lock|Gemfile\.lock|go\.sum)$|\.min\.(js|css)$|\.map$/;
var TEST_DIRS = /* @__PURE__ */ new Set(["test", "tests", "__tests__", "spec", "specs", "e2e", "testdata", "fixtures"]);
var TEST_FILES = /(\.|_)(test|spec)\.[^./]+$|^test_[^/]+\.py$|(Test|Tests|IT)\.(java|kt|scala)$|_spec\.rb$/;
function languageOf(path) {
  if (GENERATED.test(path)) return null;
  const name2 = path.slice(path.lastIndexOf("/") + 1);
  const named = NAMED[name2.toLowerCase()];
  if (named !== void 0) return named;
  const dot = name2.lastIndexOf(".");
  const extension = dot > 0 ? name2.slice(dot + 1).toLowerCase() : "";
  if (BINARY.has(extension)) return null;
  return LANGUAGES[extension] ?? "Other";
}
function isTestPath(path) {
  const segments = path.split("/");
  const name2 = segments.pop();
  return segments.some((segment) => TEST_DIRS.has(segment.toLowerCase())) || TEST_FILES.test(name2);
}
function sizeFacts(size) {
  return { nonTestLines: size.lines.nonTest, files: size.files };
}
function tierOf(nonTestLines) {
  return nonTestLines < TIER_BOUNDS.M ? "S" : nonTestLines <= TIER_BOUNDS.L ? "M" : "L";
}
function skipped(path) {
  return path.split("/").some((segment) => SKIPPED_DIRS.includes(segment)) || isDenied(path);
}
function walk(root) {
  const files = [];
  const pending = [""];
  while (pending.length > 0) {
    const dir = pending.pop();
    let entries;
    try {
      entries = readdirSync3(join7(root, dir), { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const path = dir === "" ? entry.name : `${dir}/${entry.name}`;
      if (SKIPPED_DIRS.includes(entry.name) || isDenied(path)) continue;
      if (entry.isDirectory()) pending.push(path);
      else if (entry.isFile()) files.push(path);
    }
  }
  return files.sort();
}
function countFile(path) {
  let data;
  try {
    const stat = lstatSync2(path);
    if (!stat.isFile() || stat.size > MAX_FILE_BYTES) return null;
    data = readFileSync5(path);
  } catch {
    return null;
  }
  if (data.subarray(0, 8e3).includes(0)) return null;
  let lines = 0;
  for (let at = data.indexOf(10); at !== -1; at = data.indexOf(10, at + 1)) lines++;
  return data.length > 0 && data[data.length - 1] !== 10 ? lines + 1 : lines;
}
function listFiles(root, env = process.env) {
  const tracked = trackedFiles(root, env);
  const kept = tracked === null ? walk(root) : tracked.filter((path) => !skipped(path)).sort();
  const generated = tracked === null ? /* @__PURE__ */ new Set() : generatedFiles(root, kept, env);
  return { listing: tracked === null ? "walk" : "git", files: generated.size === 0 ? kept : kept.filter((path) => !generated.has(path)) };
}
function repoSize(root, env = process.env, limit = COUNT_LIMIT) {
  const { listing, files: listed } = listFiles(root, env);
  const candidates = [];
  for (const path of listed) {
    const language = languageOf(path);
    if (language !== null) candidates.push({ path, language });
  }
  const step = Math.max(1, candidates.length / limit);
  const counts = /* @__PURE__ */ new Map();
  const means = /* @__PURE__ */ new Map();
  for (let at = 0; at < candidates.length; at += step) {
    const index = Math.floor(at);
    const file = candidates[index];
    const count = countFile(join7(root, file.path));
    counts.set(index, count);
    if (count === null) continue;
    const seen = means.get(file.language) ?? { files: 0, lines: 0 };
    means.set(file.language, { files: seen.files + 1, lines: seen.lines + count });
  }
  const all = [...means.values()].reduce((sum, entry) => ({ files: sum.files + entry.files, lines: sum.lines + entry.lines }), { files: 0, lines: 0 });
  const meanLines = (language) => {
    const entry = means.get(language) ?? all;
    return entry.files > 0 ? entry.lines / entry.files : 0;
  };
  const languages = /* @__PURE__ */ new Map();
  let files = 0;
  let counted = 0;
  for (const [index, file] of candidates.entries()) {
    const known = counts.get(index);
    if (known === null) continue;
    if (known !== void 0) counted++;
    const count = known ?? meanLines(file.language);
    files++;
    const entry = languages.get(file.language) ?? { language: file.language, files: 0, lines: 0, testLines: 0 };
    entry.files++;
    entry.lines += count;
    if (isTestPath(file.path)) entry.testLines += count;
    languages.set(file.language, entry);
  }
  const sorted = [...languages.values()].map((entry) => ({ ...entry, lines: Math.round(entry.lines), testLines: Math.round(entry.testLines) })).sort((a, b) => b.lines - a.lines || a.language.localeCompare(b.language));
  const total = sorted.reduce((sum, entry) => sum + entry.lines, 0);
  const test = sorted.reduce((sum, entry) => sum + entry.testLines, 0);
  return { listing, files, counted, lines: { total, test, nonTest: total - test }, languages: sorted, tier: tierOf(total - test) };
}

// packages/core/agent/repo-facts.ts
var SKILL_VERSION = "0.3.0";
var USAGE = "repo-facts.mjs: usage: node repo-facts.mjs [--focus <text>] [--parent <run>] [--kind sequence]\n";
function main(args) {
  let focus = "";
  let parent = null;
  let sequence = false;
  for (let i = 0; i < args.length; i += 2) {
    const value = args[i + 1];
    if (value === void 0 || !["--focus", "--parent", "--kind"].includes(args[i]) || args[i] === "--kind" && value !== SEQUENCE_PREFIX) {
      process.stderr.write(USAGE);
      return 2;
    }
    if (args[i] === "--focus") focus = value;
    else if (args[i] === "--kind") sequence = true;
    else parent = value;
  }
  if (sequence && (focus.trim() === "" || parent !== null)) {
    process.stderr.write("repo-facts.mjs: a sequence map needs --focus naming the flow to follow, and takes no --parent\n");
    return 2;
  }
  const root = process.cwd();
  if (parent !== null && (!parseRunFolderName(parent) || !existsSync3(join8(root, MAP_DIR, parent, CANDIDATE_FILE)))) {
    process.stderr.write(`repo-facts.mjs: --parent names no accepted map in ${MAP_DIR}/: ${parent}
`);
    return 2;
  }
  const git = collectGitFacts(root);
  const slug = slugify(focus, basename2(root));
  const previous = parent === null && !sequence ? previousMap(root, slug) : null;
  let reason = "no-previous";
  if (previous !== null) {
    const plan = planRefresh(root, previous);
    reason = plan.mode === "update" ? "requested" : plan.reason;
  }
  const lineage = {
    schema: 1,
    mode: "regenerate",
    reason,
    previousRun: previous,
    baseRevision: null,
    revision: git?.head ?? null,
    baseCommit: null,
    headCommit: git === null ? null : commitInfo(root, git.head),
    dirty: git?.dirty ?? [],
    dirtyCount: git?.dirtyCount ?? 0,
    updatesSinceRegeneration: 0
  };
  let run2;
  try {
    run2 = createRunFolder(root, slug, runTimestamp(/* @__PURE__ */ new Date()), sequence ? { prefix: SEQUENCE_PREFIX } : {});
    writeRunRecord(root, join8(root, MAP_DIR, run2), newRunRecord({ focus, skillVersion: SKILL_VERSION, ...parent === null ? {} : { kind: "drill", parent } }));
    if (!sequence) writeRunFile(root, join8(root, MAP_DIR, run2), LINEAGE_FILE, lineage);
  } catch (error) {
    process.stderr.write(`repo-facts.mjs: ${error.message}
`);
    return 2;
  }
  const size = repoSize(root);
  const facts = {
    root,
    runFolder: `${MAP_DIR}/${run2}`,
    draft: `${MAP_DIR}/${run2}/${DRAFT_FILE}`,
    previous: previous === null ? null : `${MAP_DIR}/${previous}/${CANDIDATE_FILE}`,
    git: git && { head: git.head, origin: git.origin, dirtyCount: git.dirtyCount, dirty: git.dirty },
    size,
    estimate: skillEstimates(sizeFacts(size), "full"),
    budget: READ_BUDGET[size.tier]
  };
  process.stdout.write(`${JSON.stringify(facts, null, 2)}
`);
  return 0;
}
process.exitCode = main(process.argv.slice(2));
