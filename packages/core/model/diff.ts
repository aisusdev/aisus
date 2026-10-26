// FRS-07, FRS-10: what changed between two maps, element by element. Boxes match by id, or, when an
// id changed, by citing mostly the same files. Arrows match by their two ends after that, and
// boundaries by label, with a relabelled boundary matched by its members. Browser-safe.

interface Box {
  id: string;
  label: string;
  sublabel?: string;
  tag?: string;
  type?: string;
  sources?: readonly { path: string }[];
}

interface Arrow {
  from: string;
  to: string;
  label?: string;
  variant?: string;
}

interface Boundary {
  kind?: string;
  label: string;
  wraps: readonly string[];
}

interface MapLike {
  components: readonly Box[];
  connections: readonly Arrow[];
  boundaries?: readonly Boundary[];
}

/** `kept` marks a box whose cited code changed but which the update left as it was. */
export type ElementStatus = "added" | "changed" | "renamed" | "kept" | "unchanged";

export type FieldChange = { field: "id" | "label" | "sublabel" | "tag" | "type" | "variant" | "kind"; before: string | null; after: string | null } | { field: "sources" | "boundary" | "members" };

export interface ElementDiff {
  status: ElementStatus;
  /** The fields that changed, in a fixed order; empty unless changed or renamed. */
  fields: FieldChange[];
}

export interface MapDiff {
  /** Aligned with the newer map's components, connections and boundaries. */
  boxes: ElementDiff[];
  arrows: ElementDiff[];
  boundaries: ElementDiff[];
  /** The older map's elements that are gone, named as the older map names them. */
  removed: { boxes: { id: string; label: string }[]; arrows: { name: string }[]; boundaries: { label: string }[] };
  /** A renamed boundary counts as changed, and a kept box does not count. */
  counts: { added: number; removed: number; changed: number };
}

/** At least half of the two boxes' cited files in common. */
const SAME_FILES = 0.5;

const UNCHANGED: ElementDiff = { status: "unchanged", fields: [] };
const ADDED: ElementDiff = { status: "added", fields: [] };

const files = (box: Box): Set<string> => new Set((box.sources ?? []).map((source) => source.path));

function overlap(a: Box, b: Box): number {
  const left = files(a);
  const right = files(b);
  const shared = [...left].filter((path) => right.has(path)).length;
  const union = new Set([...left, ...right]).size;
  return union === 0 ? 0 : shared / union;
}

function sameSet(a: ReadonlySet<string>, b: ReadonlySet<string>): boolean {
  return a.size === b.size && [...a].every((item) => b.has(item));
}

function text(fields: FieldChange[], field: "id" | "label" | "sublabel" | "tag" | "type" | "variant" | "kind", before: string | undefined, after: string | undefined): void {
  if ((before ?? null) !== (after ?? null)) fields.push({ field, before: before ?? null, after: after ?? null });
}

const changedOrNot = (fields: FieldChange[]): ElementDiff => (fields.length === 0 ? UNCHANGED : { status: "changed", fields });

/** Keys in document order; a repeated key gets `#2`, `#3` after the first. */
function uniqueKeys<T>(items: readonly T[], keyOf: (item: T) => string): string[] {
  const seen = new Map<string, number>();
  return items.map((item) => {
    const key = keyOf(item);
    const n = (seen.get(key) ?? 0) + 1;
    seen.set(key, n);
    return n === 1 ? key : `${key}#${n}`;
  });
}

export interface MapPairing {
  /** Older box id to the newer box id it pairs with. */
  boxes: Map<string, string>;
  /** Newer arrow index to the older arrow index it pairs with. */
  arrows: Map<number, number>;
  /** Newer boundary index to the older boundary index it pairs with. */
  boundaries: Map<number, number>;
  /** The newer boundaries paired by their members rather than their label. */
  relabelled: Set<number>;
}

