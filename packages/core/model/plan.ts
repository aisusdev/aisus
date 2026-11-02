// PLN-01: a plan map is an architecture map of how a spec will leave the code. A box tagged `new`
// stands for code the spec adds and may cite the spec, saved as `spec.md` in its own run folder.
// A box tagged `changed` or `removed` cites the existing code the spec edits or deletes.
import type { Evidence } from "./evidence";
import { MAP_DIR } from "./runFolder";
import { secretKind } from "./secrets";
import type { ArchitectureDoc, Issue } from "./types";

export const SPEC_FILE = "spec.md";
/** Largest spec a plan keeps: 200 KB. */
export const MAX_SPEC_BYTES = 200 * 1024;

/** The repository-relative path of the spec of plan run `run`. */
export function specPath(run: string): string {
  return `${MAP_DIR}/${run}/${SPEC_FILE}`;
}

/** What is wrong with the spec's bytes, or nothing. `null` means the file is missing. */
export function specIssues(bytes: Uint8Array | null): Issue[] {
  const issue = (code: Issue["code"], message: string): Issue[] => [{ code, pointer: "", message }];
  if (bytes === null) return issue("SpecMissing", `${SPEC_FILE} is missing from the run folder. Write the spec there and run the validator again.`);
  if (bytes.length > MAX_SPEC_BYTES) return issue("SpecTooLarge", `${SPEC_FILE} has ${bytes.length} bytes; the limit is ${MAX_SPEC_BYTES}. Keep only the spec's requirements.`);
  const text = Buffer.from(bytes).toString("utf8");
  if (text.trim() === "") return issue("SpecEmpty", `${SPEC_FILE} is empty. Write the spec there and run the validator again.`);
  const kind = secretKind(text);
  return kind === null ? [] : issue("SecretLike", `${SPEC_FILE} looks like it holds a secret (${kind}). Remove it from the spec.`);
}

/** Only a box tagged `new` may cite the plan's spec at `spec`. */
export function specCitationIssues(doc: ArchitectureDoc, spec: string): Issue[] {
  const issues: Issue[] = [];
  doc.components.forEach((component, i) => {
    (component.sources ?? []).forEach((source, k) => {
      if (source.path === spec && component.tag !== "new") {
        issues.push({ code: "SpecCitation", pointer: `/components/${i}/sources/${k}/path`, message: `Only a box tagged \`new\` may cite ${SPEC_FILE}; \`${component.id}\` cites existing code instead` });
      }
    });
  });
  return issues;
}

export interface PlanCounts {
  new: number;
  changed: number;
  removed: number;
}

export function planCounts(doc: ArchitectureDoc): PlanCounts {
  const count = (tag: string): number => doc.components.filter((component) => component.tag === tag).length;
  return { new: count("new"), changed: count("changed"), removed: count("removed") };
}

/**
 * The evidence findings that concern only built code. A `new` box has no code yet, so findings
 * about it or about an arrow that touches it are left out.
 */
export function builtEvidence(doc: ArchitectureDoc, findings: Evidence["findings"]): Evidence["findings"] {
  const planned = new Set(doc.components.filter((component) => component.tag === "new").map((component) => component.id));
  const connections = doc.connections ?? [];
  return findings.filter((finding) => {
    if (finding.component !== undefined && planned.has(finding.component)) return false;
    if ("between" in finding && finding.between !== undefined && finding.between.some((id) => planned.has(id))) return false;
    const arrow = /^\/connections\/(\d+)$/.exec(finding.pointer);
    const connection = arrow === null ? undefined : connections[Number(arrow[1])];
    return connection === undefined || !(planned.has(connection.from) || planned.has(connection.to));
  });
}
