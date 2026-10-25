// UI-01: the sidebar's maps list, from each candidate and its run record.
import { readFileSync } from "node:fs";
import { dirname } from "node:path";
import { listCandidates } from "./discovery";
import type { MapKind } from "./runFolder";
import type { MapItem } from "./messages";
import { readRunRecord } from "./runRecord";
import { parseDiagram } from "./tolerant";

/**
 * Every candidate of `kind` in `root`, newest first, described for the maps list. A sequence
 * map's `boxes` counts its participants (SEQ-04).
 */
export function listMaps(root: string, kind: MapKind = "architecture"): MapItem[] {
  return listCandidates(root, kind).map((candidate) => {
    const record = readRunRecord(dirname(candidate.file));
    let title: string | null = null;
    let boxes: number | null = null;
    try {
      const result = parseDiagram(readFileSync(candidate.file, "utf8"));
      if (result.ok) {
        title = result.diagram.title ?? null;
        boxes = result.diagram.sequence?.participants.length ?? result.diagram.components.length;
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
    };
  });
}
