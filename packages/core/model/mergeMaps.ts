// CLD-17: a branch's map merged into the default branch's map. Elements pair as FRS-07 pairs them,
// and `ours` wins every conflict. Browser-safe.
import { diffMaps, pairMaps, type MapDiff } from "./diff";
import type { JsonObject } from "./types";

interface Box {
  id: string;
  label: string;
  sources?: readonly { path: string }[];
  [field: string]: unknown;
}

interface Arrow {
  from: string;
  to: string;
  label?: string;
  variant?: string;
  [field: string]: unknown;
}

interface Boundary {
  label: string;
  kind?: string;
  wraps: string[];
  [field: string]: unknown;
}

interface MapDoc {
  components: Box[];
  connections: Arrow[];
  boundaries?: Boundary[];
}

export interface MergeConflict {
  kind: "box" | "arrow" | "boundary";
  /** A box's or boundary's label, or an arrow named by its two ends. */
  name: string;
  reason: "both-changed" | "changed-and-removed";
}

export interface MergeResult {
  map: JsonObject;
  outcome: "ours" | "theirs" | "merged";
  conflicts: MergeConflict[];
}

const EMPTY: MapDoc = { components: [], connections: [], boundaries: [] };

function asMap(value: unknown): MapDoc {
  const map = value as Partial<MapDoc>;
  return { components: map.components ?? [], connections: map.connections ?? [], boundaries: map.boundaries ?? [] };
}

const unchanged = (diff: MapDiff): boolean => diff.counts.added + diff.counts.removed + diff.counts.changed === 0;

/** A box changed in itself; a move to another boundary is the boundaries' change. */
const boxChanged = (diff: MapDiff, index: number): boolean => diff.boxes[index]!.fields.some((field) => field.field !== "boundary");

/** Two paired boxes are the same when they differ in nothing but their ids. */
const sameBox = (a: Box, b: Box): boolean => unchanged(diffMaps({ components: [a], connections: [] }, { components: [{ ...b, id: a.id }], connections: [] }));

const sameArrow = (a: Arrow, b: Arrow): boolean => (a.label ?? null) === (b.label ?? null) && (a.variant ?? "default") === (b.variant ?? "default");

const sameHead = (a: Boundary, b: Boundary): boolean => a.label === b.label && (a.kind ?? null) === (b.kind ?? null);

const invert = <K, V>(map: ReadonlyMap<K, V>): Map<V, K> => new Map([...map].map(([key, value]) => [value, key]));

function arrowName(arrow: Arrow, boxes: readonly Box[]): string {
  const labelOf = (id: string): string => boxes.find((box) => box.id === id)?.label ?? id;
  return `${labelOf(arrow.from)} → ${labelOf(arrow.to)}${arrow.label ? ` (${arrow.label})` : ""}`;
}

function idsIn(ids: readonly string[], toResult: ReadonlyMap<string, string>): string[] {
  return ids.flatMap((id) => {
    const moved = toResult.get(id);
    return moved === undefined ? [] : [moved];
  });
}

function moveArrow(arrow: Arrow, toResult: ReadonlyMap<string, string>): Arrow | null {
  const from = toResult.get(arrow.from);
  const to = toResult.get(arrow.to);
  return from === undefined || to === undefined ? null : { ...arrow, from, to };
}

/**
 * Merges `theirs` into `ours`, given the `base` both started from. Without `base`, both maps' elements
 * are merged with `ours` winning conflicts.
 */