/** Which elements of `after` are the same elements as in `before`. */
export function pairMaps(before: MapLike, after: MapLike): MapPairing {
  // Older id to newer id: the same id, or a box citing mostly the same files.
  const newIds = new Set(after.components.map((box) => box.id));
  const oldIds = new Set(before.components.map((box) => box.id));
  const renamed = new Map<string, string>();
  for (const box of before.components) if (newIds.has(box.id)) renamed.set(box.id, box.id);
  const unmatchedNew = after.components.filter((box) => !oldIds.has(box.id));
  for (const box of before.components.filter((entry) => !newIds.has(entry.id))) {
    let best: { id: string; score: number } | null = null;
    for (const candidate of unmatchedNew) {
      const score = overlap(box, candidate);
      if (score >= SAME_FILES && (best === null || score > best.score) && ![...renamed.values()].includes(candidate.id)) best = { id: candidate.id, score };
    }
    if (best !== null) renamed.set(box.id, best.id);
  }

  const beforeBoundaries = before.boundaries ?? [];
  const afterBoundaries = after.boundaries ?? [];
  const mapIds = (ids: readonly string[]): Set<string> => new Set(ids.map((id) => renamed.get(id) ?? `\0${id}`));
  const beforeKeys = uniqueKeys(beforeBoundaries, (boundary) => boundary.label);
  const afterKeys = uniqueKeys(afterBoundaries, (boundary) => boundary.label);
  const beforeIndex = new Map(beforeKeys.map((key, index) => [key, index]));
  const pairedBefore = new Map<number, number>();
  const usedBefore = new Set<number>();
  afterKeys.forEach((key, index) => {
    const match = beforeIndex.get(key);
    if (match !== undefined) {
      pairedBefore.set(index, match);
      usedBefore.add(match);
    }
  });
  const relabelled = new Set<number>();
  afterBoundaries.forEach((boundary, index) => {
    if (pairedBefore.has(index)) return;
    const members = new Set(boundary.wraps);
    const match = beforeBoundaries.findIndex((old, k) => !usedBefore.has(k) && sameSet(mapIds(old.wraps), members));
    if (match < 0) return;
    pairedBefore.set(index, match);
    usedBefore.add(match);
    relabelled.add(index);
  });

  const end = (id: string): string => renamed.get(id) ?? `\0${id}`;
  const beforeArrowKeys = uniqueKeys(before.connections, (arrow) => `${end(arrow.from)}\0${end(arrow.to)}`);
  const beforeArrowIndex = new Map(beforeArrowKeys.map((key, index) => [key, index]));
  const arrows = new Map<number, number>();
  uniqueKeys(after.connections, (arrow) => `${arrow.from}\0${arrow.to}`).forEach((key, index) => {
    const match = beforeArrowIndex.get(key);
    if (match !== undefined) arrows.set(index, match);
  });
  return { boxes: renamed, arrows, boundaries: pairedBefore, relabelled };
}

/**
 * How `after` differs from `before`. `touched` holds the older map's ids of boxes whose cited code
 * changed (FRS-08); an unchanged box among them is marked kept.
 */
