// Tolerant reading of Archify documents for the viewer (FR-VIEW-03, ADR 0012). No schema
// validation: whatever can be drawn is kept, the rest is skipped. Browser-safe: no imports
// besides types.
import type { BoundaryKind, ComponentType, GridLayout, MessageVariant, Point, SourceRef, Variant } from "./types";

const COMPONENT_TYPES: readonly ComponentType[] = ["frontend", "backend", "database", "cloud", "security", "messagebus", "external"];
const VARIANTS: readonly Variant[] = ["default", "emphasis", "security", "dashed"];
const MESSAGE_VARIANTS: readonly MessageVariant[] = [...VARIANTS, "return"];

export interface ViewComponent {
  id: string;
  label: string;
  sublabel?: string;
  tag?: string;
  /** Unknown or missing types become `external`. */
  type: ComponentType;
  /** Entries with a string `path`, in document order; `index` in `openSource` refers to this list. */
  sources: SourceRef[];
  pos?: Point;
  size?: [number, number];
  row?: number;
  col?: number;
}

export interface ViewConnection {
  from: string;
  to: string;
  label?: string;
  variant: Variant;
}

export interface ViewBoundary {
  kind: BoundaryKind;
  label: string;
  /** Resolved member IDs, first occurrence order, without duplicates. */
  wraps: string[];
}

export interface ViewParticipant {
  id: string;
  label: string;
  sublabel?: string;
  type: ComponentType;
  sources: SourceRef[];
}

export interface ViewMessage {
  id: string;
  /** Indices into `ViewSequence.participants`. */
  from: number;
  to: number;
  label: string;
  variant: MessageVariant;
  note?: string;
  sources: SourceRef[];
}

export interface ViewPhase {
  label: string;
  /** Indices into `ViewSequence.messages`, `first <= last`. */
  first: number;
  last: number;
}

/** SEQ-03: what the viewer draws of a sequence map. */
export interface ViewSequence {
  participants: ViewParticipant[];
  messages: ViewMessage[];
  phases: ViewPhase[];
}

export interface ViewDiagram {
  title?: string;
  /**
   * SEQ-03: set for a sequence map, whose `components` are then its participants followed by its
   * messages, so that clicks, freshness and citations find either by id. It has no connections or boundaries.
   */
  sequence?: ViewSequence;
  /** Root `layout`, only when `mode` is `"grid"`. */
  grid?: GridLayout;
  components: ViewComponent[];
  connections: ViewConnection[];
  boundaries: ViewBoundary[];
}

export type TolerantResult =
  | { ok: true; diagram: ViewDiagram; /** What was dropped, as `<pointer>: <reason>` (for tests and logs). */ skipped: string[] }
  | { ok: false; reason: string };

type Obj = Record<string, unknown>;

