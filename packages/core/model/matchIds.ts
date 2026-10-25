// FRS-09: gives the boxes of a freshly drawn draft the ids of the earlier map's boxes they match,
// by how much their cited files overlap, so a comparison across a full drawing matches by id.
// Browser-safe.
import { isJsonObject, type JsonObject } from "./types";

/** Least Jaccard similarity of two boxes' cited files for the new box to take the earlier id. */
export const MATCH_THRESHOLD = 0.3;

interface Box {
  id: string;
  label: unknown;
  files: Set<string>;
}

const objects = (value: unknown): JsonObject[] => (Array.isArray(value) ? value.filter(isJsonObject) : []);
const idOf = (value: JsonObject): string | undefined => (typeof value["id"] === "string" ? value["id"] : undefined);

function boxes(components: JsonObject[]): Box[] {
  return components.flatMap((component) => {
    const id = idOf(component);
    if (id === undefined) return [];
    const files = new Set(objects(component["sources"]).flatMap((source) => (typeof source["path"] === "string" ? [source["path"]] : [])));
    return [{ id, label: component["label"], files }];
  });
}

function jaccard(a: Set<string>, b: Set<string>): number {
  let shared = 0;
  for (const file of a) if (b.has(file)) shared++;
  const union = a.size + b.size - shared;
  return union === 0 ? 0 : shared / union;
}

/** One-to-one pairs, best similarity first; ties go to equal labels, then to the ids in order. */
function pairs(earlier: Box[], draft: Box[]): Map<string, string> {
  const candidates = earlier.flatMap((e) => draft.map((d) => ({ e, d, score: jaccard(e.files, d.files) }))).filter((pair) => pair.score > 0 && pair.score >= MATCH_THRESHOLD);
  candidates.sort((x, y) => y.score - x.score || Number(y.e.label === y.d.label) - Number(x.e.label === x.d.label) || x.e.id.localeCompare(y.e.id) || x.d.id.localeCompare(y.d.id));
  const matched = new Map<string, string>();
  const taken = new Set<string>();
  for (const { e, d } of candidates) {
    if (matched.has(d.id) || taken.has(e.id)) continue;
    matched.set(d.id, e.id);
    taken.add(e.id);
  }
  return matched;
}

/** `id` with the first `-n<k>` suffix no id in `taken` has. */
function fresh(id: string, taken: Set<string>): string {
  for (let n = 1; ; n++) if (!taken.has(`${id}-n${n}`)) return `${id}-n${n}`;
}

/**
 * `draft` with each box that matches an earlier box renamed to the earlier id, and the arrows and
 * boundaries following. A box that reuses an earlier id without matching it gets a fresh id. An
 * arrow between two matched boxes takes the id of the earlier arrow between them.
 */
export function matchIds(earlier: unknown, draft: JsonObject): JsonObject {
  const before = isJsonObject(earlier) ? earlier : {};
  const earlierBoxes = boxes(objects(before["components"]));
  const draftComponents = objects(draft["components"]);
  const rename = pairs(earlierBoxes, boxes(draftComponents));
  const earlierIds = new Set(earlierBoxes.map((box) => box.id));
  const taken = new Set([...earlierIds, ...draftComponents.flatMap((component) => idOf(component) ?? [])]);
  for (const component of draftComponents) {
    const id = idOf(component);
    if (id === undefined || rename.has(id)) continue;
    if (!earlierIds.has(id)) rename.set(id, id);
    else {
      const next = fresh(id, taken);
      taken.add(next);
      rename.set(id, next);
    }
  }
  const mapId = (id: unknown): unknown => (typeof id === "string" ? (rename.get(id) ?? id) : id);
  const matchedEarlier = new Set([...rename.entries()].filter(([from, to]) => from !== to || earlierIds.has(to)).map(([, to]) => to));

  const earlierArrows = new Map<string, string[]>();
  for (const arrow of objects(before["connections"])) {
    const id = idOf(arrow);
    if (id === undefined) continue;
    const key = `${arrow["from"]}\0${arrow["to"]}`;
    earlierArrows.set(key, [...(earlierArrows.get(key) ?? []), id]);
  }
  const usedArrows = new Set<string>();
  const arrowIds = new Set([...[...earlierArrows.values()].flat(), ...objects(draft["connections"]).flatMap((arrow) => idOf(arrow) ?? [])]);
  const connections = Array.isArray(draft["connections"])
    ? draft["connections"].map((arrow: unknown) => {
        if (!isJsonObject(arrow)) return arrow;
        const from = mapId(arrow["from"]);
        const to = mapId(arrow["to"]);
        const next: JsonObject = { ...arrow, from, to };
        if (matchedEarlier.has(from as string) && matchedEarlier.has(to as string)) {
          const id = (earlierArrows.get(`${from}\0${to}`) ?? []).find((candidate) => !usedArrows.has(candidate));
          if (id !== undefined) {
            usedArrows.add(id);
            next["id"] = id;
            return next;
          }
        }
        // An arrow that keeps an earlier arrow's id without matching it is a new arrow.
        const own = idOf(arrow);
        if (own !== undefined && earlierArrows.size > 0 && [...earlierArrows.values()].some((ids) => ids.includes(own))) {
          next["id"] = fresh(own, arrowIds);
          arrowIds.add(next["id"] as string);
        }
        return next;
      })
    : draft["connections"];
  return {
    ...draft,
    components: (draft["components"] as unknown[]).map((component) => (isJsonObject(component) && idOf(component) !== undefined ? { ...component, id: mapId(component["id"]) } : component)),
    ...(connections === undefined ? {} : { connections }),
    ...(Array.isArray(draft["boundaries"]) ? { boundaries: draft["boundaries"].map((boundary: unknown) => (isJsonObject(boundary) && Array.isArray(boundary["wraps"]) ? { ...boundary, wraps: boundary["wraps"].map(mapId) } : boundary)) } : {}),
  };
}