export function diffMaps(before: MapLike, after: MapLike, touched: ReadonlySet<string> = new Set()): MapDiff {
  const { boxes: renamed, arrows: pairedArrows, boundaries: pairedBefore, relabelled } = pairMaps(before, after);
  const olderOf = new Map([...renamed].map(([older, newer]) => [newer, older]));
  const olderBox = new Map(before.components.map((box) => [box.id, box]));

  // Boundaries first: their matching decides each box's boundary set.
  const beforeBoundaries = before.boundaries ?? [];
  const afterBoundaries = after.boundaries ?? [];
  const mapIds = (ids: readonly string[]): Set<string> => new Set(ids.map((id) => renamed.get(id) ?? `\0${id}`));
  const beforeKeys = uniqueKeys(beforeBoundaries, (boundary) => boundary.label);
  const afterKeys = uniqueKeys(afterBoundaries, (boundary) => boundary.label);
  const usedBefore = new Set(pairedBefore.values());
  const boundaries = afterBoundaries.map((boundary, index): ElementDiff => {
    const match = pairedBefore.get(index);
    if (match === undefined) return ADDED;
    const old = beforeBoundaries[match]!;
    const fields: FieldChange[] = [];
    if (relabelled.has(index)) text(fields, "label", old.label, boundary.label);
    text(fields, "kind", old.kind, boundary.kind);
    if (!sameSet(mapIds(old.wraps), new Set(boundary.wraps))) fields.push({ field: "members" });
    return relabelled.has(index) ? { status: "renamed", fields } : changedOrNot(fields);
  });
  const afterKeyOf = new Map([...pairedBefore].map(([index, match]) => [beforeKeys[match]!, afterKeys[index]!]));
  const boundariesOf = (list: readonly Boundary[], keys: readonly string[], rename: (key: string) => string, id: string): Set<string> =>
    new Set(list.flatMap((boundary, index) => (boundary.wraps.includes(id) ? [rename(keys[index]!)] : [])));

  const keptIds = new Set([...touched].map((id) => renamed.get(id) ?? id));
  const boxes = after.components.map((box): ElementDiff => {
    const older = olderOf.get(box.id);
    const old = older === undefined ? undefined : olderBox.get(older);
    if (old === undefined) return ADDED;
    const fields: FieldChange[] = [];
    text(fields, "id", old.id, box.id);
    text(fields, "label", old.label, box.label);
    text(fields, "sublabel", old.sublabel, box.sublabel);
    text(fields, "tag", old.tag, box.tag);
    text(fields, "type", old.type, box.type);
    if (!sameSet(files(old), files(box))) fields.push({ field: "sources" });
    const was = boundariesOf(beforeBoundaries, beforeKeys, (key) => afterKeyOf.get(key) ?? `\0${key}`, old.id);
    if (!sameSet(was, boundariesOf(afterBoundaries, afterKeys, (key) => key, box.id))) fields.push({ field: "boundary" });
    if (fields.length === 0 && keptIds.has(box.id)) return { status: "kept", fields };
    return changedOrNot(fields);
  });

  const matchedArrows = new Set(pairedArrows.values());
  const arrows = after.connections.map((arrow, index): ElementDiff => {
    const match = pairedArrows.get(index);
    if (match === undefined) return ADDED;
    const old = before.connections[match]!;
    const fields: FieldChange[] = [];
    text(fields, "label", old.label, arrow.label);
    text(fields, "variant", old.variant ?? "default", arrow.variant ?? "default");
    return changedOrNot(fields);
  });

  const labelOf = (id: string): string => olderBox.get(id)?.label ?? id;
  const removed = {
    boxes: before.components.filter((box) => !renamed.has(box.id)).map((box) => ({ id: box.id, label: box.label })),
    arrows: before.connections.filter((_, index) => !matchedArrows.has(index)).map((arrow) => ({ name: `${labelOf(arrow.from)} → ${labelOf(arrow.to)}${arrow.label ? ` (${arrow.label})` : ""}` })),
    boundaries: beforeBoundaries.filter((_, index) => !usedBefore.has(index)).map((boundary) => ({ label: boundary.label })),
  };
  const all = [...boxes, ...arrows, ...boundaries];
  return {
    boxes,
    arrows,
    boundaries,
    removed,
    counts: {
      added: all.filter((entry) => entry.status === "added").length,
      removed: removed.boxes.length + removed.arrows.length + removed.boundaries.length,
      changed: all.filter((entry) => entry.status === "changed" || entry.status === "renamed").length,
    },
  };
}

/** "2 added · 1 removed · 3 changed". */
export function diffSummary(diff: MapDiff): string {
  return `${diff.counts.added} added · ${diff.counts.removed} removed · ${diff.counts.changed} changed`;
}