export function mergeMaps(base: unknown | null, ours: unknown, theirs: unknown): MergeResult {
  const o = asMap(ours);
  const t = asMap(theirs);
  const b = base === null ? EMPTY : asMap(base);
  const oursDiff = diffMaps(b, o);
  const theirsDiff = diffMaps(b, t);
  if (base !== null && unchanged(theirsDiff)) return { map: ours as JsonObject, outcome: "ours", conflicts: [] };
  if (base !== null && unchanged(oursDiff)) return { map: theirs as JsonObject, outcome: "theirs", conflicts: [] };

  const conflicts: MergeConflict[] = [];
  const oursPairs = pairMaps(b, o);
  const theirsPairs = pairMaps(b, t);

  // Boxes. Each kept box remembers the ours and theirs ids it stands for, so arrows and boundaries follow.
  interface Placed {
    box: Box;
    fromTheirs: boolean;
    oursId?: string;
    theirsIds: string[];
  }
  const placed: Placed[] = [];
  const baseOfOurs = invert(oursPairs.boxes);
  const baseOfTheirs = invert(theirsPairs.boxes);
  const theirsBoxIndex = new Map(t.components.map((box, index) => [box.id, index]));
  const handledTheirs = new Set<string>();
  o.components.forEach((box, index) => {
    const baseId = baseOfOurs.get(box.id);
    if (baseId === undefined) {
      placed.push({ box, fromTheirs: false, oursId: box.id, theirsIds: [] });
      return;
    }
    const oursChanged = boxChanged(oursDiff, index);
    const theirsId = theirsPairs.boxes.get(baseId);
    if (theirsId === undefined) {
      if (!oursChanged) return;
      conflicts.push({ kind: "box", name: box.label, reason: "changed-and-removed" });
      placed.push({ box, fromTheirs: false, oursId: box.id, theirsIds: [] });
      return;
    }
    handledTheirs.add(theirsId);
    const theirsIndex = theirsBoxIndex.get(theirsId)!;
    const other = t.components[theirsIndex]!;
    const theirsChanged = boxChanged(theirsDiff, theirsIndex);
    if (theirsChanged && !oursChanged) {
      placed.push({ box: other, fromTheirs: true, oursId: box.id, theirsIds: [theirsId] });
      return;
    }
    if (oursChanged && theirsChanged && !sameBox(box, other)) conflicts.push({ kind: "box", name: box.label, reason: "both-changed" });
    placed.push({ box, fromTheirs: false, oursId: box.id, theirsIds: [theirsId] });
  });
  const theirsAdded: Box[] = [];
  t.components.forEach((box, index) => {
    if (handledTheirs.has(box.id)) return;
    if (!baseOfTheirs.has(box.id)) theirsAdded.push(box);
    else if (boxChanged(theirsDiff, index)) conflicts.push({ kind: "box", name: box.label, reason: "changed-and-removed" });
  });
  // A box both sides added becomes one box, as ours has it.
  const oursAdded = o.components.filter((box) => !baseOfOurs.has(box.id));
  const oursOfAdded = invert(pairMaps({ components: oursAdded, connections: [] }, { components: theirsAdded, connections: [] }).boxes);
  for (const box of theirsAdded) {
    const oursId = oursOfAdded.get(box.id);
    const twin = oursId === undefined ? undefined : placed.find((entry) => entry.oursId === oursId);
    if (twin === undefined) {
      placed.push({ box, fromTheirs: true, theirsIds: [box.id] });
      continue;
    }
    twin.theirsIds.push(box.id);
    if (!sameBox(twin.box, box)) conflicts.push({ kind: "box", name: twin.box.label, reason: "both-changed" });
  }
  // A box taken from theirs keeps its id unless another box already has it.
  const taken = new Set(placed.filter((entry) => !entry.fromTheirs).map((entry) => entry.box.id));
  const freshId = (id: string): string => {
    let candidate = id;
    for (let n = 2; taken.has(candidate); n++) candidate = `${id}-${n}`;
    taken.add(candidate);
    return candidate;
  };
  const components: Box[] = [];
  const oursToResult = new Map<string, string>();
  const theirsToResult = new Map<string, string>();
  for (const entry of placed) {
    const id = entry.fromTheirs ? freshId(entry.box.id) : entry.box.id;
    components.push(id === entry.box.id ? entry.box : { ...entry.box, id });
    if (entry.oursId !== undefined) oursToResult.set(entry.oursId, id);
    for (const theirsId of entry.theirsIds) theirsToResult.set(theirsId, id);
  }

  // Arrows. An arrow whose end is gone is dropped.
  const connections: Arrow[] = [];
  const oursAddedArrows: Arrow[] = [];
  const theirsOfBaseArrow = invert(theirsPairs.arrows);
  const handledTheirsArrows = new Set<number>();
  o.connections.forEach((arrow, index) => {
    const baseIndex = oursPairs.arrows.get(index);
    const mine = moveArrow(arrow, oursToResult);
    if (baseIndex === undefined) {
      if (mine === null) return;
      connections.push(mine);
      oursAddedArrows.push(mine);
      return;
    }
    const oursChanged = oursDiff.arrows[index]!.status === "changed";
    const theirsIndex = theirsOfBaseArrow.get(baseIndex);
    if (theirsIndex === undefined) {
      if (!oursChanged) return;
      conflicts.push({ kind: "arrow", name: arrowName(arrow, o.components), reason: "changed-and-removed" });
      if (mine !== null) connections.push(mine);
      return;
    }
    handledTheirsArrows.add(theirsIndex);
    const other = t.connections[theirsIndex]!;
    const theirsChanged = theirsDiff.arrows[theirsIndex]!.status === "changed";
    if (oursChanged && theirsChanged && !sameArrow(arrow, other)) conflicts.push({ kind: "arrow", name: arrowName(arrow, o.components), reason: "both-changed" });
    const winner = theirsChanged && !oursChanged ? moveArrow(other, theirsToResult) : mine;
    if (winner !== null) connections.push(winner);
  });
  const theirsAddedArrows: Arrow[] = [];
  t.connections.forEach((arrow, index) => {
    if (handledTheirsArrows.has(index)) return;
    if (theirsPairs.arrows.has(index)) {
      if (theirsDiff.arrows[index]!.status === "changed") conflicts.push({ kind: "arrow", name: arrowName(arrow, t.components), reason: "changed-and-removed" });
      return;
    }
    const moved = moveArrow(arrow, theirsToResult);
    if (moved !== null) theirsAddedArrows.push(moved);
  });
  // An arrow both sides added between the same two boxes becomes one arrow, as ours has it.
  const arrowTwins = pairMaps({ components, connections: oursAddedArrows }, { components, connections: theirsAddedArrows }).arrows;
  theirsAddedArrows.forEach((arrow, index) => {
    const twin = arrowTwins.get(index);
    if (twin === undefined) connections.push(arrow);
    else if (!sameArrow(oursAddedArrows[twin]!, arrow)) conflicts.push({ kind: "arrow", name: arrowName(oursAddedArrows[twin]!, components), reason: "both-changed" });
  });

  // Boundaries. Label and kind merge as one change, and members merge one by one.
  const baseToResult = new Map<string, string>();
  for (const box of b.components) {
    const id = oursToResult.get(oursPairs.boxes.get(box.id) ?? "") ?? theirsToResult.get(theirsPairs.boxes.get(box.id) ?? "");
    if (id !== undefined) baseToResult.set(box.id, id);
  }
  const oursBoundaries = o.boundaries ?? [];
  const theirsBoundaries = t.boundaries ?? [];
  const baseBoundaries = b.boundaries ?? [];
  const theirsBoxes = new Set(theirsToResult.values());
  const kept: { boundary: Boundary; hadMembers: boolean }[] = [];
  const oursAddedBoundaries: { boundary: Boundary; hadMembers: boolean }[] = [];
  const theirsOfBaseBoundary = invert(theirsPairs.boundaries);
  const handledTheirsBoundaries = new Set<number>();
  oursBoundaries.forEach((boundary, index) => {
    const baseIndex = oursPairs.boundaries.get(index);
    const mine = { boundary: { ...boundary, wraps: idsIn(boundary.wraps, oursToResult) }, hadMembers: boundary.wraps.length > 0 };
    if (baseIndex === undefined) {
      kept.push(mine);
      oursAddedBoundaries.push(mine);
      return;
    }
    const oursChanged = oursDiff.boundaries[index]!.status !== "unchanged";
    const theirsIndex = theirsOfBaseBoundary.get(baseIndex);
    if (theirsIndex === undefined) {
      if (!oursChanged) return;
      conflicts.push({ kind: "boundary", name: boundary.label, reason: "changed-and-removed" });
      kept.push(mine);
      return;
    }
    handledTheirsBoundaries.add(theirsIndex);
    const other = theirsBoundaries[theirsIndex]!;
    const old = baseBoundaries[baseIndex]!;
    const oursHead = !sameHead(boundary, old);
    const theirsHead = !sameHead(other, old);
    if (oursHead && theirsHead && !sameHead(boundary, other)) conflicts.push({ kind: "boundary", name: boundary.label, reason: "both-changed" });
    const mineIds = mine.boundary.wraps;
    const theirIds = idsIn(other.wraps, theirsToResult);
    const baseIds = idsIn(old.wraps, baseToResult);
    // A box ours kept after theirs removed it stays where ours has it.
    const wraps = [
      ...mineIds.filter((id) => !baseIds.includes(id) || theirIds.includes(id) || !theirsBoxes.has(id)),
      ...theirIds.filter((id) => !baseIds.includes(id) && !mineIds.includes(id)),
    ];
    const head = theirsHead && !oursHead ? other : boundary;
    kept.push({ boundary: { ...head, wraps }, hadMembers: boundary.wraps.length > 0 || other.wraps.length > 0 });
  });
  const theirsAddedBoundaries: { boundary: Boundary; hadMembers: boolean }[] = [];
  theirsBoundaries.forEach((boundary, index) => {
    if (handledTheirsBoundaries.has(index)) return;
    if (theirsPairs.boundaries.has(index)) {
      if (theirsDiff.boundaries[index]!.status !== "unchanged") conflicts.push({ kind: "boundary", name: boundary.label, reason: "changed-and-removed" });
      return;
    }
    theirsAddedBoundaries.push({ boundary: { ...boundary, wraps: idsIn(boundary.wraps, theirsToResult) }, hadMembers: boundary.wraps.length > 0 });
  });
  // A boundary both sides added becomes one boundary, as ours has it, holding both sides' members.
  const boundaryTwins = pairMaps(
    { components, connections: [], boundaries: oursAddedBoundaries.map((entry) => entry.boundary) },
    { components, connections: [], boundaries: theirsAddedBoundaries.map((entry) => entry.boundary) },
  ).boundaries;
  theirsAddedBoundaries.forEach((entry, index) => {
    const twinIndex = boundaryTwins.get(index);
    if (twinIndex === undefined) {
      kept.push(entry);
      return;
    }
    const twin = oursAddedBoundaries[twinIndex]!;
    if (!sameHead(twin.boundary, entry.boundary)) conflicts.push({ kind: "boundary", name: twin.boundary.label, reason: "both-changed" });
    twin.boundary.wraps = [...twin.boundary.wraps, ...entry.boundary.wraps.filter((id) => !twin.boundary.wraps.includes(id))];
    twin.hadMembers ||= entry.hadMembers;
  });
  // A boundary whose members are all gone is dropped.
  const boundaries = kept.filter((entry) => entry.boundary.wraps.length > 0 || !entry.hadMembers).map((entry) => entry.boundary);

  const map: JsonObject = { ...(ours as JsonObject), components, connections };
  if (boundaries.length > 0 || (ours as JsonObject).boundaries !== undefined) map.boundaries = boundaries;
  return { map, outcome: "merged", conflicts };
}
