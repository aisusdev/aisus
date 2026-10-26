// packages/core/agent/match-ids.ts
import { readFileSync, realpathSync as realpathSync2, writeFileSync } from "node:fs";
import { basename as basename2, dirname as dirname3, resolve as resolve2 } from "node:path";

// packages/core/model/confine.ts
import { lstatSync, realpathSync } from "node:fs";
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
  const rootReal = realpathSync(root);
  let ancestor = dirname(path);
  while (lstatOrNull(ancestor) === null && dirname(ancestor) !== ancestor) ancestor = dirname(ancestor);
  let ancestorReal;
  try {
    ancestorReal = realpathSync(ancestor);
  } catch {
    throw new Error(`${path} would be written through a broken link at ${ancestor}`);
  }
  if (!isWithin(rootReal, ancestorReal)) throw new Error(`${path} would be written outside ${root}`);
  assertNotLink(path);
}

// packages/core/model/types.ts
function isJsonObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// packages/core/model/matchIds.ts
var MATCH_THRESHOLD = 0.3;
var objects = (value) => Array.isArray(value) ? value.filter(isJsonObject) : [];
var idOf = (value) => typeof value["id"] === "string" ? value["id"] : void 0;
function boxes(components) {
  return components.flatMap((component) => {
    const id = idOf(component);
    if (id === void 0) return [];
    const files = new Set(objects(component["sources"]).flatMap((source) => typeof source["path"] === "string" ? [source["path"]] : []));
    return [{ id, label: component["label"], files }];
  });
}
function jaccard(a, b) {
  let shared = 0;
  for (const file of a) if (b.has(file)) shared++;
  const union = a.size + b.size - shared;
  return union === 0 ? 0 : shared / union;
}
function pairs(earlier, draft) {
  const candidates = earlier.flatMap((e) => draft.map((d) => ({ e, d, score: jaccard(e.files, d.files) }))).filter((pair) => pair.score > 0 && pair.score >= MATCH_THRESHOLD);
  candidates.sort((x, y) => y.score - x.score || Number(y.e.label === y.d.label) - Number(x.e.label === x.d.label) || x.e.id.localeCompare(y.e.id) || x.d.id.localeCompare(y.d.id));
  const matched = /* @__PURE__ */ new Map();
  const taken = /* @__PURE__ */ new Set();
  for (const { e, d } of candidates) {
    if (matched.has(d.id) || taken.has(e.id)) continue;
    matched.set(d.id, e.id);
    taken.add(e.id);
  }
  return matched;
}
function fresh(id, taken) {
  for (let n = 1; ; n++) if (!taken.has(`${id}-n${n}`)) return `${id}-n${n}`;
}
function matchIds(earlier, draft) {
  const before = isJsonObject(earlier) ? earlier : {};
  const earlierBoxes = boxes(objects(before["components"]));
  const draftComponents = objects(draft["components"]);
  const rename = pairs(earlierBoxes, boxes(draftComponents));
  const earlierIds = new Set(earlierBoxes.map((box) => box.id));
  const taken = /* @__PURE__ */ new Set([...earlierIds, ...draftComponents.flatMap((component) => idOf(component) ?? [])]);
  for (const component of draftComponents) {
    const id = idOf(component);
    if (id === void 0 || rename.has(id)) continue;
    if (!earlierIds.has(id)) rename.set(id, id);
    else {
      const next = fresh(id, taken);
      taken.add(next);
      rename.set(id, next);
    }
  }
  const mapId = (id) => typeof id === "string" ? rename.get(id) ?? id : id;
  const matchedEarlier = new Set([...rename.entries()].filter(([from, to]) => from !== to || earlierIds.has(to)).map(([, to]) => to));
  const earlierArrows = /* @__PURE__ */ new Map();
  for (const arrow of objects(before["connections"])) {
    const id = idOf(arrow);
    if (id === void 0) continue;
    const key = `${arrow["from"]}\0${arrow["to"]}`;
    earlierArrows.set(key, [...earlierArrows.get(key) ?? [], id]);
  }
  const usedArrows = /* @__PURE__ */ new Set();
  const arrowIds = /* @__PURE__ */ new Set([...[...earlierArrows.values()].flat(), ...objects(draft["connections"]).flatMap((arrow) => idOf(arrow) ?? [])]);
  const connections = Array.isArray(draft["connections"]) ? draft["connections"].map((arrow) => {
    if (!isJsonObject(arrow)) return arrow;
    const from = mapId(arrow["from"]);
    const to = mapId(arrow["to"]);
    const next = { ...arrow, from, to };
    if (matchedEarlier.has(from) && matchedEarlier.has(to)) {
      const id = (earlierArrows.get(`${from}\0${to}`) ?? []).find((candidate) => !usedArrows.has(candidate));
      if (id !== void 0) {
        usedArrows.add(id);
        next["id"] = id;
        return next;
      }
    }
    const own = idOf(arrow);
    if (own !== void 0 && earlierArrows.size > 0 && [...earlierArrows.values()].some((ids) => ids.includes(own))) {
      next["id"] = fresh(own, arrowIds);
      arrowIds.add(next["id"]);
    }
    return next;
  }) : draft["connections"];
  return {
    ...draft,
    components: draft["components"].map((component) => isJsonObject(component) && idOf(component) !== void 0 ? { ...component, id: mapId(component["id"]) } : component),
    ...connections === void 0 ? {} : { connections },
    ...Array.isArray(draft["boundaries"]) ? { boundaries: draft["boundaries"].map((boundary) => isJsonObject(boundary) && Array.isArray(boundary["wraps"]) ? { ...boundary, wraps: boundary["wraps"].map(mapId) } : boundary) } : {}
  };
}