function isObj(value: unknown): value is Obj {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function str(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function num(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function pair(value: unknown): [number, number] | undefined {
  if (!Array.isArray(value) || value.length !== 2) return undefined;
  const [a, b] = [num(value[0]), num(value[1])];
  return a === undefined || b === undefined ? undefined : [a, b];
}

function readSources(value: unknown, pointer: string, skipped: string[]): SourceRef[] {
  if (!Array.isArray(value)) return [];
  const sources: SourceRef[] = [];
  value.forEach((entry, k) => {
    const path = isObj(entry) ? str(entry["path"]) : undefined;
    if (!isObj(entry) || path === undefined) {
      skipped.push(`${pointer}/sources/${k}: no string path`);
      return;
    }
    const source: SourceRef = { path };
    const line = num(entry["line"]);
    const end = num(entry["end_line"]);
    const label = str(entry["label"]);
    if (line !== undefined) source.line = line;
    if (end !== undefined) source.end_line = end;
    if (label !== undefined) source.label = label;
    sources.push(source);
  });
  return sources;
}

function readGrid(value: unknown): GridLayout | undefined {
  if (!isObj(value) || value["mode"] !== "grid") return undefined;
  const grid: GridLayout = { mode: "grid" };
  const origin = pair(value["origin"]);
  if (origin) grid.origin = origin;
  for (const key of ["cols", "gapX", "gapY", "cellW", "cellH"] as const) {
    const n = num(value[key]);
    if (n !== undefined) grid[key] = n;
  }
  return grid;
}

/**
 * SEQ-03: a sequence map's participants with a string id (the first of each id), the messages
 * whose ends resolve, given `message-<n>` when their id is missing or taken, and the phases whose
 * messages resolve in order.
 */
function readSequence(value: Obj): TolerantResult {
  const skipped: string[] = [];
  const participants: ViewParticipant[] = [];
  const index = new Map<string, number>();
  const rawParticipants = Array.isArray(value["participants"]) ? value["participants"] : [];
  rawParticipants.forEach((raw, i) => {
    const pointer = `/participants/${i}`;
    const id = isObj(raw) ? str(raw["id"]) : undefined;
    if (!isObj(raw) || id === undefined || index.has(id)) {
      skipped.push(`${pointer}: no string id, or a duplicate`);
      return;
    }
    index.set(id, participants.length);
    const type = str(raw["type"]);
    const participant: ViewParticipant = {
      id,
      label: str(raw["label"]) || id,
      type: COMPONENT_TYPES.includes(type as ComponentType) ? (type as ComponentType) : "external",
      sources: readSources(raw["sources"], pointer, skipped),
    };
    const sublabel = str(raw["sublabel"]);
    if (sublabel) participant.sublabel = sublabel;
    participants.push(participant);
  });
  if (participants.length === 0) return { ok: false, reason: "it has no participants with an id" };
  const ids = new Set(index.keys());
  const messages: ViewMessage[] = [];
  const order = new Map<string, number>();
  const rawMessages = Array.isArray(value["messages"]) ? value["messages"] : [];
  rawMessages.forEach((raw, i) => {
    const pointer = `/messages/${i}`;
    const from = isObj(raw) ? index.get(str(raw["from"]) ?? "") : undefined;
    const to = isObj(raw) ? index.get(str(raw["to"]) ?? "") : undefined;
    if (!isObj(raw) || from === undefined || to === undefined) {
      skipped.push(`${pointer}: from/to do not resolve`);
      return;
    }
    let id = str(raw["id"]);
    if (id === undefined || ids.has(id)) id = `message-${i}`;
    ids.add(id);
    order.set(id, messages.length);
    const variant = str(raw["variant"]);
    const message: ViewMessage = {
      id,
      from,
      to,
      label: str(raw["label"]) ?? "",
      variant: MESSAGE_VARIANTS.includes(variant as MessageVariant) ? (variant as MessageVariant) : "default",
      sources: readSources(raw["sources"], pointer, skipped),
    };
    const note = str(raw["note"]);
    if (note) message.note = note;
    messages.push(message);
  });
  const phases: ViewPhase[] = [];
  const rawPhases = Array.isArray(value["phases"]) ? value["phases"] : [];
  rawPhases.forEach((raw, i) => {
    const first = isObj(raw) ? order.get(str(raw["first"]) ?? "") : undefined;
    const last = isObj(raw) ? order.get(str(raw["last"]) ?? "") : undefined;
    if (!isObj(raw) || first === undefined || last === undefined || first > last) {
      skipped.push(`/phases/${i}: its messages do not resolve in order`);
      return;
    }
    phases.push({ label: str(raw["label"]) ?? "", first, last });
  });
  const components: ViewComponent[] = [
    ...participants.map((participant) => ({ ...participant })),
    ...messages.map((message) => ({
      id: message.id,
      label: message.label || message.id,
      sublabel: `${participants[message.from]!.label} to ${participants[message.to]!.label}`,
      type: "external" as const,
      sources: message.sources,
    })),
  ];
  const diagram: ViewDiagram = { components, connections: [], boundaries: [], sequence: { participants, messages, phases } };
  const meta = value["meta"];
  const title = isObj(meta) ? str(meta["title"]) : undefined;
  if (title) diagram.title = title;
  return { ok: true, diagram, skipped };
}

/** Tolerant read of an already parsed JSON value: an architecture map, or a sequence map (SEQ-03). */
export function readDiagram(value: unknown): TolerantResult {
  if (!isObj(value)) return { ok: false, reason: "the root is not a JSON object" };
  if (value["diagram_type"] === "sequence") return readSequence(value);
  const rawComponents = value["components"];
  if (!Array.isArray(rawComponents) || rawComponents.length === 0) {
    return { ok: false, reason: "it has no components" };
  }
  const skipped: string[] = [];
  const components: ViewComponent[] = [];
  const ids = new Set<string>();
  rawComponents.forEach((raw, i) => {
    const pointer = `/components/${i}`;
    const id = isObj(raw) ? str(raw["id"]) : undefined;
    if (!isObj(raw) || id === undefined) {
      skipped.push(`${pointer}: no string id`);
      return;
    }
    if (ids.has(id)) {
      skipped.push(`${pointer}: duplicate id ${id}`);
      return;
    }
    ids.add(id);
    const type = str(raw["type"]);
    const component: ViewComponent = {
      id,
      label: str(raw["label"]) || id,
      type: COMPONENT_TYPES.includes(type as ComponentType) ? (type as ComponentType) : "external",
      sources: readSources(raw["sources"], pointer, skipped),
    };
    const sublabel = str(raw["sublabel"]);
    const tag = str(raw["tag"]);
    const pos = pair(raw["pos"]);
    const size = pair(raw["size"]);
    const row = num(raw["row"]);
    const col = num(raw["col"]);
    if (sublabel) component.sublabel = sublabel;
    if (tag) component.tag = tag;
    if (pos) component.pos = pos;
    if (size) component.size = size;
    if (row !== undefined) component.row = row;
    if (col !== undefined) component.col = col;
    components.push(component);
  });
  if (components.length === 0) return { ok: false, reason: "it has no components with an id" };

  const connections: ViewConnection[] = [];
  const rawConnections = value["connections"];
  if (Array.isArray(rawConnections)) {
    rawConnections.forEach((raw, i) => {
      const from = isObj(raw) ? str(raw["from"]) : undefined;
      const to = isObj(raw) ? str(raw["to"]) : undefined;
      if (!isObj(raw) || from === undefined || to === undefined || !ids.has(from) || !ids.has(to)) {
        skipped.push(`/connections/${i}: from/to do not resolve`);
        return;
      }
      const variant = str(raw["variant"]);
      const connection: ViewConnection = { from, to, variant: VARIANTS.includes(variant as Variant) ? (variant as Variant) : "default" };
      const label = str(raw["label"]);
      if (label) connection.label = label;
      connections.push(connection);
    });
  }

  const boundaries: ViewBoundary[] = [];
  const rawBoundaries = value["boundaries"];
  if (Array.isArray(rawBoundaries)) {
    rawBoundaries.forEach((raw, i) => {
      const pointer = `/boundaries/${i}`;
      if (!isObj(raw)) {
        skipped.push(`${pointer}: not an object`);
        return;
      }
      const wraps: string[] = [];
      const rawWraps = Array.isArray(raw["wraps"]) ? raw["wraps"] : [];
      rawWraps.forEach((member, j) => {
        if (typeof member === "string" && ids.has(member)) {
          if (!wraps.includes(member)) wraps.push(member);
        } else skipped.push(`${pointer}/wraps/${j}: does not resolve`);
      });
      if (wraps.length === 0) {
        skipped.push(`${pointer}: no members left`);
        return;
      }
      boundaries.push({ kind: raw["kind"] === "security-group" ? "security-group" : "region", label: str(raw["label"]) ?? "", wraps });
    });
  }

  const diagram: ViewDiagram = { components, connections, boundaries };
  const meta = value["meta"];
  const title = isObj(meta) ? str(meta["title"]) : undefined;
  if (title) diagram.title = title;
  const grid = readGrid(value["layout"]);
  if (grid) diagram.grid = grid;
  return { ok: true, diagram, skipped };
}

/** {@link parseDiagram}'s result: a success also carries the parsed `value`, which is what the webview receives. */
export type ParsedFile = (Extract<TolerantResult, { ok: true }> & { value: unknown }) | Extract<TolerantResult, { ok: false }>;

/** Tolerant read of file text: unparseable JSON is a failure with the parser's reason. */
export function parseDiagram(text: string): ParsedFile {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch (error) {
    return { ok: false, reason: `invalid JSON (${(error as Error).message})` };
  }
  const result = readDiagram(value);
  return result.ok ? { ...result, value } : result;
}
