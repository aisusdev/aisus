// Architecture maps in JSON v1: the subset aisus reads (FR-MOD-01).
//
// Documents are handled as plain parsed JSON values typed with these interfaces. Nothing
// re-serialises through a field list, so fields not modelled here (`cards`, `legend`,
// `translations`, ...) survive any rewrite unchanged. Browser-safe: no imports.

export type ComponentType = "frontend" | "backend" | "database" | "cloud" | "security" | "messagebus" | "external";
export type Variant = "default" | "emphasis" | "security" | "dashed";
export type BoundaryKind = "region" | "security-group";
/** `[x, y]` */
export type Point = [number, number];

export interface Repository {
  url: string;
  revision: string;
  provider?: "github" | "gitee";
  link_mode?: "web" | "local-only";
}

export interface Meta {
  title: string;
  output: string;
  subtitle?: string;
  locale?: string;
  quality_profile?: "standard" | "showcase";
  repository?: Repository;
}

export interface GridLayout {
  mode: "grid";
  origin?: Point;
  cols?: number;
  gapX?: number;
  gapY?: number;
  cellW?: number;
  cellH?: number;
}

export interface SourceRef {
  path: string;
  line?: number;
  end_line?: number;
  label?: string;
}

export interface Component {
  id: string;
  type: ComponentType;
  label: string;
  sublabel?: string;
  tag?: string;
  sources?: SourceRef[];
  row?: number;
  col?: number;
  pos?: Point;
  /** `[width, height]` */
  size?: [number, number];
}

export interface Connection {
  id?: string;
  from: string;
  to: string;
  label?: string;
  variant?: Variant;
}

export interface Boundary {
  kind: BoundaryKind;
  label: string;
  wraps: string[];
}

export interface ArchitectureDoc {
  schema_version: 1;
  diagram_type: "architecture";
  meta: Meta;
  layout?: GridLayout;
  components: Component[];
  connections?: Connection[];
  boundaries?: Boundary[];
}

export type MessageVariant = Variant | "return";

/** SEQ-01: the code that takes part in a flow. */
export interface Participant {
  id: string;
  type: ComponentType;
  label: string;
  sublabel?: string;
  sources?: SourceRef[];
}

/** SEQ-01: one call between participants, in the order the flow makes it. */
export interface Message {
  id: string;
  from: string;
  to: string;
  label: string;
  variant?: MessageVariant;
  note?: string;
  sources?: SourceRef[];
}

/** SEQ-01: a band over the messages from `first` to `last`, by id. */
export interface Phase {
  label: string;
  first: string;
  last: string;
}

/** SEQ-01: a sequence map of one flow (ADR 0069). */
export interface SequenceDoc {
  schema_version: 1;
  diagram_type: "sequence";
  meta: Meta;
  participants: Participant[];
  messages: Message[];
  phases?: Phase[];
}

/** Either kind of map the validator accepts. */
export type MapDoc = ArchitectureDoc | SequenceDoc;

/** Categories of validator findings; the validator prefixes each message with its code. */
export type IssueCode =
  | "Json"
  | "Schema"
  | "DuplicateId"
  | "UnknownReference"
  | "MissingSources"
  | "BoundaryOverlap"
  /** SEQ-01: a phase out of order or overlapping another. */
  | "PhaseOrder"
  | "InvalidCitationPath"
  | "DeniedCitation"
  | "BrokenCitation"
  | "SecretLike"
  /** ACC-05: a box or arrow the audit has no entry for. */
  | "MissingEntry";

/** One finding, located by the RFC 6901 JSON pointer of the offending instance (`""` = whole document). */
export interface Issue {
  code: IssueCode;
  pointer: string;
  message: string;
}

/** A JSON object value, as produced by `JSON.parse`. */
export type JsonObject = Record<string, unknown>;

export function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Escapes one RFC 6901 reference token. */
export function pointerToken(token: string): string {
  return token.replace(/~/g, "~0").replace(/\//g, "~1");
}

/** The on-disk form aisus writes: 2-space indented JSON with a trailing newline. */
export function stringifyDocument(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}
