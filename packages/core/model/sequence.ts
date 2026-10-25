// SEQ-01: what a sequence map cites, and the checks its schema cannot express (ADR 0069).
// Browser-safe.
import type { Issue, MapDoc, SequenceDoc, SourceRef } from "./types";

/** One thing a map cites code for: a box, a participant or a message. */
export interface CitedItem {
  id: string;
  /** JSON pointer of the item, such as `/messages/3`. */
  pointer: string;
  sources: SourceRef[];
}

export function isSequence(doc: MapDoc): doc is SequenceDoc {
  return doc.diagram_type === "sequence";
}

/** Every item of `doc` that may cite code, in document order: components, or participants then messages. */
export function citedItems(doc: MapDoc): CitedItem[] {
  if (!isSequence(doc)) return doc.components.map((component, i) => ({ id: component.id, pointer: `/components/${i}`, sources: component.sources ?? [] }));
  return [
    ...doc.participants.map((participant, i) => ({ id: participant.id, pointer: `/participants/${i}`, sources: participant.sources ?? [] })),
    ...doc.messages.map((message, i) => ({ id: message.id, pointer: `/messages/${i}`, sources: message.sources ?? [] })),
  ];
}

/**
 * Duplicate ids across participants and messages, unknown ends, phases out of order or
 * overlapping, and participants or calls that cite no code.
 */
export function sequenceChecks(doc: SequenceDoc): Issue[] {
  const issues: Issue[] = [];
  const first = new Map<string, string>();
  for (const item of citedItems(doc)) {
    const earlier = first.get(item.id);
    if (earlier === undefined) first.set(item.id, item.pointer);
    else issues.push({ code: "DuplicateId", pointer: `${item.pointer}/id`, message: `Duplicate id \`${item.id}\` (first used at ${earlier})` });
  }
  const participants = new Set(doc.participants.map((participant) => participant.id));
  const order = new Map<string, number>();
  doc.messages.forEach((message, i) => {
    if (!order.has(message.id)) order.set(message.id, i);
    for (const field of ["from", "to"] as const) {
      if (!participants.has(message[field])) {
        issues.push({ code: "UnknownReference", pointer: `/messages/${i}/${field}`, message: `Message \`${field}\` names unknown participant \`${message[field]}\`` });
      }
    }
    if (message.variant !== "return" && (message.sources ?? []).length === 0) {
      issues.push({ code: "MissingSources", pointer: `/messages/${i}`, message: `Message \`${message.id}\` has no sources; cite the line that makes the call` });
    }
  });
  doc.participants.forEach((participant, i) => {
    if ((participant.sources ?? []).length === 0) {
      issues.push({ code: "MissingSources", pointer: `/participants/${i}`, message: `Participant \`${participant.id}\` has no sources; cite 1–3 files that implement it` });
    }
  });
  const spans: { start: number; end: number; index: number }[] = [];
  (doc.phases ?? []).forEach((phase, i) => {
    const start = order.get(phase.first);
    const end = order.get(phase.last);
    for (const [field, at] of [["first", start], ["last", end]] as const) {
      if (at === undefined) issues.push({ code: "UnknownReference", pointer: `/phases/${i}/${field}`, message: `Phase \`${field}\` names unknown message \`${phase[field]}\`` });
    }
    if (start === undefined || end === undefined) return;
    if (start > end) {
      issues.push({ code: "PhaseOrder", pointer: `/phases/${i}`, message: `Phase \`${phase.label}\` starts at \`${phase.first}\`, which comes after its last message \`${phase.last}\`` });
      return;
    }
    const overlap = spans.find((span) => start <= span.end && span.start <= end);
    if (overlap) issues.push({ code: "PhaseOrder", pointer: `/phases/${i}`, message: `Phase \`${phase.label}\` overlaps the phase at /phases/${overlap.index}` });
    spans.push({ start, end, index: i });
  });
  return issues;
}
