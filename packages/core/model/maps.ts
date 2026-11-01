// UI-01: the sidebar's maps list, from each candidate and its run record. VWR-07 arranges it as a tree.
import { readFileSync } from "node:fs";
import { dirname } from "node:path";
import { listCandidates } from "./discovery";
import { parseRunFolderName, type MapKind } from "./runFolder";
import type { MapItem, MapNode } from "./messages";
import { readRunRecord } from "./runRecord";
import { parseDiagram } from "./tolerant";

/**
 * Every candidate of `kind` in `root`, newest first, described for the maps list. A sequence
 * map's `boxes` counts its participants (SEQ-04). A drill-down carries its parent and box, and
 * the box's label when the parent map is listed (VWR-07).
 */
export function listMaps(root: string, kind: MapKind = "architecture"): MapItem[] {
  const labels = new Map<string, Map<string, string>>();
  const items = listCandidates(root, kind).map((candidate): MapItem => {
    const record = readRunRecord(dirname(candidate.file));
    let title: string | null = null;
    let boxes: number | null = null;
    try {
      const result = parseDiagram(readFileSync(candidate.file, "utf8"));
      if (result.ok) {
        title = result.diagram.title ?? null;
        boxes = result.diagram.sequence?.participants.length ?? result.diagram.components.length;
        labels.set(candidate.runFolder, new Map(result.diagram.components.map((component) => [component.id, component.label])));
      }
    } catch {
      // Unreadable: listed by folder name only.
    }
    return {
      runFolder: candidate.runFolder,
      file: candidate.file,
      title,
      focus: record?.focus ?? "",
      agent: record?.agent ?? null,
      createdAt: record?.createdAt ?? new Date(candidate.mtimeMs).toISOString(),
      boxes,
      changed: null,
      ...(record?.kind === "drill" && typeof record.parent === "string" ? { parent: record.parent } : {}),
      ...(record?.kind === "drill" && typeof record.parentBox === "string" ? { parentBox: record.parentBox } : {}),
    };
  });
  for (const item of items) {
    const label = item.parent === undefined || item.parentBox === undefined ? undefined : labels.get(item.parent)?.get(item.parentBox);
    if (label !== undefined) item.detailOf = label;
  }
  return items;
}

/**
 * VWR-07: `items`, newest first, as the Maps page's tree. A top-level node is the newest map of
 * its focus slug, and the older ones are its `earlier`. A drill-down sits under the node holding
 * a map with its parent's focus slug, as VWR-05's `detailMaps` finds detail maps. Its node is the
 * newest drill-down of that box. A drill-down whose parent map is gone is a top-level node.
 */
export function mapTree(items: readonly MapItem[]): MapNode[] {
  const slug = (run: string): string => parseRunFolderName(run)?.slug ?? run;
  const groups = new Map<string, MapNode>();
  const wanted = new Map<MapNode, string>();
  for (const item of items) {
    const key = item.parent === undefined ? slug(item.runFolder) : `${slug(item.parent)}/${item.parentBox ?? item.runFolder}`;
    const node = groups.get(key);
    if (node !== undefined) {
      node.earlier.push(item);
      continue;
    }
    const created: MapNode = { item, earlier: [], children: [] };
    groups.set(key, created);
    if (item.parent !== undefined) wanted.set(created, slug(item.parent));
  }
  const bySlug = new Map<string, MapNode>();
  for (const node of groups.values()) {
    for (const item of [node.item, ...node.earlier]) if (!bySlug.has(slug(item.runFolder))) bySlug.set(slug(item.runFolder), node);
  }
  // A node never sits under itself or under its own detail maps.
  const parentOf = new Map<MapNode, MapNode>();
  for (const [node, parentSlug] of wanted) {
    const parent = bySlug.get(parentSlug);
    let up = parent;
    while (up !== undefined && up !== node) up = parentOf.get(up);
    if (parent !== undefined && up === undefined) parentOf.set(node, parent);
  }
  const roots: MapNode[] = [];
  for (const node of groups.values()) {
    const parent = parentOf.get(node);
    if (parent === undefined) roots.push(node);
    else parent.children.push(node);
  }
  return roots;
}