// packages/core/model/runFolder.ts
import { basename, dirname as dirname2, join, resolve, sep } from "node:path";
var MAP_DIR = ".archify";
var DRAFT_FILE = "draft.json";
var CANDIDATE_FILE = "candidate.json";
var RUN_NAME_PATTERN = /^([a-z0-9]+)-(.+)-(\d{8}-\d{6})(?:-(\d+))?$/;
var SEQUENCE_PREFIX = "sequence";
function mapKindOf(name) {
  const prefix = parseRunName(name)?.prefix;
  return prefix === "architecture" || prefix === SEQUENCE_PREFIX ? prefix : null;
}
function parseRunName(name) {
  const match = RUN_NAME_PATTERN.exec(name);
  if (!match) return null;
  return { prefix: match[1], slug: match[2], timestamp: match[3], n: match[4] === void 0 ? 1 : Number(match[4]) };
}
function locateDraft(arg, cwd) {
  const draft = resolve(cwd, arg);
  const runDir = dirname2(draft);
  const maps = dirname2(runDir);
  const run = basename(runDir);
  if (basename(draft) !== DRAFT_FILE || basename(maps) !== MAP_DIR) {
    throw new Error(`expected a path of the form <repo>/${MAP_DIR}/<run>/${DRAFT_FILE}, got ${arg}`);
  }
  const kind = mapKindOf(run);
  if (kind === null) throw new Error(`run folder "${run}" does not match architecture-<slug>-<YYYYMMDD-HHMMSS>[-N] or sequence-<slug>-<YYYYMMDD-HHMMSS>[-N]`);
  return { root: dirname2(maps), run, slug: parseRunName(run).slug, draft, kind };
}

// packages/core/agent/match-ids.ts
var USAGE = `usage: node match-ids.mjs <repo>/${MAP_DIR}/<run>/draft.json --previous <repo>/${MAP_DIR}/<run>/${CANDIDATE_FILE}`;
function fail(message) {
  process.stderr.write(`match-ids.mjs: ${message}
`);
  return 2;
}
function main(args) {
  if (args.length !== 3 || args[1] !== "--previous") return fail(USAGE);
  let location;
  try {
    location = locateDraft(args[0], process.cwd());
  } catch (error) {
    return fail(error.message);
  }
  const previous = resolve2(process.cwd(), args[2]);
  if (basename2(previous) !== CANDIDATE_FILE || basename2(dirname3(dirname3(previous))) !== MAP_DIR) return fail(USAGE);
  let draft;
  let earlier;
  try {
    const root = realpathSync2(location.root);
    if (!isWithin(root, realpathSync2(location.draft)) || !isWithin(root, realpathSync2(previous))) return fail("both files must lie inside the repository");
    draft = JSON.parse(readFileSync(location.draft, "utf8"));
    earlier = JSON.parse(readFileSync(previous, "utf8"));
  } catch (error) {
    return fail(`cannot read the draft or the earlier map: ${error.message}`);
  }
  if (!isJsonObject(draft) || !Array.isArray(draft["components"])) return fail("the draft has no components list; the validator says what is wrong with it");
  const matched = matchIds(earlier, draft);
  const earlierIds = new Set((isJsonObject(earlier) && Array.isArray(earlier["components"]) ? earlier["components"] : []).flatMap((box) => isJsonObject(box) && typeof box["id"] === "string" ? [box["id"]] : []));
  const kept = matched["components"].filter((box) => isJsonObject(box) && earlierIds.has(box["id"])).length;
  try {
    assertWritable(location.root, location.draft);
    writeFileSync(location.draft, `${JSON.stringify(matched, null, 2)}
`);
  } catch (error) {
    return fail(error.message);
  }
  process.stdout.write(`${JSON.stringify({ status: "matched", kept, boxes: matched["components"].length }, null, 2)}
`);
  return 0;
}
process.exitCode = main(process.argv.slice(2));
